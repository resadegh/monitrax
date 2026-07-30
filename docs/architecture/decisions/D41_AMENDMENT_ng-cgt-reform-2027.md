# D41 — AMENDMENT: the negative gearing and CGT reform (commences 1 July 2027)

**Raised by Reza, 30 July 2026.** The Matrix did **not** know this reform — it was announced
**12 May 2026, 7:30pm AEST**, one week after the model's training cutoff. Verified against the ATO's
new-legislation guidance and two law-firm analyses before amending anything.

**Reza's framing corrected on one point:** commencement is **1 July 2027**, not 1 July 2026. The
12 May 2026 date is the **announcement and grandfathering cut-off**, not the start.

---

## §1 What changed

**Negative gearing.** From **1 July 2027**, residential dwellings **acquired after 7:30pm AEST on
12 May 2026** no longer qualify for negative gearing. Net rental losses **quarantine to assessable
income from residential dwellings**, instead of offsetting salary. Dwellings acquired **before** that
moment retain existing treatment. **New builds are exempt.**

**CGT.** From **1 July 2027** there is a **deemed disposal and reacquisition of all capital assets**.
The **50% discount is replaced by cost base indexation**, plus a **30% minimum capital gains tax
rate** for resident individuals. Gains accrued before commencement are protected. New residential
dwellings and affordable housing may **retain the 50% discount or elect indexation**; an Innovative
Business CGT Concession gives similar optionality to qualifying founders and early investors.

**Who it applies to:** Australian resident individuals, partnerships, trusts.
**Excluded:** companies, superannuation funds, life insurance companies, foreign and temporary
residents.

**Pre-CGT assets get NO carve-out.** Assets acquired before 20 September 1985 have their cost base
reset to market value at 1 July 2027 and **lose pre-CGT status**.

## §2 Amendments to settled decisions

### D26 — CGT discount becomes TIME-and-entity dependent

D26 recorded the discount as entity-dependent: 50% individuals and trusts · 33⅓% complying super ·
nil companies. **That holds only until 30 June 2027.** From 1 July 2027 it inverts in a way worth
stating plainly: **superannuation funds and companies are EXCLUDED from the new regime and therefore
keep their existing treatment, while individuals and trusts lose the discount.**

**The CGT engine needs a time dimension, not just an entity dimension.**

### Decision 17 — the dormant reform engine's park now has a hard deadline

Decision 17 parked `applyNegativeGearing` (+ Decimal twin) with an expiry condition: wire or delete
before any reform feature ships. **The reform is legislated with a known commencement date, so the
condition becomes a date: 1 July 2027 — roughly eleven months out.** Park with a firm delivery date,
not a conditional trigger. Both producers stay **counted in the census** so they cannot hide.

The negative-gearing producer's inputs now include, in addition to the availability fact from
Decision 17: **acquisition date measured against 12 May 2026 7:30pm**, **new-build status**, and
**post-1-July-2027 quarantining logic**.

### D24 — the growth allocation mode's premises shift

The relative attractiveness of asset location changes: individuals lose the 50% discount while super
funds and companies keep their treatment. The growth mode's scenarios must be built against the
regime applying in the projected period, not today's. **Scenario framing only — D24's compliance flag
on personal advice stands unchanged.**

## §3 The architectural consequence — REGIME versioning, not value versioning

**D12 is now insufficient.** "Every legislated constant comes from the tax-year config" was correct
for rates: a table can express *11.5% then 12%*. **It cannot express "50% discount before,
indexation-plus-minimum-rate after."** That is a change of *rule*, not of value.

**Requirement added to every tax quantity's Phase A contract: the config carries per-period RULES,
not merely per-period numbers.** A quantity whose method changes on a date must state both regimes
and the switchover, and its producer must resolve the regime from the period being computed — the
same discipline D33 applied to the SG rate, generalised from rates to methods.

This must land in the contracts. Discovering it during Tranche 4 would mean rebuilding the tax config
mid-programme.

## §4 What it means for Reza — established vs still needed

**Established:** Renew Group Holding Pty Ltd is a **company**, so its assets sit outside the new CGT
regime. His SMSF is a **superannuation fund**, likewise excluded — so it keeps 33⅓%. His six
properties, if acquired before 12 May 2026, are **grandfathered for negative gearing**. The CGT
change still reaches him through the deemed disposal, so post-2027 gains on personally-held assets
face indexation and the 30% floor.

**Facts needed from Reza (asked, not assumed):**
1. Was any property acquired **after 7:30pm on 12 May 2026**?
2. Does any property predate **20 September 1985**?
3. Does any qualify as a **new build**?

## §5 Coverage boundary

Verified: commencement date, announcement and grandfathering datetime, the indexation-plus-30%-floor
mechanic, the entity inclusion/exclusion list, the new-build and affordable-housing optionality, and
the pre-CGT reset. **Not verified:** the accrued-gain apportionment mechanics across the deemed
disposal — Baker McKenzie's note explicitly does not detail them, and the Matrix has not found a
source that does. **That must be established before the CGT tranche builds the transition**, and it is
not something to infer.

---
*Recorded by The Matrix, 30 July 2026. Sources: ATO new-legislation guidance on reforming negative
gearing and capital gains tax · Baker McKenzie, "Major changes to CGT and negative gearing"
(July 2026) · Corrs Chambers Westgarth, "Capital gains tax and negative gearing amendments".*
