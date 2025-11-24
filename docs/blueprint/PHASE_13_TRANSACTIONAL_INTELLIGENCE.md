# PHASE 13 — TRANSACTIONAL INTELLIGENCE  
**Monitrax Blueprint — Phase 13**

## Purpose  
Transform Monitrax from a static financial record keeper into a *dynamic behavioural engine* that understands spending patterns, categorises transactions intelligently, detects anomalies, and builds a deep longitudinal financial profile of users.

This phase introduces *true transactional intelligence* — preparing the platform for downstream phases like Cashflow Optimisation, Personal CFO, and AI-powered financial coaching.

---

# 13.1 Objectives  
1. **Centralise all transactional data ingestion**
   - Banking feeds  
   - Credit card feeds  
   - Manual imports (CSV, Excel, OFX)  
   - Manual entries through UI  

2. **Implement AI-assisted transaction categorisation**
   - Zero-shot classification (LLM)  
   - Category correction learning loop  
   - Merchant normalisation (Woolworths vs Woolworths Marketplace vs Woolies → “Woolworths”)  
   - Auto-detect recurring payments  

3. **Create the Transaction Intelligence Engine (TIE)**
   - Runs rules + ML (hybrid)  
   - Detects anomalies, duplicates, corrections  
   - Learns user preferences per category  
   - Builds expenditure behavioural profile  

4. **Power BI-style drill-downs**
   - Category → Subcategory → Merchant → Individual transaction → Linked relationships  
   - Filters by time, account, tags, patterns  

5. **Expose a unified API for downstream engines**
   - Cashflow Optimisation (Phase 14)  
   - Personal CFO Engine (Phase 17)  
   - Insights Engine v3 (later)  

---

# 13.2 Architecture Overview  
**Transactional Intelligence Engine (TIE)** will run as a backend micro-engine.

### Components:
1. **Transaction Ingestion Pipeline**
   - Normalisation
   - De-duplication
   - Pattern standardisation
   - Merchant mapping

2. **Categorisation Engine**
   - Rules-based layer (fast)
   - LLM classification layer (accurate)
   - Hybrid reconciliation layer

3. **Behavioural Engine**
   - Learns:
     - Category corrections
     - Recurring charges
     - Outlier behaviour
     - Spending clusters  
   - Detects:
     - Price increases  
     - Duplicate transactions  
     - Suspicious merchants  

4. **Analytics Layer**
   - Rolling spend averages  
   - Trend detection  
   - Category drift  
   - Predicted monthly outgoings  
   - Spending volatility  

5. **Unified Transaction Record (UTR) schema**
   - Standardised model across all banks
   - Fit for long-term behavioural analytics

---

# 13.3 Data Requirements  

### **13.3.1 Transaction Schema**
UTR fields must include:

- id  
- accountId  
- date  
- postDate  
- merchantRaw  
- merchantStandardised  
- merchantCategoryCode (MCC)  
- categoryLevel1  
- categoryLevel2  
- subcategory  
- tags[]  
- amount  
- currency  
- isCredit / isDebit  
- isRecurring  
- recurrencePattern  
- anomalyFlags[]  
- source (bank, csv, manual)  
- linkedEntities (loanId, propertyId, etc.)

---

# 13.4 TIE Processing Flow

```
Ingest → Normalise → Categorise → Detect Patterns → Behaviour Profile → Expose Insights
```

### Step Breakdown:
1. **Ingest**
   - Raw banking feed or CSV import  
   - Apply ingestion adapters per source  

2. **Normalise**
   - Merchant cleaning rules  
   - MCC lookup  
   - Character cleaning  
   - Timezone alignment  

3. **Categorise**
   - Rules-based check  
   - ML classification  
   - Human correction loop  

4. **Pattern Detection**
   - Recurring subscriptions  
   - Spending clusters  
   - Unexpected spikes  
   - Merchant behaviour changes  

5. **Behaviour Profile Generation**
   - Category averages  
   - Rolling cashflow prediction  
   - Seasonality detection  

6. **Expose**
   - API endpoints  
   - UI data streams  
   - Downstream engine inputs  

---

# 13.5 UI Requirements  
### **13.5.1 Transaction Explorer**
Features:
- Global search  
- Category pivoting  
- Merchant drill-down  
- Split transactions  
- Tagging  
- Anomaly flags displayed  
- Clean timeline view  

### **13.5.2 Category Corrections UI**
- Approve/override AI categorisation  
- Provide feedback that feeds learning loop  
- View categorisation confidence score  

### **13.5.3 Recurring Payments Center**
- All recurring payments  
- Next occurrence prediction  
- Monthly cost summaries  
- Price change alerts  

---

# 13.6 Integration with Other Phases  
### Feeds Into:
- Phase 14 Cashflow Optimisation  
- Phase 12 Financial Health Engine  
- Phase 17 Personal CFO Engine  
- Insights Engine v3  
- Budgeting UI enhancements  

### Requires From Existing:
- GRDCS entity links  
- Account & transaction APIs  
- Snapshot engine consumption  

---

# 13.7 Acceptance Criteria  
A feature is “Phase 13 Ready” when:

### **Data**
- All transactions normalised  
- Merchant mapping accuracy ≥ 92%  
- Category accuracy ≥ 85% before corrections  
- Duplicate detection accuracy ≥ 98%  

### **AI Learning Loop**
- Category override improves future matches  
- Recurring pattern detection ≥ 90% accuracy  
- Anomaly detection thresholds tunable  

### **UI**
- Users can fully explore transactions  
- Recurring payment centre functional  
- Category corrections functional  

### **System**
- TIE engine runs performant under load  
- All APIs documented  
- All data available to Snapshot v2  

---

# 13.8 Deliverables  
- Transaction Intelligence Engine (TIE)  
- Normalisation & cleaning pipeline  
- Categorisation engine (rules + AI)  
- Recurring detection subsystem  
- Transaction Explorer UI  
- Category correction UI  
- Behavioural profile datasets  
- APIs for Phase 14/17  
