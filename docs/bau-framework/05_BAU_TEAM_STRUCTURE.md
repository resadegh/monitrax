# 05 - BAU Team Structure & Scaling Plan

**Date:** 2026-04-10 | **Version:** 1.0 | **Status:** DRAFT

---

## 1. Current State

Monitrax currently operates with a **sole director** handling all responsibilities:
- Development
- Operations
- CDR compliance
- Infrastructure management
- Customer support
- Business strategy

**Risk Assessment:** Single point of failure for ALL operational, compliance, and development functions. This is the highest organizational risk for Monitrax.

---

## 2. BAU Team Evolution Model

### Phase 0: Current (Sole Director + AI Assistance)

```
Director / Founder
├── Development (Claude Code + manual)
├── Operations (manual + GCP dashboards)
├── CDR Compliance (manual audits)
├── Infrastructure (GCP + Vercel)
└── Customer Support (direct)
```

**Capacity:** ~40 hours/week total across all functions
**Risk:** Critical - no redundancy, no after-hours coverage

---

### Phase 1: Minimum Viable BAU Team (1-5 users, pre-revenue growth)

**Headcount: 2 (Director + 1 hire)**

```
Director / Founder
├── Strategic direction
├── Architecture decisions
├── CDR compliance ownership
└── Business development

BAU Engineer (Full-Stack)                    [HIRE #1]
├── Daily operations (health checks, monitoring)
├── Incident response (L1/L2)
├── Deployment management
├── Customer support (L1)
├── Database operations (basic)
├── Documentation maintenance
└── CDR operational tasks (under director oversight)
```

**Hire Profile: BAU Engineer**
| Attribute | Requirement |
|-----------|-------------|
| **Role** | Full-Stack BAU Engineer |
| **Experience** | 3-5 years in operations/SRE or full-stack development |
| **Must-have** | TypeScript/Next.js, PostgreSQL, GCP basics, Git |
| **Should-have** | Firebase Auth, Prisma ORM, CDR/financial data awareness |
| **Nice-to-have** | Basiq API, Australian financial regulations |
| **Clearance** | Must pass CDR security awareness training |
| **Location** | Australia-based (CDR compliance, timezone coverage) |

**On-Call Model:** Shared between Director and BAU Engineer (alternating weeks)

---

### Phase 2: Growth Team (5-50 users, early revenue)

**Headcount: 4 (Director + 3 hires)**

```
Director / Founder
├── Strategic direction
├── Product roadmap
├── CDR compliance ownership
└── Key account management

BAU Lead / Senior Engineer                   [HIRE #1 → promoted]
├── Team coordination
├── Incident management (L2/L3)
├── Change management
├── Performance tuning
├── Capacity planning
└── CDR compliance reporting

Junior BAU Analyst                           [HIRE #2]
├── Daily operations checklist
├── Health monitoring
├── Customer support (L1)
├── Documentation updates
├── Basic incident response (L1)
└── CDR data inventory & reporting

Part-Time DBA / Data Engineer                [HIRE #3 - contract]
├── Database optimization
├── Migration management
├── Backup verification
├── Query performance tuning
├── CDR data lifecycle automation
└── Data integrity validation
```

**On-Call Model:** 3-person rotation (Director + BAU Lead + BAU Analyst)
**CDR Compliance:** Director remains accountable; BAU Lead handles day-to-day operations

---

### Phase 3: Scale Team (50-500 users, established revenue)

**Headcount: 7-8 (Director + 6-7 hires)**

```
Director / CEO
├── Business strategy
├── CDR compliance accountability (accountable person)
├── Key partnerships (Basiq, financial institutions)
└── Board/investor relations

Engineering Manager / CTO                    [HIRE #4]
├── Architecture governance
├── Development team leadership
├── Technology roadmap
├── Security architecture
└── Platform reliability

BAU Team Lead                               [HIRE #1 → promoted]
├── Operations management
├── Incident command
├── SLA management
├── Vendor management (GCP, Vercel, Basiq)
└── Process improvement

BAU Analyst x2                              [HIRE #2 + HIRE #5]
├── 24/5 coverage (split shifts)
├── Daily operations
├── L1/L2 incident response
├── Customer support
├── Monitoring & alerting
└── Documentation maintenance

Security & Compliance Analyst               [HIRE #6]
├── CDR compliance monitoring
├── Security operations
├── Audit management
├── Penetration testing coordination
├── Policy maintenance
├── Regulatory reporting
└── CDR breach response coordination

DBA / Platform Engineer                     [HIRE #3 → full-time]
├── Database operations
├── Infrastructure as Code
├── CI/CD pipeline
├── Performance engineering
├── Disaster recovery
└── Capacity planning

Software Developer (Full-Stack)             [HIRE #7]
├── Bug fixes and patches
├── Feature development
├── Integration maintenance (Basiq, Firebase)
├── Technical debt reduction
└── Test automation
```

**On-Call Model:** Dedicated rotation across BAU Analysts + BAU Lead + Platform Engineer
**CDR Compliance:** Security & Compliance Analyst handles day-to-day; Director remains accountable person

---

### Phase 4: Enterprise Team (500+ users, multiple products)

**Headcount: 12-15**

```
Director / CEO
├── Executive leadership
└── CDR accountable person

CTO / Engineering Manager
├── Engineering org (4-6 developers)
├── Architecture & technical strategy
└── Platform team oversight

Head of Operations                           [New role]
├── BAU Team Lead
│   ├── BAU Analyst x3 (8/5 or 24/5 coverage)
│   └── Customer Success Manager
├── Platform Engineer x2
│   ├── Infrastructure
│   └── CI/CD & Automation
└── DBA

Head of Security & Compliance                [New role]
├── Security & Compliance Analyst x2
├── CDR compliance program
├── External audit coordination
└── Incident response command
```

---

## 3. Role Definitions (Detailed)

### 3.1 BAU Lead

**Primary Responsibilities:**
- Own daily/weekly/monthly operational procedures
- First escalation point for L1 analysts
- Incident commander for P1-P2 incidents
- Produce SLA and performance reports
- Manage change requests (standard and normal)
- Coordinate with development team on releases
- Maintain operational documentation

**Key Performance Indicators:**
| KPI | Target |
|-----|--------|
| System availability | > 99.5% |
| P0 MTTA | < 15 minutes |
| P1 MTTR | < 8 hours |
| Change failure rate | < 5% |
| Runbook coverage | 100% of known scenarios |

**CDR Responsibilities:**
- Execute daily CDR operational checklist
- Produce monthly CDR data inventory
- Coordinate quarterly CDR compliance audits
- First responder for CDR-related incidents (escalate to Director)

---

### 3.2 BAU Analyst

**Primary Responsibilities:**
- Execute daily operations checklist (health checks, monitoring review)
- L1 incident response and escalation
- Customer support triage and resolution
- Execute standard change requests
- Monitor alerts and dashboards
- Maintain operational logs

**Key Performance Indicators:**
| KPI | Target |
|-----|--------|
| Daily checklist completion | 100% |
| L1 ticket resolution rate | > 80% |
| Alert acknowledgement time | < 5 minutes |
| Customer response time | < 2 hours |
| Documentation accuracy | No outdated procedures |

---

### 3.3 Security & Compliance Analyst

**Primary Responsibilities:**
- Own CDR compliance monitoring (daily/weekly/monthly activities)
- Manage audit log review and anomaly investigation
- Coordinate external security audits and pen tests
- Maintain security and CDR policy documents
- Investigate security incidents
- Produce compliance reports
- Manage vulnerability response (CVE tracking)

**Key Performance Indicators:**
| KPI | Target |
|-----|--------|
| CDR compliance score | 100% |
| Vulnerability response (Critical) | < 24 hours |
| Audit log coverage | 100% of CDR endpoints |
| Policy review cadence | Quarterly |
| CDR incident response time | < 15 minutes |

---

### 3.4 DBA / Platform Engineer

**Primary Responsibilities:**
- Database performance optimization
- Migration planning and execution
- Backup verification (monthly restore test)
- Infrastructure monitoring and scaling
- CI/CD pipeline maintenance
- DR drill execution (quarterly)
- Capacity planning and forecasting

**Key Performance Indicators:**
| KPI | Target |
|-----|--------|
| Database availability | 99.9% |
| Query P95 | < 500ms |
| Backup success rate | 100% |
| DR drill success | Quarterly pass |
| Migration zero-downtime | 100% |

---

## 4. Training & Onboarding

### 4.1 Onboarding Checklist (All BAU Team Members)

**Week 1: Foundation**
- [ ] Read CLAUDE.md (complete protocol understanding)
- [ ] Read all `docs/operational/` documents
- [ ] Read all `docs/policy/` documents
- [ ] Read `docs/bau-framework/` (this document suite)
- [ ] Complete CDR awareness training (2 hours)
- [ ] Set up GCP Console access (read-only initially)
- [ ] Set up Vercel dashboard access
- [ ] Set up monitoring dashboard access
- [ ] Shadow existing team member for 3 days

**Week 2: Hands-On**
- [ ] Execute daily operations checklist (supervised)
- [ ] Practice incident response scenarios
- [ ] Review recent incident reports
- [ ] Complete database operations training
- [ ] Complete deployment procedure training
- [ ] Read blueprint overview documents (00-09)
- [ ] Understand financial data model (Prisma schema)

**Week 3-4: Independence**
- [ ] Execute daily operations checklist (independent)
- [ ] Handle L1 support tickets (supervised)
- [ ] Participate in weekly BAU standup
- [ ] Complete all security training modules
- [ ] Join on-call rotation (shadow only)

**Month 2: Full Integration**
- [ ] Full L1 responsibility
- [ ] On-call rotation (with backup)
- [ ] Monthly report contribution
- [ ] Documentation update assignment

### 4.2 Ongoing Training

| Training | Frequency | Audience | Provider |
|----------|-----------|----------|----------|
| CDR compliance updates | Quarterly | All BAU | Internal / External |
| GCP platform updates | Quarterly | Platform team | GCP training |
| Security awareness | Annual | All team | Internal |
| Incident response drill | Bi-annual | All BAU | Internal |
| DR drill participation | Quarterly | Platform + BAU Lead | Internal |
| Financial literacy | Annual | All BAU | External |

---

## 5. Cost Estimation

### 5.1 Team Cost by Phase (AUD, Annual)

| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|---------|---------|---------|---------|
| BAU Engineer/Lead | $100-130K | $120-150K | $130-160K | $140-170K |
| BAU Analyst | - | $70-90K | $70-90K x2 | $70-90K x3 |
| Security/Compliance | - | - | $110-140K | $120-150K x2 |
| DBA/Platform | - | $50-70K (PT) | $100-130K | $110-140K x2 |
| Engineering Manager | - | - | $150-180K | $160-200K |
| Developer | - | - | $100-130K | $110-140K x3 |
| Head of Ops | - | - | - | $150-180K |
| **Total Team Cost** | **$100-130K** | **$240-310K** | **$660-830K** | **$1.1-1.6M** |

### 5.2 Infrastructure Cost (Monthly, AUD)

| Service | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---------|---------|---------|---------|---------|
| GCP (Cloud SQL + services) | $200-400 | $400-800 | $800-2,000 | $2,000-5,000 |
| Vercel | $20-50 | $50-100 | $100-400 | $400-1,000 |
| Basiq | Per API call | Per API call | Enterprise | Enterprise |
| Monitoring tools | $0 (GCP free tier) | $50-100 | $200-500 | $500-1,000 |
| **Total Monthly Infra** | **$220-450** | **$500-1,000** | **$1,100-2,900** | **$2,900-7,000** |

---

## 6. Tooling Requirements

### 6.1 BAU Team Tools

| Category | Tool | Purpose | Phase Needed |
|----------|------|---------|-------------|
| **Incident Management** | PagerDuty or OpsGenie | Alert routing, on-call rotation, escalation | Phase 1 |
| **Ticketing** | Jira Service Management or Freshdesk | Customer support, change requests | Phase 1 |
| **Monitoring** | GCP Cloud Monitoring + Grafana | Dashboards, custom metrics | Phase 1 |
| **Communication** | Slack or Teams | Team chat, alert channels, incident war rooms | Phase 1 |
| **Documentation** | GitHub (current) + Notion/Confluence | Runbooks, knowledge base | Phase 2 |
| **Secrets** | GCP Secret Manager | Credential management and rotation | Phase 1 |
| **Log Management** | GCP Cloud Logging | Centralized logs, query, alerting | Already in place |
| **Deployment** | Vercel Dashboard | Deployment management, rollback | Already in place |

### 6.2 Communication Channels

| Channel | Purpose | Members |
|---------|---------|---------|
| #monitrax-alerts | Automated monitoring alerts | All BAU |
| #monitrax-incidents | Active incident coordination | All BAU + Dev |
| #monitrax-ops | General operations discussion | All BAU |
| #monitrax-changes | Change notifications, deployment alerts | All BAU + Dev |
| #monitrax-cdr | CDR compliance discussions | BAU Lead + Security + Director |

---

## 7. Succession Planning

### 7.1 Key Person Dependencies

| Function | Current Owner | Backup | Risk Level |
|----------|--------------|--------|-----------|
| CDR Accountable Person | Director | None | Critical |
| Production database access | Director | None | Critical |
| GCP admin | Director | None | Critical |
| Basiq relationship | Director | None | High |
| Architecture knowledge | Director | None | Critical |
| Customer relationships | Director | None | High |

### 7.2 Risk Mitigation (Immediate)

1. **Document all credentials** in GCP Secret Manager (not personal storage)
2. **Create emergency access procedures** for if Director is unavailable
3. **Ensure GCP project has backup admin** (service account with break-glass)
4. **Document Basiq account recovery** procedure
5. **Maintain up-to-date CLAUDE.md** as architectural knowledge base
6. **Record key decision rationale** in architecture decision records (ADRs)

### 7.3 Knowledge Distribution Target

| Knowledge Area | Phase 1 | Phase 2 | Phase 3 |
|---------------|---------|---------|---------|
| Daily operations | 2 people | 3 people | 4+ people |
| Incident response | 2 people | 3 people | 5+ people |
| CDR compliance | 1 person (Director) | 2 people | 3+ people |
| Architecture | 1 person (Director) | 2 people | 3+ people |
| Database admin | 1 person (Director) | 2 people | 2+ people |
| Customer support | 1 person (Director) | 2 people | 3+ people |

---

*Team structure and costs are estimates based on Australian market rates (2026). Actual costs will vary by location, experience, and market conditions. See TRACKING_REFERENCE.md for source verification.*
