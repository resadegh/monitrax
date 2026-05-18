/**
 * GET /api/admin/schema-drift — Phase 0 / production-readiness audit
 *
 * SUPER_ADMIN-only. Compares the **production** database's structure
 * (queried live from `information_schema` / `pg_catalog` over the WIF
 * connection) against what `prisma/schema.prisma` declares (read from
 * `Prisma.dmmf`, the data-model meta-format baked into the generated
 * client). Reports drift introduced during the pre-migration `prisma
 * db push` era — tables / columns / enum-values that the schema
 * declares but the production DB doesn't have (the
 * `basiq_connections.consentExpiresAt` class of bug — see
 * `docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md` §12),
 * plus the reverse (prod has columns/tables/enum-values the schema
 * doesn't know about — less urgent; usually the fix is to add them to
 * the schema rather than drop them).
 *
 * READ-ONLY — runs only `SELECT`s against `information_schema` /
 * `pg_catalog`. Touches no data, applies nothing. The fix for any drift
 * it finds is a **corrective migration** (additive
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` /
 * `ALTER TYPE ... ADD VALUE IF NOT EXISTS ...`), shipped as its own PR —
 * never a direct `ALTER` on prod (CLAUDE.md §12.12). Each `missingColumns`
 * entry includes a `suggestedAddColumnSql` *hint* (not applied here).
 *
 * Scope: a column / table / enum-value-level check. It catches the
 * high-risk drift — a `SELECT *` on a table that's missing a column
 * crashes the request (which is exactly what 500-ed the CDR-lifecycle
 * cron). It does **not** check column types, nullability, defaults, or
 * indexes. For a full reconciliation, run
 * `npx prisma migrate diff --from-url <prod-url> --to-schema-datamodel prisma/schema.prisma --script`
 * locally.
 *
 * Returns no data — only schema metadata (table / column / enum names).
 * CLAUDE.md §13.3 N/A by structure.
 */

import { NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
// A handful of catalog SELECTs — fast. 60s is generous headroom.
export const maxDuration = 60;

// Prisma scalar type → a suggested Postgres column type. Used only to
// build the `suggestedAddColumnSql` hint in the report — this endpoint
// applies nothing.
const PG_TYPE_BY_PRISMA_SCALAR: Record<string, string> = {
  String: 'TEXT',
  Boolean: 'BOOLEAN',
  Int: 'INTEGER',
  BigInt: 'BIGINT',
  Float: 'DOUBLE PRECISION',
  Decimal: 'DECIMAL(65,30)',
  DateTime: 'TIMESTAMP(3)',
  Json: 'JSONB',
  Bytes: 'BYTEA',
};

// Tables that exist in prod but legitimately map to no Prisma model.
const KNOWN_NON_MODEL_TABLES = new Set(['_prisma_migrations']);

interface ExpectedColumn {
  prismaField: string;
  prismaType: string;
  kind: string; // 'scalar' | 'enum' | 'unsupported'
  isList: boolean;
  isRequired: boolean;
  suggestedPgType: string;
}

export async function GET(request: Request) {
  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json(
      { error: authResult.error },
      {
        status:
          authResult.error?.code === ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED ? 503 : 401,
      },
    );
  }
  if (authResult.context.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: 'Only SUPER_ADMIN can run the schema-drift audit.',
        },
      },
      { status: 403 },
    );
  }

  // ---- Expected, from schema.prisma via Prisma.dmmf ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dmmf: any = (Prisma as any).dmmf;
  if (!dmmf?.datamodel?.models) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'DMMF_UNAVAILABLE',
          message:
            'Prisma.dmmf is not available in the deployed bundle — run `npx prisma migrate diff --from-url <prod-url> --to-schema-datamodel prisma/schema.prisma --script` locally instead (see docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md §12).',
        },
      },
      { status: 500 },
    );
  }

  const expectedTables = new Map<string, { model: string; columns: Map<string, ExpectedColumn> }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const model of dmmf.datamodel.models as any[]) {
    const tableName: string = model.dbName ?? model.name;
    const columns = new Map<string, ExpectedColumn>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const f of (model.fields ?? []) as any[]) {
      if (f.kind === 'object') continue; // relation field — no column of its own
      const columnName: string = f.dbName ?? f.name;
      const base =
        f.kind === 'enum'
          ? `"${f.type}"` // enum type referenced by name (hint only — adjust if the enum has a @map)
          : PG_TYPE_BY_PRISMA_SCALAR[f.type] ?? `/* TODO: Prisma type ${f.type} */`;
      columns.set(columnName, {
        prismaField: f.name,
        prismaType: f.type,
        kind: f.kind,
        isList: !!f.isList,
        isRequired: !!f.isRequired,
        suggestedPgType: `${base}${f.isList ? '[]' : ''}`,
      });
    }
    expectedTables.set(tableName, { model: model.name, columns });
  }

  const expectedEnums = new Map<string, { prismaEnum: string; values: Set<string> }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (dmmf.datamodel.enums ?? []) as any[]) {
    const enumName: string = e.dbName ?? e.name;
    expectedEnums.set(enumName, {
      prismaEnum: e.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      values: new Set(((e.values ?? []) as any[]).map((v) => v.dbName ?? v.name)),
    });
  }

  // ---- Actual, from prod ----
  let actualTables: Set<string>;
  const actualColumnsByTable = new Map<string, Set<string>>();
  const actualEnumValuesByEnum = new Map<string, Set<string>>();
  try {
    const tableRows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      // 2026-05-19 — `information_schema.tables.table_name` is the Postgres
      // `name` type, which Prisma's `$queryRawUnsafe` can't deserialize.
      // Cast to `text` so the driver returns a plain string.
      `SELECT table_name::text AS table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    actualTables = new Set(tableRows.map((r) => r.table_name));

    const colRows = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
      // Both columns are the Postgres `name` type; cast to `text` (same
      // reason as above).
      `SELECT table_name::text AS table_name, column_name::text AS column_name FROM information_schema.columns WHERE table_schema = 'public'`,
    );
    for (const r of colRows) {
      if (!actualColumnsByTable.has(r.table_name)) actualColumnsByTable.set(r.table_name, new Set());
      actualColumnsByTable.get(r.table_name)!.add(r.column_name);
    }

    const enumRows = await prisma.$queryRawUnsafe<{ enum_name: string; enum_value: string }[]>(
      // `pg_type.typname` + `pg_enum.enumlabel` + `pg_namespace.nspname` are
      // all the Postgres `name` type. Cast to `text` so Prisma can return
      // them as plain strings.
      `SELECT t.typname::text AS enum_name, e.enumlabel::text AS enum_value
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'`,
    );
    for (const r of enumRows) {
      if (!actualEnumValuesByEnum.has(r.enum_name)) actualEnumValuesByEnum.set(r.enum_name, new Set());
      actualEnumValuesByEnum.get(r.enum_name)!.add(r.enum_value);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { code: 'QUERY_FAILED', message } },
      { status: 500 },
    );
  }

  // ---- Diff ----
  const missingTables: { model: string; table: string }[] = [];
  const tablesWithMissingColumns: {
    table: string;
    model: string;
    missingColumns: {
      column: string;
      prismaField: string;
      prismaType: string;
      isList: boolean;
      isRequired: boolean;
      suggestedAddColumnSql: string;
    }[];
  }[] = [];
  const tablesWithExtraColumns: { table: string; model: string; extraColumns: string[] }[] = [];

  for (const [table, exp] of expectedTables) {
    if (!actualTables.has(table)) {
      missingTables.push({ model: exp.model, table });
      continue;
    }
    const actualCols = actualColumnsByTable.get(table) ?? new Set<string>();
    const missingColumns: typeof tablesWithMissingColumns[number]['missingColumns'] = [];
    for (const [col, c] of exp.columns) {
      if (!actualCols.has(col)) {
        missingColumns.push({
          column: col,
          prismaField: c.prismaField,
          prismaType: c.prismaType,
          isList: c.isList,
          isRequired: c.isRequired,
          suggestedAddColumnSql: `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" ${c.suggestedPgType};`,
        });
      }
    }
    if (missingColumns.length > 0) tablesWithMissingColumns.push({ table, model: exp.model, missingColumns });

    const expectedNames = new Set(exp.columns.keys());
    const extra = [...actualCols].filter((c) => !expectedNames.has(c)).sort();
    if (extra.length > 0) tablesWithExtraColumns.push({ table, model: exp.model, extraColumns: extra });
  }

  const missingEnums: { prismaEnum: string; enum: string; values: string[] }[] = [];
  const enumsWithMissingValues: { enum: string; prismaEnum: string; missingValues: string[] }[] = [];
  for (const [enumName, exp] of expectedEnums) {
    const actualVals = actualEnumValuesByEnum.get(enumName);
    if (!actualVals) {
      missingEnums.push({ prismaEnum: exp.prismaEnum, enum: enumName, values: [...exp.values].sort() });
      continue;
    }
    const missingValues = [...exp.values].filter((v) => !actualVals.has(v)).sort();
    if (missingValues.length > 0) {
      enumsWithMissingValues.push({ enum: enumName, prismaEnum: exp.prismaEnum, missingValues });
    }
  }

  const modelTableNames = new Set(expectedTables.keys());
  const orphanTables = [...actualTables]
    .filter((t) => !modelTableNames.has(t) && !KNOWN_NON_MODEL_TABLES.has(t))
    .sort();

  const summary = {
    modelsChecked: expectedTables.size,
    enumsChecked: expectedEnums.size,
    missingTables: missingTables.length,
    tablesWithMissingColumns: tablesWithMissingColumns.length,
    totalMissingColumns: tablesWithMissingColumns.reduce((s, t) => s + t.missingColumns.length, 0),
    tablesWithExtraColumns: tablesWithExtraColumns.length,
    missingEnums: missingEnums.length,
    enumsWithMissingValues: enumsWithMissingValues.length,
    orphanTables: orphanTables.length,
    hasDrift:
      missingTables.length > 0 ||
      tablesWithMissingColumns.length > 0 ||
      missingEnums.length > 0 ||
      enumsWithMissingValues.length > 0,
  };

  return NextResponse.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      note: 'Column/table/enum-value-level drift check (Prisma.dmmf vs the prod information_schema/pg_catalog). Catches the high-risk drift — a SELECT * on a table missing a column crashes the request. Does NOT check column types/nullability/defaults/indexes — for a full reconciliation run `npx prisma migrate diff --from-url <prod-url> --to-schema-datamodel prisma/schema.prisma --script` locally. The fix for any drift is a corrective additive migration in its own PR (ADD COLUMN IF NOT EXISTS / ALTER TYPE ... ADD VALUE), never a direct ALTER on prod (CLAUDE.md §12.12). The suggestedAddColumnSql fields are hints, not applied here.',
      summary,
      missingTables,
      tablesWithMissingColumns,
      tablesWithExtraColumns,
      missingEnums,
      enumsWithMissingValues,
      orphanTables,
      runBy: authResult.context.email,
    },
  });
}
