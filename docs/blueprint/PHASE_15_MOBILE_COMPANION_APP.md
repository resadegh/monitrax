# PHASE 15 — MOBILE COMPANION APP  
**Monitrax Blueprint — Phase 15**

## Purpose  
Deliver a lightweight, fast, and precision-scoped mobile experience that focuses on **daily financial clarity**, **real-time alerts**, **quick actions**, and **portable insights**—without replicating the full complexity of the web dashboard.

The goal:  
### “A pocket-sized Monitrax that keeps you financially sharp on the move.”

This is *not* a mobile clone — it is a **companion**.

---

# 15.1 Objectives  
1. **Design a mobile architecture separate from the web app**  
   - Clean, minimal, high-performance  
   - Offline-friendly data model  
   - Native interaction patterns  

2. **Provide the core functions users need on-the-go**  
   - Health indicators  
   - Cashflow forecast preview  
   - Transaction feed (Phase 13)  
   - Category trends  
   - Financial alerts & notifications  

3. **Integrate with backend using optimised endpoints**  
   - Reduced payload versions of the APIs  
   - Snapshot “lite mode”  
   - Incremental sync  

4. **Deep integration with Insights Engine v3**  
   - Real-time push notifications  
   - Actionable insights  
   - Daily financial “digest”  

5. **Build a unified interaction system with CMNF**  
   - Mobile-friendly navigation version  
   - Entity drill-down  
   - Context restoration  

6. **Deliver a best-in-class UX**  
   - Zero clutter  
   - Touch-first interface  
   - Haptic feedback on financial events  

---

# 15.2 Mobile App Strategy  

## 15.2.1 Platform Choice  
Phase 15 recommends:

### **React Native + Expo**
- Rapid development  
- Shared libraries  
- OTA (over-the-air) updates  
- Great ecosystem  
- Perfect fit with Next.js backend  

Long-term optional:
- Native Swift/Kotlin versions (Phase 18, if required)

---

# 15.3 Feature Scope

## 15.3.1 Home Screen — “Daily Financial Pulse”  
Shows:
- Cashflow forecast (7-day compact curve)  
- Current financial health indicator  
- Accounts snapshot  
- Spending velocity (today vs average)  
- Quick actions (“Add expense”, “Add income”)  
- Top 3 insights  

Behaviour:
- Pull-to-refresh  
- Auto-refresh every 30 minutes  
- Offline cached state  

---

## 15.3.2 Transaction Feed  
Powered by Phase 13.

Features:
- Smart grouping  
- Subscription detection badges  
- AI-assisted categorisation  
- Swipe left/right for quick categorisation  
- “Explain this transaction” (AI annotation)  
- Tagging & notes  
- Merchant enrichment  

---

## 15.3.3 Cashflow Mini-Dashboard  
Compact view of Phase 14.

Shows:
- Next 14-day cash position  
- Recurring charges timeline  
- High/low spend alerts  
- Forecast confidence meter  

---

## 15.3.4 Insights & Alerts Hub  
Real-time delivery of:
- Overspending alerts  
- Subscription price rises  
- Cashflow risk warning  
- Loan repayment upcoming  
- Investment performance alerts (Phase 18+)  

Users can:
- Save an insight  
- Dismiss  
- Mark as resolved  
- Trigger a workflow (“Adjust budget”, “Review recurring expense”)  

---

## 15.3.5 Notifications & Background Activity  
When enabled:
- Push alerts from Insights Engine v3  
- Silent background sync  
- Morning “Daily Digest”  
- Weekly summary  

Mobile-specific insights include:
- “You’re trending higher in spending this week”  
- “Shortfall expected in 3 days”  
- “Recurring charge detected”  
- “Loan repayment due tomorrow”  

---

# 15.4 Architecture

## 15.4.1 Offline-First Cache Layer  
Stores:
- Last snapshot (lite mode)  
- Cached transactions  
- Cached insights  
- Cached forecast segments  
- User preferences  

Technology:
- SQLite via Expo  
- Minimal tables  
- Prefetch strategy  

---

## 15.4.2 API Optimisation for Mobile  
Mobile endpoints must return “compressed” datasets:

### Example:
- /snapshot/mobile  
- /transactions/mobile  
- /insights/mobile  

Requirements:
- Max payload < 200kb  
- Latency < 150ms  
- Delta sync supported  
- No heavy nested structures  

---

# 15.5 CMNF (Cross-Module Navigation Framework) Mobile Edition  

Mobile CMNF is a simplified version of the web CMNF.

Supports:
- Drilling into any entity  
- Quick navigation between related items  
- Breadcrumb-less navigation  
- Contextual back behaviour  
- “Continue on desktop” deep-link sharing  

---

# 15.6 UX Principles for Mobile  

1. **Minimal cognitive load**  
   Every screen must have one purpose.

2. **One-thumb navigation**  
   All core actions reachable with thumb.

3. **Light on data, heavy on clarity**  
   Information density reduced by ~50%.

4. **Haptic supportive**  
   Positive and negative financial states generate different haptics.

5. **Predictable gestures**  
   Swipe = categorise  
   Long press = more info  
   Tap = drill down  

6. **Fast startup time**  
   < 750ms target  

---

# 15.7 Integration With Other Phases  

### Depends On:  
- Phase 08 (GRDCS & entity linking)  
- Phase 09 (Health + Navigation Intelligence)  
- Phase 13 (Transactional Intelligence)  
- Phase 14 (Cashflow Optimisation)  

### Feeds Into:  
- Phase 17 (Personal CFO Engine)  
- Phase 18 (Investment AI Advisor – optional future)  

---

# 15.8 Acceptance Criteria  

### Functional  
- Displays daily pulse instantly  
- Shows insights within 1 second of launch  
- Offline mode works  
- Transaction categorisation via gestures  
- Notifications delivered reliably  

### Technical  
- Mobile snapshot endpoint functional  
- Delta sync reduces bandwidth by ≥ 70%  
- CMNF Mobile responds < 50ms  

### UX  
- User can view entire financial life in < 15 seconds  
- No clutter, no overwhelm  
- All critical information accessible in 3 taps max  

---

# 15.9 Deliverables  

- Mobile App (React Native + Expo)  
- Daily Pulse Screen  
- Mobile Transaction Feed  
- Compact Cashflow Dashboard  
- Insights & Alerts Hub  
- Notification Infrastructure  
- Mobile CMNF Navigator  
- Snapshot Lite API  
- Offline Cache Layer  
