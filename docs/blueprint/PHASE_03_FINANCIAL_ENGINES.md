# 💸 **PHASE 03 — FINANCIAL ENGINES (V1 → V2 TRANSITION)**  
### *Core calculators, projections, amortisation models, and financial intelligence foundations.*

---

# **1. Purpose of Phase 03**

Phase 03 evolves Monitrax from a “data platform” into a **true calculation engine**.  
It introduces:

- Detailed financial mathematics  
- Amortisation models  
- Depreciation schedules  
- Investment calculations  
- Rental/expense algorithms  
- Multi-frequency harmonisation  
- Early forecasting tools  

This phase forms ALL future value-add features, including the Insights Engine (Phase 4) and Strategy Engine (Phase 11).

---

# **2. Deliverables Overview**

This phase must deliver:

### **2.1 Core Engines**
- Loan Amortisation Engine  
- Cashflow Engine  
- Property ROI Engine  
- Depreciation Engine  
- Investment Return Engine  
- Income/Expense Projection Engine  
- Frequency Harmonisation Engine  

### **2.2 Tools & Utilities**
- Time-series generator  
- Date interpolation  
- Annualisation utilities  
- Compounding calculators  
- Multi-schedule merger  

### **2.3 Cross-Module Normalisation**
Everything must calculate using:
- consistent units  
- consistent frequencies  
- consistent time boundaries  
- consistent rounding rules  

### **2.4 Engine API Layer**
Expose calculators via:
- `/api/calculate/*`  
- strict Zod schema validation  
- typed results  

---

# **3. Mathematical Foundations**

Each engine must explicitly use standardised formulas.

---

## **3.1 Loan Amortisation Engine**

Supports:
- principal + interest loans  
- interest-only loans  
- mixed-term loans (IO → P&I)  
- fixed → variable transitions  
- offset account adjustments  

### **Core formulas**

Monthly repayment:

```
Pmt = P * r * (1+r)^n / ((1+r)^n - 1)
```

Interest-only repayment:

```
Pmt = P * r
```

Fixed rate break logic:

- If fixed period remaining → freeze rate  
- Else → switch to variable  

Offset adjustment:

```
effectivePrincipal = principal - offsetBalance
interest = effectivePrincipal * rate * dt
```

---

## **3.2 Cashflow Engine**

Normalises all frequencies to monthly:

```
weekly → *52 / 12
fortnightly → *26 / 12
monthly → unchanged
annual → /12
```

Outputs:
- monthly cashflow  
- annualised cashflow  
- net rental position  
- net household cashflow  

---

## **3.3 Income/Expense Projection Engine**

Handles:
- inflation  
- CPI indexing  
- step changes  
- one-off adjustments  
- frequency harmonisation  

Produces:
- 1-year  
- 3-year  
- 5-year  
forecasts.

---

## **3.4 Depreciation Engine**

Supports:
- Straight Line  
- Diminishing Value  
- Capital works (2.5%)  

Straight Line:

```
annual = cost / life
```

Diminishing Value:

```
annual = baseValue * rate
baseValue = cost - accumulatedDepreciation
```

---

## **3.5 Property ROI Engine**

Calculates:
- rental yield  
- cash-on-cash  
- gross yield  
- net yield  
- equity position  
- growth-adjusted return  

Example:

```
netYield = (annualRent - annualExpenses) / propertyValue
equity = propertyValue - loanBalance
```

---

## **3.6 Investment Engine**

Supports:
- cost base calculation  
- CGT (simplified)  
- unit balances  
- P&L  
- realised/unrealised performance  

Unit balance:

```
units = Σ(buys) - Σ(sells)
```

Value:

```
marketValue = units * latestPrice
```

P&L:

```
unrealised = marketValue - costBase
```

---

# **4. Frequency Harmonisation Engine**

All modules rely on a single shared frequency converter.

Key responsibilities:
- normalise ANY cash input to monthly  
- reverse normalise if needed  
- enforce consistent financial units  

Output must use:

```
{
  monthly: number,
  annual: number,
  effectiveRate: number
}
```

---

# **5. Time-Series Engine**

Used by:
- insights  
- forecast models  
- cashflow projections  
- health analysis  

### **5.1 Generate Series**
```
generateSeries(start, end, step)
```

### **5.2 Interpolation**
```
interpolate(valueA, valueB, t)
```

### **5.3 Merge Multi-Schedule Streams**
Merge events from:
- rent  
- loan  
- expenses  
- income  
- investments  

into a single chronological array.

---

# **6. Engine API Endpoints**

All endpoints must be implemented under:

```
/api/calculate/*
```

### Required routes:

- `/calculate/loan`  
- `/calculate/cashflow`  
- `/calculate/rent`  
- `/calculate/property-roi`  
- `/calculate/investment`  
- `/calculate/depreciation`  

Payloads must be validated via Zod.

All responses must follow:

```
{
  input: {},
  output: {},
  diagnostics: {}
}
```

Where:
- **diagnostics** tracks anomalies, warnings, or out-of-range values.

---

# **7. Engine Integration Requirements**

Every engine must:

- accept raw entity data  
- validate via Zod  
- normalise via harmoniser  
- compute independent results  
- export structured output  
- integrate via Snapshot Engine  
- expose engine diagnostics  

---

# **8. Acceptance Criteria**

Phase 03 is complete when:

### Engines
✔ Loan amortisation (IO, PI, mixed)  
✔ Cashflow normalisation  
✔ Depreciation (SL, DV)  
✔ Investment engine  
✔ Property ROI engine  
✔ Income/Expense projection engine  

### APIs
✔ All `/api/calculate/*` implemented  
✔ All Zod validation schemas created  
✔ Contract-first designs documented  

### Integration
✔ Snapshot Engine consumes engine outputs  
✔ All engines deterministic & repeatable  
✔ Every module can be recalculated independently  

---

