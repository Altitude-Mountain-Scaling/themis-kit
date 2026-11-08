# Excavation estimator: research and plan

Research for a website estimator an excavation contractor (Gutvil first) can
put on their site: the visitor describes the job and gets a price range back.
They then book a free walkthrough, and the lead lands in Themis through this
kit. The design borrows what the popular estimators do (HomeGuide,
Angi/HomeAdvisor, Homewyse, the Inch/Omni-style volume calculators, and the
contractor tools InSite, AGTEK, Kubla Cubed, HCSS HeavyBid). It borrows their
inputs, formulas and form flow, not their code, copy or branding.

> **How sure these numbers are.** The price figures come from search-result
> snippets (late 2025 to 2026). This session's network blocked HomeGuide, Angi
> and Engineering Toolbox, so their full pages weren't read. The soil factors
> are standard textbook values. Before going live, check every default against
> the contractor's own prices.

## 1. What the popular estimators do

### Consumer cost guides (HomeGuide, Angi/HomeAdvisor, Homewyse, Bob Vila)

| Item | Published range |
| --- | --- |
| Typical total job | $1,100–$6,700 (HomeAdvisor average ≈ $3,980) |
| Dig only, per cubic yard (CY) | $2.50–$15/CY machine time on easy dirt (HomeGuide) |
| All-in per CY on small jobs | $50–$200 (Angi), $108–$247 (Homewyse) |
| Haul-off | $8–$25/CY, or $200–$500 per 15-CY tri-axle load |
| Dump / tipping fee | $30–$50/ton at a landfill; $3–$8/ton or free at a clean-fill site |
| Excavator with operator | $100–$300/hr |
| Minimum job | $500–$800 |
| Rock | $50–$250/CY; blasting $40–$100/CY; can double or triple a basement dig |
| Permits | $150–$3,000 ($500–$2,000 for utility trenches) |
| Trenching | $5–$12/ft standard, $13–$40/ft rocky or deep |
| Pool dig | $500–$3,000 typical, up to $10k |
| Basement (new construction) | $1,500–$10,000 |
| Grading | $0.50–$2.00/sq ft |
| Land clearing | $500–$8,000/acre |

**Why the per-CY numbers disagree by 10× or more:** some figures are digging
only, while others include mobilization, trucking, dump fees and minimum
charges. The estimator should therefore price each piece separately and add
them up, never use one blended "$/CY" rate.

### Volume calculators (Inch Calculator, Omni style)

**Inputs:**
- shape (rectangle, circle, trench)
- length, width and depth
- side slope (optional)
- soil type
- truck size
- price per CY or per hour

**Outputs:**
- volume in the ground (bank CY)
- volume once dug (loose CY)
- number of truckloads
- weight in tons
- cost range

A common bug in these calculators: they skip swell, the growth of soil once
it's dug. That undercounts trucks by 25–40%.

### Contractor software (InSite, AGTEK, Kubla Cubed, HeavyBid, B2W)

- **Takeoff tools** (InSite, AGTEK, Kubla) get quantities from plans or survey
  data. They compare existing ground to the design on a grid, or with average
  end areas along a line.
- **Estimating tools** (HeavyBid, B2W) price those quantities with **crews**:
  equipment plus labor dollars per hour, divided by production per hour, gives
  dollars per CY. They add mobilization, disposal, permits and markup on top.

The website estimator is a cut-down version of the second kind.

## 2. The math

All lengths are in feet; 27 cu ft = 1 CY.

```
Volume, box:            BCY = L × W × D / 27
Volume, sloped walls:   BCY = D/3 × (A_top + A_bot + √(A_top·A_bot)) / 27
Trench:                 BCY = length × width × depth / 27
Linear work, cut/fill:  BCY = (A1 + A2)/2 × L / 27          (average end area)

Loose (what trucks carry):   LCY = BCY × (1 + swell)
Compacted (as fill):         CCY = BCY × (1 − shrink)
Weight:                      tons ≈ BCY × density (≈ 1.2–1.5 t/BCY by soil)

Excavator output:  LCY/hr = bucket CY × fill factor × (3600 / cycle sec) × 0.83
Machine hours:     hrs = LCY / (LCY/hr), at least the 4-hour minimum
Truckloads:        loads = ceil(LCY / truck CY)
Truck hours:       loads × (load + drive there + dump + drive back) / 60
Dump cost:         tons × $/ton   (0 if the dirt is spread on site)

Total = mobilization + machine $ + truck $ + dump $ + extras (gravel, permit)
        × access factor × rock factor, then at least the minimum charge
Range = Total × 0.85 (low)  to  Total × 1.30 (high)   (skewed up for rock risk)
```

The 0.83 in the excavator formula is the "50-minute hour": a machine does
about 50 minutes of useful work per hour. Worked example: a 1.5-CY bucket ×
0.9 fill × 180 cycles/hr × 0.83 ≈ 200 LCY/hr. A mini-ex with a 0.25-CY bucket
manages ≈ 30 LCY/hr.

### Soil factors (textbook defaults; the contractor can override them)

| Soil | Swell | Shrink when compacted | Tons per BCY |
| --- | --- | --- | --- |
| Sand / gravel | 12% | 5% | 1.4 |
| Loam / topsoil / common earth | 25% | 10% | 1.3 |
| Clay | 35% | 15% | 1.5 |
| Rocky / cobble (typical in the Colorado mountains) | 40% | — | 1.6 |
| Blasted rock | 50–65% | none (rock bulks up even compacted) | 1.8 |
| "Not sure" | 25% | 10% | 1.4 |

### Machine choice by site access

| Access | Machine | Bucket | With operator | Price effect |
| --- | --- | --- | --- | --- |
| Gate or tight backyard (under 6 ft wide) | Mini-ex / skid steer | 0.25 CY | $90–$120/hr | +15–30% (slower) |
| Open yard | 8–14 t excavator | 0.75 CY | $130–$180/hr | — |
| Open lot, big volume | 20 t+ excavator | 1.5 CY | $180–$300/hr | — |

Other planning numbers:
- **Dump truck:** $100–$150/hr with driver, 10–14 CY per load.
- **Mobilization:** $500–$2,000 per machine per trip.

## 3. The form flow (what the popular lead-gen estimators share)

One question per screen on phones, with a progress bar, done in under 2
minutes:

1. **Project type** (cards):
   - basement / foundation
   - pool
   - trench (water, sewer, electric)
   - driveway / pad
   - grading / drainage
   - land clearing
   - dirt haul-off
2. **Size**: presets ("16×32 pool", "30×40 foundation") or exact dimensions,
   with an "I'm not sure" option. Trench jobs ask for length and depth only.
3. **Soil**: sand, loam, clay, rocky, or not sure.
4. **Access**: tight gate, open yard, or open lot.
5. **Dirt**: haul it off, or spread it on site.
6. **Extras**:
   - gravel base
   - backfill and compaction
   - permit
   - tree or stump removal
7. **Result**: shown without asking for contact details first. Building trust
   is the point.
   - The result is a **low–high range** with a short breakdown: digging,
     trucking, dump fees and mobilization.
   - It lists "what moves your price" (rock, access, how far to the dump).
   - The disclaimer reads: "Ballpark only. Rock, groundwater and unmarked
     utilities are priced at the walkthrough."
8. **Book a free walkthrough** (the one CTA). The form fields are:
   - name
   - **phone (required)**
   - email
   - address or town
   - a photo
   - timeline

The common hybrid among the competitors: the range is free, and the firm quote
or the itemized PDF costs a phone number.

## 4. How it fits AMS and Themis

- **Default prices** come from the excavation trade pack Themis already ships
  (`apps/themis/src/lib/money/trade-packs.ts`, AMS repo):
  - mobilization $650
  - excavation $18/CY
  - haul-off $22/CY
  - gravel $48/ton
  - fine grading $0.65/sq ft
  - trenching $14/ft
  - machine time $165/hr

  These sit inside the published ranges above. Each client site overrides
  them with the contractor's real numbers.
- **The client site** builds it from the playbook's `components/Estimator.tsx`.
  Per the client-site playbook: "the job's size and type to a ballpark range,
  with a free walkthrough as the next step". The same playbook's design,
  motion and viewport checks apply.
- **The lead.** The walkthrough form follows playbook rule 20:
  - phone required in the browser and again on the server
  - the SMS consent box unticked, with Themis's wording word for word
  - the lead sent to Themis with `deliverLead()` from `src/themis.ts`

  Put the estimate in `message` so the owner sees it in Leads, e.g.
  `"Estimator: pool 16×32×6, clay, open yard, haul-off — $6,900–$10,500"`.
  Or use `createAppointment()` to book the walkthrough straight onto the
  calendar (see the `booking-for-ams` branch).
- **Themis estimate** (later): the same line items (mobilize, excavate, haul,
  gravel, machine hours) can pre-fill a Themis estimate draft for the lead. The
  owner then edits it into a real quote after the walkthrough.

## 5. Suggested build order

1. A pure `estimateExcavation(inputs, rates)` function with the math in
   section 2. It has no UI and gets unit tests for each project type. It
   belongs in this kit (`src/excavation.ts`), so any client site can copy it
   in with zero dependencies, like `themis.ts`.
2. The step-by-step estimator component on the Gutvil site, using Gutvil's
   rates.
3. The walkthrough form, sending the lead to Themis with the estimate attached.
4. Later: tune the range from real outcomes, comparing quoted jobs to the
   estimator's number.

## Sources

- **Cost guides:**
  - HomeGuide: homeguide.com/costs/excavation-cost
  - Angi: angi.com/articles/excavation-costs.htm, angi.com/articles/trenching-cost.htm
  - HomeAdvisor: homeadvisor.com/cost/landscape/excavate-land
  - Homewyse: homewyse.com/services/cost_to_excavate_land.html
  - Bob Vila: bobvila.com/articles/excavation-cost
  - This Old House: thisoldhouse.com/foundations/cost-to-dig-out-a-basement
  - Fixr: fixr.com/costs/land-clearing-and-building-site-preparation
- **Rates:**
  - Angi excavator rental prices
  - BigRentz backhoe rental
  - Caltrans equipment rates
  - otrucking.com lowboy rates
  - dumpsters.com dirt disposal
- **Soil factors:**
  - Cat "swell and void percentage load factors"
  - projectengineer.net swell factors
  - Engineering Toolbox bulking factors
  - Iowa DOT shrinkage-factor study
- **Methods:**
  - LibreTexts "Earthwork"
  - Kubla Software grid-method spreadsheet
  - KSU construction-equipment course notes (production and haul cycle)
- **Software:**
  - InSite Elevation (softwareconnect, Capterra)
  - AGTEK Sitework 4D
  - HCSS HeavyBid help
  - B2W vs HCSS comparison
- **Lead-gen form flow:** orbitforms.ai contractor quote forms, leadquizzes
  cost-estimator template
