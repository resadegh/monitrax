/**
 * Neomatrix Layer 0 — Prisma data-model extraction. PURE NODE, deterministic.
 *
 * WHY THIS IS NOT GRAPHIFY. Graphify 0.8.45 ships 36 tree-sitter grammars;
 * `.prisma` is not among them. Running `graphify update prisma` extracts only
 * the five seed `.ts` files and leaves `schema.prisma` — 138 models, 135 enums,
 * the entire data layer Monitrax computes on — completely invisible. Graphify's
 * own alternative (`graphify extract --postgres <DSN>`) reads a LIVE database,
 * which is not something a build gate may do and which drops column-level
 * detail anyway. So the data layer is extracted here instead, by a parser with
 * the same contract as graphify's output: local, offline, no LLM, deterministic,
 * emitted as the same `[id, label, file, line]` / `[relation, from, to, file,
 * line]` tuples, and stamped with its own generator string in `_meta.generators`
 * so provenance is never blurred.
 *
 * WHAT IT EMITS
 *   node  prisma::model::<Name>            — a model (table)
 *   node  prisma::enum::<Name>             — an enum
 *   node  prisma::field::<Model>.<field>   — a scalar/relation field
 *   node  prisma::enumValue::<Enum>.<V>    — an enum member
 *   edge  contains   model → field · enum → enumValue
 *   edge  references field → model  (relation fields, incl. list relations)
 *   edge  typed_as   field → enum   (enum-typed fields)
 *
 * Every node carries its REAL line in `prisma/schema.prisma`, which is what
 * lets the binding gate detect anchor drift on the 24 semantic `input-field`
 * nodes that point into the schema (audit finding F5 / MON-116 — three of them
 * were pointing at lines that had moved by ~90).
 *
 * Comment handling: `//` and `///` lines are stripped before parsing, and a
 * trailing `//` comment on a field line is trimmed, so a commented-out model or
 * an inline note can never produce a phantom node.
 */

import { readFileSync } from 'node:fs';

const SCALARS = new Set([
  'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Json', 'Bytes', 'Unsupported',
]);

/**
 * Parse a Prisma schema into Layer-0 tuples.
 * @param {string} schemaPath absolute path to schema.prisma
 * @param {string} relPath repo-relative path used as the tuple `file`
 */
export function extractPrisma(schemaPath, relPath = 'prisma/schema.prisma') {
  const src = readFileSync(schemaPath, 'utf8');
  const lines = src.split('\n');

  const nodes = [];
  const edges = [];
  const models = new Set();
  const enums = new Set();

  // ── pass 1: block headers (so relation targets resolve regardless of order) ──
  const blocks = []; // { kind, name, start (0-based), end (0-based, inclusive) }
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!open) {
      const m = /^(model|enum)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(line);
      if (m) {
        open = { kind: m[1], name: m[2], start: i };
        (m[1] === 'model' ? models : enums).add(m[2]);
      }
    } else if (line === '}') {
      blocks.push({ ...open, end: i });
      open = null;
    }
  }

  // ── pass 2: members ────────────────────────────────────────────────────────
  for (const b of blocks) {
    const blockId = `prisma::${b.kind}::${b.name}`;
    nodes.push([blockId, b.name, relPath, b.start + 1]);

    for (let i = b.start + 1; i < b.end; i++) {
      const line = lines[i].replace(/\/\/.*$/, '').trim();
      if (!line || line.startsWith('@@') || line.startsWith('///')) continue;

      if (b.kind === 'enum') {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(line);
        if (!m) continue;
        const id = `prisma::enumValue::${b.name}.${m[1]}`;
        nodes.push([id, m[1], relPath, i + 1]);
        edges.push(['contains', blockId, id, relPath, i + 1]);
        continue;
      }

      // model field:  name  Type[]?  @attrs...
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)(\[\])?(\?)?/.exec(line);
      if (!m) continue;
      const [, fname, ftype, isList] = m;
      const id = `prisma::field::${b.name}.${fname}`;
      const label = `${fname}: ${ftype}${isList ? '[]' : ''}`;
      nodes.push([id, label, relPath, i + 1]);
      edges.push(['contains', blockId, id, relPath, i + 1]);
      if (!SCALARS.has(ftype)) {
        // resolved in pass 3 (target may be declared later in the file)
        edges.push([`__pending__:${ftype}`, id, ftype, relPath, i + 1]);
      }
    }
  }

  // ── pass 3: resolve non-scalar field types to model / enum targets ──────────
  const resolved = [];
  for (const e of edges) {
    if (!String(e[0]).startsWith('__pending__:')) {
      resolved.push(e);
      continue;
    }
    const target = e[2];
    if (models.has(target)) resolved.push(['references', e[1], `prisma::model::${target}`, e[3], e[4]]);
    else if (enums.has(target)) resolved.push(['typed_as', e[1], `prisma::enum::${target}`, e[3], e[4]]);
    // an unresolved type is a composite/unsupported alias — dropped, never guessed
  }

  return {
    nodes,
    edges: resolved,
    counts: { models: models.size, enums: enums.size, nodes: nodes.length, edges: resolved.length },
  };
}

// CLI — `node scripts/neomatrix/prisma-layer0.mjs` prints a readout.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { fileURLToPath } = await import('node:url');
  const { dirname, resolve } = await import('node:path');
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const r = extractPrisma(resolve(ROOT, 'prisma/schema.prisma'));
  console.log(
    `Prisma Layer 0: ${r.counts.models} models · ${r.counts.enums} enums · ${r.counts.nodes} nodes · ${r.counts.edges} edges`,
  );
}
