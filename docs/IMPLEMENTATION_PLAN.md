# MONITRAX IMPLEMENTATION PLAN

**Created:** 2025-11-24
**Scope:** Complete Phase 1-9 Gaps
**Current Completion:** 63%
**Target Completion:** 100%

---

## EXECUTIVE SUMMARY

This plan addresses all gaps identified in the Gap Analysis Report across Phases 1-9.
Work is organized into 8 sequential builds, each with:
- Specific deliverables
- Test checkpoints
- Rollback criteria

**Estimated Total Effort:** 6-8 builds

---

## DEPENDENCY GRAPH

```
Build 1 (Foundations) ──┬──> Build 2 (Validation) ──> Build 3 (Security)
                        │
                        └──> Build 4 (Calculate APIs)

Build 3 (Security) ────────> Build 5 (UI Components)

Build 5 (UI Components) ───> Build 6 (Dashboard/Insights)

Build 6 (Dashboard) ───────> Build 7 (Nav/Health UI)

Build 7 (Nav/Health) ──────> Build 8 (Performance & Polish)
```

---

## BUILD 1: FOUNDATIONS (Phase 1 Gaps)

**Priority:** CRITICAL
**Phase:** 1
**Estimated Effort:** 2-3 hours

### Deliverables

#### 1.1 Error Utility
**File:** `/lib/utils/errors.ts`

```typescript
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'timestamp' in error
  );
}

export function formatErrorResponse(error: AppError, status = 400): Response {
  return Response.json(
    { success: false, error },
    { status }
  );
}
```

#### 1.2 Logger Utility
**File:** `/lib/utils/logger.ts`

```typescript
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

const isDev = process.env.NODE_ENV === 'development';

function formatLog(level: string, message: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...context };

  if (isDev) {
    console.log(JSON.stringify(logEntry, null, 2));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

export const log = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (isDev) formatLog('debug', message, context);
  },
  info: (message: string, context?: Record<string, unknown>) => {
    formatLog('info', message, context);
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    formatLog('warn', message, context);
  },
  error: (message: string, error?: Error, context?: Record<string, unknown>) => {
    formatLog('error', message, {
      ...context,
      error: error ? { message: error.message, stack: error.stack } : undefined,
    });
  },
};
```

#### 1.3 Formatters Utility
**File:** `/lib/utils/formatters.ts`

```typescript
export function formatCurrency(
  amount: number,
  options?: { currency?: string; locale?: string }
): string {
  const { currency = 'AUD', locale = 'en-AU' } = options || {};
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercentage(
  value: number,
  options?: { decimals?: number; showSign?: boolean }
): string {
  const { decimals = 2, showSign = false } = options || {};
  const formatted = (value * 100).toFixed(decimals);
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}

export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'relative' = 'short'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (format === 'relative') {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }

  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: format === 'long' ? 'long' : 'short',
    year: 'numeric',
  });
}

export function formatNumber(
  value: number,
  options?: { abbreviate?: boolean; decimals?: number }
): string {
  const { abbreviate = false, decimals = 0 } = options || {};

  if (abbreviate && Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (abbreviate && Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
```

#### 1.4 Global Error Boundary
**File:** `/app/error.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { log } from '@/lib/utils/logger';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error('Unhandled error', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md">
          {error.message || 'An unexpected error occurred'}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
```

### Test Checkpoint 1

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Build verification
npm run build

# 3. Manual tests
- [ ] Import logger in any file, verify console output
- [ ] Import formatCurrency, verify "$1,234,567" format
- [ ] Trigger an error, verify error boundary displays

# 4. Rollback criteria
- Any TypeScript errors
- Build failure
- Runtime crashes on import
```

---

## BUILD 2: VALIDATION LAYER (Phase 2 Gaps)

**Priority:** CRITICAL
**Phase:** 2
**Depends on:** Build 1
**Estimated Effort:** 3-4 hours

### Deliverables

#### 2.1 Validation Directory Structure
```
/lib/validation/
├── index.ts           # Barrel export
├── properties.ts      # Property schemas
├── loans.ts           # Loan schemas
├── accounts.ts        # Account schemas
├── income.ts          # Income schemas
├── expenses.ts        # Expense schemas
├── investments.ts     # Investment schemas
└── common.ts          # Shared schemas
```

#### 2.2 Common Schemas
**File:** `/lib/validation/common.ts`

```typescript
import { z } from 'zod';

export const IdSchema = z.string().cuid();
export const UUIDSchema = z.string().uuid();
export const DateSchema = z.string().datetime().or(z.date());
export const CurrencySchema = z.number().nonnegative();
export const PercentageSchema = z.number().min(0).max(100);

export const FrequencySchema = z.enum([
  'WEEKLY',
  'FORTNIGHTLY',
  'MONTHLY',
  'QUARTERLY',
  'ANNUAL',
]);

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});
```

#### 2.3 Property Schemas
**File:** `/lib/validation/properties.ts`

```typescript
import { z } from 'zod';
import { IdSchema, CurrencySchema, DateSchema } from './common';

export const PropertyTypeSchema = z.enum(['HOME', 'INVESTMENT']);

export const PropertyCreateSchema = z.object({
  name: z.string().min(1, 'Property name is required').max(100),
  address: z.string().max(500).optional(),
  type: PropertyTypeSchema,
  purchasePrice: CurrencySchema,
  purchaseDate: DateSchema.optional(),
  currentValue: CurrencySchema.optional(),
});

export const PropertyUpdateSchema = PropertyCreateSchema.partial().extend({
  id: IdSchema,
});

export const PropertyQuerySchema = z.object({
  type: PropertyTypeSchema.optional(),
  minValue: CurrencySchema.optional(),
  maxValue: CurrencySchema.optional(),
});

export type PropertyCreate = z.infer<typeof PropertyCreateSchema>;
export type PropertyUpdate = z.infer<typeof PropertyUpdateSchema>;
export type PropertyQuery = z.infer<typeof PropertyQuerySchema>;
```

#### 2.4 Similar schemas for loans, accounts, income, expenses, investments

#### 2.5 API Response Wrapper
**File:** `/lib/utils/api-response.ts`

```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createError, formatErrorResponse, AppError } from './errors';
import { log } from './logger';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  meta?: {
    timestamp: string;
    page?: number;
    limit?: number;
    total?: number;
  };
}

export function successResponse<T>(
  data: T,
  meta?: { page?: number; limit?: number; total?: number }
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status = 400
): NextResponse<ApiResponse<never>> {
  const error = createError(code as any, message);
  log.warn('API error response', { code, message, status });
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}

export function handleApiError(error: unknown, route: string): NextResponse {
  log.error(`API error in ${route}`, error as Error);

  if (error instanceof ZodError) {
    return errorResponse(
      'VALIDATION_ERROR',
      error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      400
    );
  }

  return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
}
```

### Test Checkpoint 2

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Build verification
npm run build

# 3. Unit tests (create if not exist)
# Test each schema with valid and invalid data

# 4. Integration test
- [ ] POST /api/properties with invalid data → returns validation error
- [ ] POST /api/properties with valid data → creates property
- [ ] All API routes use new response format

# 5. Rollback criteria
- Validation breaks existing API contracts
- TypeScript errors
- Build failure
```

---

## BUILD 3: SECURITY FOUNDATION (Phase 5 Critical Gaps)

**Priority:** CRITICAL
**Phase:** 5
**Depends on:** Build 1, Build 2
**Estimated Effort:** 6-8 hours

### Deliverables

#### 3.1 RBAC Permission System
**File:** `/lib/auth/permissions.ts`

```typescript
import { UserRole } from '@prisma/client';

export const PERMISSIONS = {
  // Properties
  'property.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'property.write': ['OWNER', 'PARTNER'],
  'property.delete': ['OWNER'],

  // Loans
  'loan.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'loan.write': ['OWNER', 'PARTNER'],
  'loan.delete': ['OWNER'],

  // Accounts
  'account.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'account.write': ['OWNER', 'PARTNER'],
  'account.delete': ['OWNER'],

  // Income/Expenses
  'income.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'income.write': ['OWNER', 'PARTNER'],
  'expense.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'expense.write': ['OWNER', 'PARTNER'],

  // Investments
  'investment.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'investment.write': ['OWNER', 'PARTNER'],

  // Settings & Users
  'settings.manage': ['OWNER'],
  'user.manage': ['OWNER'],
  'user.invite': ['OWNER'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(
  userRole: UserRole,
  permission: Permission
): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes(userRole as any);
}

export function checkPermissions(
  userRole: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every(p => hasPermission(userRole, p));
}
```

#### 3.2 Auth Middleware Enhancement
**File:** `/lib/auth/middleware.ts`

```typescript
import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasPermission, Permission } from './permissions';
import { errorResponse } from '@/lib/utils/api-response';
import { log } from '@/lib/utils/logger';

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload || !payload.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.id, // In single-user mode, tenant = user
    };
  } catch (error) {
    log.error('Auth context extraction failed', error as Error);
    return null;
  }
}

export function withAuth(
  handler: (request: NextRequest, context: AuthContext) => Promise<Response>,
  requiredPermission?: Permission
) {
  return async (request: NextRequest) => {
    const auth = await getAuthContext(request);

    if (!auth) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (requiredPermission && !hasPermission(auth.role as any, requiredPermission)) {
      log.warn('Permission denied', {
        userId: auth.userId,
        permission: requiredPermission,
        role: auth.role,
      });
      return errorResponse('FORBIDDEN', 'Permission denied', 403);
    }

    return handler(request, auth);
  };
}
```

#### 3.3 Tenant-Aware Prisma Queries
**File:** `/lib/db/tenant.ts`

```typescript
import { prisma } from '@/lib/db';

// Wrapper functions that enforce tenant isolation
export const tenantPrisma = {
  property: {
    findMany: (tenantId: string, args?: any) =>
      prisma.property.findMany({
        ...args,
        where: { ...args?.where, userId: tenantId },
      }),
    findFirst: (tenantId: string, args?: any) =>
      prisma.property.findFirst({
        ...args,
        where: { ...args?.where, userId: tenantId },
      }),
    create: (tenantId: string, data: any) =>
      prisma.property.create({
        data: { ...data, userId: tenantId },
      }),
    update: (tenantId: string, id: string, data: any) =>
      prisma.property.updateMany({
        where: { id, userId: tenantId },
        data,
      }),
    delete: (tenantId: string, id: string) =>
      prisma.property.deleteMany({
        where: { id, userId: tenantId },
      }),
  },
  // Similar for loan, account, income, expense, investment...
};
```

#### 3.4 Audit Logging
**File:** `/lib/audit/logger.ts`

```typescript
import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';

export type AuditEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'EXPORT';

export interface AuditEvent {
  type: AuditEventType;
  principalId: string;
  tenantId: string;
  targetEntity?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    // Log to console/external service
    log.info('Audit event', {
      ...event,
      timestamp: new Date().toISOString(),
    });

    // Store in database (requires AuditLog model in schema)
    // await prisma.auditLog.create({ data: { ... } });
  } catch (error) {
    log.error('Failed to log audit event', error as Error, event);
  }
}

// Utility to extract request metadata
export function extractRequestMeta(request: Request) {
  return {
    ip: request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}
```

#### 3.5 Update Prisma Schema
Add AuditLog model to `/prisma/schema.prisma`:

```prisma
model AuditLog {
  id           String   @id @default(cuid())
  eventType    String
  principalId  String
  tenantId     String
  targetEntity String?
  targetId     String?
  timestamp    DateTime @default(now())
  ip           String?
  userAgent    String?
  severity     String   @default("INFO")
  metadata     Json?

  @@index([principalId])
  @@index([tenantId])
  @@index([timestamp])
}
```

### Test Checkpoint 3

```bash
# 1. Database migration
npx prisma migrate dev --name add_audit_log

# 2. TypeScript compilation
npx tsc --noEmit

# 3. Build verification
npm run build

# 4. Security tests
- [ ] Request without token → 401 Unauthorized
- [ ] Request with invalid token → 401 Unauthorized
- [ ] ACCOUNTANT role trying to delete → 403 Forbidden
- [ ] OWNER role deleting → Success
- [ ] User A cannot access User B's data (tenant isolation)
- [ ] Audit log entries created for actions

# 5. Rollback criteria
- Any security bypass possible
- Existing auth flows break
- Build failure
```

---

## BUILD 4: CALCULATE API ENDPOINTS (Phase 3 Gaps)

**Priority:** HIGH
**Phase:** 3
**Depends on:** Build 1, Build 2
**Estimated Effort:** 4-5 hours

### Deliverables

#### 4.1 Loan Calculate Endpoint
**File:** `/app/api/calculate/loan/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { successResponse, handleApiError } from '@/lib/utils/api-response';
import { calculateLoanRepayment } from '@/lib/planning/debtPlanner';

const LoanCalcSchema = z.object({
  principal: z.number().positive(),
  annualRate: z.number().min(0).max(50),
  termYears: z.number().int().positive().max(50),
  type: z.enum(['PRINCIPAL_AND_INTEREST', 'INTEREST_ONLY']),
  offsetBalance: z.number().nonnegative().default(0),
  frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY']).default('MONTHLY'),
});

export const POST = withAuth(async (request: NextRequest, auth) => {
  try {
    const body = await request.json();
    const input = LoanCalcSchema.parse(body);

    const result = calculateLoanRepayment(input);

    return successResponse({
      input,
      output: result,
      diagnostics: {
        warnings: [],
        assumptions: ['Standard amortisation formula used'],
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/calculate/loan');
  }
}, 'loan.read');
```

#### 4.2 Cashflow Calculate Endpoint
**File:** `/app/api/calculate/cashflow/route.ts`

#### 4.3 Property ROI Calculate Endpoint
**File:** `/app/api/calculate/property-roi/route.ts`

#### 4.4 Investment Calculate Endpoint
**File:** `/app/api/calculate/investment/route.ts`

#### 4.5 Depreciation Calculate Endpoint
**File:** `/app/api/calculate/depreciation/route.ts`

#### 4.6 Time Series Utility
**File:** `/lib/utils/timeSeries.ts`

```typescript
export interface TimeSeriesPoint {
  date: Date;
  value: number;
  label?: string;
}

export function generateDateSeries(
  start: Date,
  end: Date,
  step: 'day' | 'week' | 'month' | 'year'
): Date[] {
  const dates: Date[] = [];
  let current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));

    switch (step) {
      case 'day':
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        current.setDate(current.getDate() + 7);
        break;
      case 'month':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'year':
        current.setFullYear(current.getFullYear() + 1);
        break;
    }
  }

  return dates;
}

export function interpolate(
  valueA: number,
  valueB: number,
  t: number // 0 to 1
): number {
  return valueA + (valueB - valueA) * t;
}

export function mergeTimeSeries(
  ...series: TimeSeriesPoint[][]
): TimeSeriesPoint[] {
  const merged = series.flat();
  return merged.sort((a, b) => a.date.getTime() - b.date.getTime());
}
```

### Test Checkpoint 4

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Build verification
npm run build

# 3. API endpoint tests
- [ ] POST /api/calculate/loan with valid data → correct calculation
- [ ] POST /api/calculate/cashflow with valid data → correct calculation
- [ ] POST /api/calculate/property-roi with valid data → correct calculation
- [ ] POST /api/calculate/investment with valid data → correct calculation
- [ ] POST /api/calculate/depreciation with valid data → correct calculation
- [ ] All endpoints return { input, output, diagnostics } format
- [ ] Invalid data returns validation errors

# 4. Rollback criteria
- Calculation results incorrect
- Existing /calculate/debt-plan breaks
- Build failure
```

---

## BUILD 5: UI CORE COMPONENTS (Phase 6 Gaps)

**Priority:** HIGH
**Phase:** 6
**Depends on:** Build 3
**Estimated Effort:** 4-5 hours

### Deliverables

#### 5.1 FormField Component
**File:** `/components/form/FormField.tsx`

```typescript
'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  error,
  helpText,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
```

#### 5.2 CurrencyInput Component
**File:** `/components/form/CurrencyInput.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  currency?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  currency = 'AUD',
  placeholder = '0',
  className,
  disabled,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value === 0) {
      setDisplayValue('');
    } else {
      setDisplayValue(value.toLocaleString('en-AU'));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(raw) || 0;
    setDisplayValue(e.target.value);
    onChange(num);
  };

  const handleBlur = () => {
    if (value > 0) {
      setDisplayValue(value.toLocaleString('en-AU'));
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        $
      </span>
      <Input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn('pl-7', className)}
      />
    </div>
  );
}
```

#### 5.3 NumberInput Component
**File:** `/components/form/NumberInput.tsx`

#### 5.4 DatePicker Component
**File:** `/components/form/DatePicker.tsx`

#### 5.5 DataTable Component (Virtualized)
**File:** `/components/data/DataTable.tsx`

```typescript
'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  searchColumn?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  searchColumn,
  onRowClick,
  emptyMessage = 'No data found',
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, globalFilter },
  });

  return (
    <div className={cn('space-y-4', className)}>
      {searchColumn && (
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted' : ''}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

#### 5.6 ConfirmationDialog Component
**File:** `/components/ui/confirmation-dialog.tsx`

### Test Checkpoint 5

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Build verification
npm run build

# 3. Component tests
- [ ] FormField renders with label, error, helpText
- [ ] CurrencyInput formats numbers correctly
- [ ] DatePicker opens calendar, selects date
- [ ] DataTable sorts, filters, handles clicks
- [ ] ConfirmationDialog opens, confirms, cancels

# 4. Visual verification
- [ ] Components match design system
- [ ] Responsive on mobile

# 5. Rollback criteria
- Components crash on render
- TypeScript errors
- Build failure
```

---

## BUILD 6: DASHBOARD & INSIGHTS (Phase 7 Gaps)

**Priority:** HIGH
**Phase:** 7
**Depends on:** Build 5
**Estimated Effort:** 4-5 hours

### Deliverables

#### 6.1 DashboardInsightsFeed
**File:** `/components/dashboard/DashboardInsightsFeed.tsx`

```typescript
'use client';

import { Insight } from '@/lib/intelligence/insightsEngine';
import { InsightCard } from '@/components/insights/InsightCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface DashboardInsightsFeedProps {
  insights: Insight[];
  maxItems?: number;
  onInsightClick?: (insight: Insight) => void;
}

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export function DashboardInsightsFeed({
  insights,
  maxItems = 5,
  onInsightClick,
}: DashboardInsightsFeedProps) {
  const sortedInsights = [...insights]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, maxItems);

  const criticalCount = insights.filter(i => i.severity === 'critical').length;
  const highCount = insights.filter(i => i.severity === 'high').length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Active Insights
        </CardTitle>
        {(criticalCount > 0 || highCount > 0) && (
          <div className="flex items-center gap-2 text-sm">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertTriangle className="h-4 w-4" />
                {criticalCount} critical
              </span>
            )}
            {highCount > 0 && (
              <span className="text-orange-500">{highCount} high</span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedInsights.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No active insights
          </p>
        ) : (
          sortedInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onClick={() => onInsightClick?.(insight)}
              compact
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
```

#### 6.2 ModuleInsightsPanel
**File:** `/components/dashboard/ModuleInsightsPanel.tsx`

```typescript
'use client';

import { Insight } from '@/lib/intelligence/insightsEngine';
import { InsightList } from '@/components/insights/InsightList';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

interface ModuleInsightsPanelProps {
  module: string;
  insights: Insight[];
  maxItems?: number;
  onViewAll?: () => void;
}

export function ModuleInsightsPanel({
  module,
  insights,
  maxItems = 3,
  onViewAll,
}: ModuleInsightsPanelProps) {
  const moduleInsights = insights.filter(i =>
    i.entityType?.toLowerCase() === module.toLowerCase()
  );

  const displayInsights = moduleInsights.slice(0, maxItems);
  const hasMore = moduleInsights.length > maxItems;

  if (moduleInsights.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {module} Insights ({moduleInsights.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <InsightList insights={displayInsights} compact />
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onViewAll}
          >
            View all {moduleInsights.length} insights
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

#### 6.3 Update Dashboard Page
Integrate new components into `/app/dashboard/page.tsx`

### Test Checkpoint 6

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Build verification
npm run build

# 3. Integration tests
- [ ] Dashboard page renders DashboardInsightsFeed
- [ ] Insights sorted by severity (critical first)
- [ ] Click on insight navigates correctly
- [ ] Module pages show ModuleInsightsPanel
- [ ] Empty states render correctly

# 4. Rollback criteria
- Dashboard crashes
- Insights don't render
- Build failure
```

---

## BUILD 7: NAVIGATION & HEALTH UI (Phase 9 Gaps)

**Priority:** HIGH
**Phase:** 9
**Depends on:** Build 6
**Estimated Effort:** 4-5 hours

### Deliverables

#### 7.1 Health Modal
**File:** `/components/health/HealthModal.tsx`

```typescript
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModuleHealthGrid } from './ModuleHealthBlock';
import { useCrossModuleNavigation } from '@/hooks/useCrossModuleNavigation';
import { LinkageHealthResult } from '@/lib/intelligence/linkageHealthService';
import { AlertTriangle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

interface HealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  health: LinkageHealthResult;
}

export function HealthModal({ isOpen, onClose, health }: HealthModalProps) {
  const { openLinkedEntity } = useCrossModuleNavigation();

  const getStatusIcon = (score: number) => {
    if (score >= 85) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (score >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    if (score >= 50) return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon(health.completenessScore)}
            System Health Details
            <Badge variant={health.completenessScore >= 85 ? 'default' : 'destructive'}>
              {health.completenessScore}%
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Module Breakdown */}
          <section>
            <h3 className="font-semibold mb-3">Module Health</h3>
            <ModuleHealthGrid health={health} />
          </section>

          {/* Missing Links */}
          {health.missingLinks && health.missingLinks.length > 0 && (
            <section>
              <h3 className="font-semibold mb-3 text-orange-600">
                Missing Links ({health.missingLinks.length})
              </h3>
              <ul className="space-y-2">
                {health.missingLinks.slice(0, 5).map((link, i) => (
                  <li key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">{link.description}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        openLinkedEntity(link.entity);
                        onClose();
                      }}
                    >
                      Fix <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Orphaned Entities */}
          {health.orphanedEntities && health.orphanedEntities.length > 0 && (
            <section>
              <h3 className="font-semibold mb-3 text-red-600">
                Orphaned Entities ({health.orphanedEntities.length})
              </h3>
              <ul className="space-y-2">
                {health.orphanedEntities.slice(0, 5).map((entity, i) => (
                  <li key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm">{entity.name || entity.id}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        openLinkedEntity(entity);
                        onClose();
                      }}
                    >
                      View <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(health.timestamp || Date.now()).toLocaleString()}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 7.2 Breadcrumb Display
**File:** `/components/navigation/BreadcrumbDisplay.tsx`

```typescript
'use client';

import { Fragment } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  id: string;
  label: string;
  type: string;
  href?: string;
}

interface BreadcrumbDisplayProps {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem) => void;
  className?: string;
  maxItems?: number;
}

export function BreadcrumbDisplay({
  items,
  onNavigate,
  className,
  maxItems = 4,
}: BreadcrumbDisplayProps) {
  // Collapse middle items if too many
  const displayItems = items.length > maxItems
    ? [
        items[0],
        { id: 'ellipsis', label: '...', type: 'ellipsis' },
        ...items.slice(-2),
      ]
    : items;

  return (
    <nav className={cn('flex items-center text-sm', className)} aria-label="Breadcrumb">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => onNavigate({ id: 'home', label: 'Dashboard', type: 'dashboard', href: '/dashboard' })}
      >
        <Home className="h-4 w-4" />
      </Button>

      {displayItems.map((item, index) => (
        <Fragment key={item.id}>
          <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
          {item.type === 'ellipsis' ? (
            <span className="text-muted-foreground px-2">...</span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-2',
                index === displayItems.length - 1 && 'font-semibold'
              )}
              onClick={() => onNavigate(item)}
            >
              {item.label}
            </Button>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
```

#### 7.3 Update useUISyncEngine Polling Interval
Change from 30s to 15s as per blueprint

#### 7.4 Integrate Components in DashboardLayout

### Test Checkpoint 7

```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Build verification
npm run build

# 3. Integration tests
- [ ] Health badge in sidebar shows correct score
- [ ] Click health badge opens HealthModal
- [ ] Missing links list navigates to entity
- [ ] Breadcrumb shows correct hierarchy
- [ ] Breadcrumb collapses for deep navigation
- [ ] Click breadcrumb item navigates correctly
- [ ] UI updates every 15 seconds

# 4. Rollback criteria
- Navigation breaks
- Health modal crashes
- Build failure
```

---

## BUILD 8: PERFORMANCE & POLISH (Phase 8 + Final)

**Priority:** MEDIUM
**Phase:** 8 + All
**Depends on:** Build 7
**Estimated Effort:** 3-4 hours

### Deliverables

#### 8.1 Delta/Trend Calculation
**File:** `/lib/snapshot/deltaCalculator.ts`

```typescript
interface SnapshotMetrics {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  monthlyCashflow: number;
}

interface Delta {
  current: number;
  previous: number;
  change: number;
  percentChange: number;
}

interface SnapshotDelta {
  period: string;
  wealth: Delta;
  assets: Delta;
  liabilities: Delta;
  cashflow: Delta;
  timestamp: string;
}

export function calculateDelta(
  current: SnapshotMetrics,
  previous: SnapshotMetrics,
  period: string = '30d'
): SnapshotDelta {
  const calcDelta = (curr: number, prev: number): Delta => ({
    current: curr,
    previous: prev,
    change: curr - prev,
    percentChange: prev !== 0 ? ((curr - prev) / prev) * 100 : 0,
  });

  return {
    period,
    wealth: calcDelta(current.netWorth, previous.netWorth),
    assets: calcDelta(current.totalAssets, previous.totalAssets),
    liabilities: calcDelta(current.totalLiabilities, previous.totalLiabilities),
    cashflow: calcDelta(current.monthlyCashflow, previous.monthlyCashflow),
    timestamp: new Date().toISOString(),
  };
}
```

#### 8.2 Performance Monitoring
**File:** `/lib/utils/performance.ts`

```typescript
import { log } from './logger';

export function measurePerformance<T>(
  name: string,
  fn: () => T,
  thresholdMs = 200
): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  if (duration > thresholdMs) {
    log.warn(`Performance warning: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${thresholdMs}ms`,
    });
  }

  return result;
}

export async function measureAsyncPerformance<T>(
  name: string,
  fn: () => Promise<T>,
  thresholdMs = 200
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  if (duration > thresholdMs) {
    log.warn(`Performance warning: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${thresholdMs}ms`,
    });
  }

  return result;
}
```

#### 8.3 Add Performance Monitoring to Snapshot API

#### 8.4 Final Code Cleanup
- Remove unused imports
- Add missing JSDoc comments
- Ensure consistent formatting

### Test Checkpoint 8 (FINAL)

```bash
# 1. TypeScript compilation (must be 0 errors)
npx tsc --noEmit

# 2. Build verification
npm run build

# 3. Full regression test
- [ ] All 8 module pages load correctly
- [ ] All CRUD operations work
- [ ] All dialogs open/close properly
- [ ] CMNF navigation works across modules
- [ ] Health badge updates in real-time
- [ ] Insights display correctly
- [ ] Warning ribbons trigger appropriately
- [ ] Performance < 500ms for dashboard load
- [ ] Performance < 200ms for snapshot API

# 4. Security verification
- [ ] Unauthenticated requests rejected
- [ ] Permission checks working
- [ ] Tenant isolation enforced

# 5. Deploy to staging
npm run build && npm run start

# 6. Smoke test on staging
- [ ] Login works
- [ ] Dashboard loads
- [ ] Create property works
- [ ] Insights generate
```

---

## TESTING STRATEGY

### After Each Build

1. **TypeScript Compilation**
   ```bash
   npx tsc --noEmit
   ```
   Must pass with 0 errors.

2. **Build Verification**
   ```bash
   npm run build
   ```
   Must complete successfully.

3. **Functional Tests**
   - Manual testing of new features
   - Regression testing of existing features

4. **Rollback Decision**
   If any of these occur, rollback the build:
   - TypeScript errors
   - Build failure
   - Critical functionality broken
   - Security vulnerability introduced

### Regression Test Checklist

After each build, verify:

```markdown
## Core Functionality
- [ ] Login/Logout works
- [ ] Dashboard loads without errors
- [ ] Navigation between modules works

## Module CRUD
- [ ] Properties: Create, Read, Update, Delete
- [ ] Loans: Create, Read, Update, Delete
- [ ] Accounts: Create, Read, Update, Delete
- [ ] Income: Create, Read, Update, Delete
- [ ] Expenses: Create, Read, Update, Delete
- [ ] Investments: Create, Read, Update, Delete

## Phase 9 Features
- [ ] CMNF navigation works
- [ ] LinkedDataPanel shows relationships
- [ ] Health badge displays
- [ ] Warning ribbons trigger
- [ ] Insights display in UI

## Performance
- [ ] Dashboard loads < 500ms
- [ ] API responses < 200ms
- [ ] No UI freezes
```

---

## ROLLBACK PROCEDURES

### Git Rollback
```bash
# View recent commits
git log --oneline -10

# Rollback to specific commit
git revert <commit-hash>

# Force rollback (destructive)
git reset --hard <commit-hash>
git push -f origin <branch>
```

### Database Rollback
```bash
# View migration history
npx prisma migrate status

# Rollback migration
npx prisma migrate reset
```

---

## ESTIMATED TIMELINE

| Build | Effort | Dependencies |
|-------|--------|--------------|
| Build 1 | 2-3 hours | None |
| Build 2 | 3-4 hours | Build 1 |
| Build 3 | 6-8 hours | Build 1, 2 |
| Build 4 | 4-5 hours | Build 1, 2 |
| Build 5 | 4-5 hours | Build 3 |
| Build 6 | 4-5 hours | Build 5 |
| Build 7 | 4-5 hours | Build 6 |
| Build 8 | 3-4 hours | Build 7 |

**Total:** ~32-40 hours of implementation

---

## SUCCESS CRITERIA

Phase 1-9 is considered 100% complete when:

1. ✅ All TypeScript errors resolved
2. ✅ Build passes without warnings
3. ✅ All gap items implemented
4. ✅ All test checkpoints passed
5. ✅ Security audit passed
6. ✅ Performance thresholds met
7. ✅ Full regression suite passed

---

**Document Version:** 1.0
**Created:** 2025-11-24
**Author:** Claude (Monitrax Engineering Agent)
