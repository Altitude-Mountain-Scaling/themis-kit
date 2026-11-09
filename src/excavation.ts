/*
 * Excavation estimator — one file, no dependencies. Turns a visitor's job
 * description (what, how big, soil, access, where the dirt goes) into a
 * ballpark price range for a contractor's website.
 *
 * The method is the one contractor estimating software uses, cut down:
 *   size → bank cubic yards (in the ground)
 *        → loose cubic yards (swell: what the trucks carry)
 *        → machine hours (bucket × fill factor × cycles/hr × 50-minute hour)
 *        → truckloads and truck hours (load + round trip + dump)
 *        → dump tons × $/ton
 *   total = mobilization + machine + trucks + dump + extras, ≥ minimum charge
 *   range = total × lowFactor … total × highFactor (wider when there is rock)
 *
 * Every price lives in `Rates`. DEFAULT_RATES match the excavation trade pack
 * in Themis and the 2025–26 published ranges; give each client site its own
 * numbers. See docs/excavation-estimator-research.md for sources.
 *
 * It is a ballpark, not a quote: rock, groundwater, unmarked utilities and
 * permits are confirmed at the walkthrough.
 */

export type Project = "foundation" | "pool" | "trench" | "pad" | "grading" | "haul";
export type Soil = "sand" | "loam" | "clay" | "rocky" | "unknown";
export type Access = "tight" | "open" | "lot";

export type ExcavationInput = {
  project: Project;
  /** Feet. Foundation, pool, pad and grading use length × width; trench uses length only. */
  length: number;
  width?: number;
  /** Feet. Trenches and digs; grading and haul ignore it. */
  depth?: number;
  /** Haul only: cubic yards of dirt already in a pile. */
  pileYards?: number;
  soil: Soil;
  access: Access;
  /** "haul" trucks the spoils away; "spread" leaves them graded on site. */
  spoils: "haul" | "spread";
  /** Inches of gravel base over the footprint (pads, foundations). 0 for none. */
  gravelInches?: number;
  permit?: boolean;
  /** Miles one way to the dump or clean-fill site. */
  dumpMiles?: number;
  /** Foundation only: walls, footings and slabs. `depth` is then the wall height. */
  foundation?: Partial<FoundationSpec>;
};

/**
 * A house foundation, measured the way a takeoff reads a plan. Length and
 * width are to the OUTSIDE of the foundation walls. Inches where a plan
 * gives inches, feet where it gives feet.
 */
export type FoundationSpec = {
  length: number;
  width: number;
  /** Poured wall height, top of footing to top of wall (8 ft basement, 4 ft frost wall). */
  wallHeight: number;
  wallThicknessIn: number;
  footingWidthIn: number;
  footingDepthIn: number;
  /** Wall left showing above finished grade. */
  exposureFt: number;
  /** Working room dug past the outside of the wall, each side. */
  overdigFt: number;
  /** Side slope, feet out per foot down. Undefined: 1:1 past 5 ft deep (OSHA type B), vertical above. */
  slope?: number;
  /** Interior slab (basement or crawl floor) and the gravel under it. */
  slabIn: number;
  gravelIn: number;
  /** Garage or other slabs inside the building, sq ft, at slabIn thick. */
  extraInteriorSqFt: number;
  /** Driveway, walks, patio, aprons, sq ft. */
  exteriorSqFt: number;
  exteriorIn: number;
  /** Concrete ordered over the net yards. */
  waste: number;
};

export const DEFAULT_FOUNDATION: Omit<FoundationSpec, "length" | "width" | "wallHeight"> = {
  wallThicknessIn: 8,
  footingWidthIn: 20,
  footingDepthIn: 10,
  exposureFt: 1,
  overdigFt: 2,
  slabIn: 4,
  gravelIn: 4,
  extraInteriorSqFt: 0,
  exteriorSqFt: 0,
  exteriorIn: 4,
  waste: 0.05,
};

export type FoundationTakeoff = {
  /** Grade to bottom of footing. */
  digDepthFt: number;
  slope: number;
  /** In the ground, before it swells. */
  excavationYards: number;
  /** Compacted in place around the outside of the walls. */
  backfillYards: number;
  /** Native dirt (bank yards) the backfill uses up, after it compacts. */
  backfillDirtYards: number;
  /** Bank yards left over once backfill is done: what gets hauled or spread. */
  extraDirtYards: number;
  footingYards: number;
  wallYards: number;
  /** Footings + walls. */
  foundationYards: number;
  interiorSqFt: number;
  interiorYards: number;
  exteriorSqFt: number;
  exteriorYards: number;
  gravelYards: number;
  /** All concrete with waste, rounded up to the quarter yard a plant sells. */
  orderYards: number;
};

export type Machine = {
  label: string;
  bucketYards: number;
  cycleSeconds: number;
  hourly: number;
};

export type Rates = {
  machines: Record<Access, Machine>;
  /** Per machine delivery and pickup. */
  mobilization: number;
  /** Most contractors bill a 4-hour machine minimum. */
  minMachineHours: number;
  truckHourly: number;
  /** Trucks running at once; the machine waits on them when the haul is long. */
  trucks: number;
  truckYards: number;
  truckMph: number;
  dumpMinutes: number;
  dumpPerTon: number;
  gravelPerTon: number;
  fineGradingPerSqFt: number;
  permit: number;
  minimumCharge: number;
  lowFactor: number;
  highFactor: number;
  rockHighFactor: number;
};

export const DEFAULT_RATES: Rates = {
  machines: {
    tight: { label: "Mini excavator", bucketYards: 0.25, cycleSeconds: 16, hourly: 115 },
    open: { label: "Mid-size excavator", bucketYards: 0.75, cycleSeconds: 18, hourly: 165 },
    lot: { label: "Full-size excavator", bucketYards: 1.5, cycleSeconds: 20, hourly: 225 },
  },
  mobilization: 650,
  minMachineHours: 4,
  truckHourly: 125,
  trucks: 2,
  truckYards: 12,
  truckMph: 30,
  dumpMinutes: 8,
  dumpPerTon: 8, // clean fill; a landfill is $30–$50/ton
  gravelPerTon: 48,
  fineGradingPerSqFt: 0.65,
  permit: 350,
  minimumCharge: 750,
  lowFactor: 0.85,
  highFactor: 1.3,
  rockHighFactor: 1.7,
};

/**
 * Swell (bank → loose), shrink (bank → compacted), tons per bank yard, and
 * how fast the machine digs it. Textbook values; a geotech report wins.
 */
export const SOILS: Record<Soil, { label: string; swell: number; shrink: number; tonsPerYard: number; digSpeed: number }> = {
  sand: { label: "Sand or gravel", swell: 0.12, shrink: 0.05, tonsPerYard: 1.4, digSpeed: 1 },
  loam: { label: "Dirt / topsoil", swell: 0.25, shrink: 0.1, tonsPerYard: 1.3, digSpeed: 1 },
  clay: { label: "Clay", swell: 0.35, shrink: 0.15, tonsPerYard: 1.5, digSpeed: 0.85 },
  rocky: { label: "Rocky / cobble", swell: 0.4, shrink: 0.05, tonsPerYard: 1.6, digSpeed: 0.6 },
  unknown: { label: "Not sure", swell: 0.25, shrink: 0.1, tonsPerYard: 1.4, digSpeed: 0.9 },
};

const FILL_FACTOR = 0.9;
const FIFTY_MINUTE_HOUR = 50 / 60;
/** Working room dug past the walls, feet per side. */
const OVERDIG: Partial<Record<Project, number>> = { foundation: 2, pool: 1 };
/** Grading moves about 4 inches of dirt across the area. */
const GRADING_DEPTH_FT = 4 / 12;
const GRAVEL_TONS_PER_YARD = 1.4;

export type LineItem = { key: string; label: string; detail: string; amount: number };

export type ExcavationEstimate = {
  bankYards: number;
  /** Foundation jobs: the full takeoff (backfill, footings, walls, slabs). */
  takeoff?: FoundationTakeoff;
  looseYards: number;
  tons: number;
  machine: string;
  machineHours: number;
  truckloads: number;
  items: LineItem[];
  total: number;
  low: number;
  high: number;
  /** What moves this price, for the result screen. */
  notes: string[];
};

const round = (n: number, step = 1) => Math.round(Math.round(n / step) * step * 100) / 100;
const pos = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/**
 * The takeoff for a house foundation: excavation, backfill, footings, walls,
 * interior and exterior concrete.
 *
 *   dig depth   = wall height − exposure + footing depth (grade to bottom of footing)
 *   excavation  = pit with a flat bottom (L + 2·overdig) × (W + 2·overdig) and sides
 *                 sloped s:1 → V = A·D + s·D²·(Lb + Wb) + 4/3·s²·D³
 *   footings    = wall centerline perimeter × footing width × footing depth
 *   walls       = wall centerline perimeter × wall height × wall thickness
 *   backfill    = excavation − the building's box below grade (L × W × depth)
 *                 − the footing toe sticking out past the wall
 *   interior    = inside of the walls × slab thickness (+ garage etc.)
 *   exterior    = flatwork sq ft × thickness
 */
export function foundationTakeoff(
  spec: Partial<FoundationSpec> & Pick<FoundationSpec, "length" | "width" | "wallHeight">,
  soil: Soil = "loam",
): FoundationTakeoff {
  const f = { ...DEFAULT_FOUNDATION, ...spec };
  const L = pos(f.length);
  const W = pos(f.width);
  const t = pos(f.wallThicknessIn) / 12;
  const fw = pos(f.footingWidthIn) / 12;
  const fd = pos(f.footingDepthIn) / 12;
  const D = Math.max(0, pos(f.wallHeight) - pos(f.exposureFt) + fd);
  const s = typeof f.slope === "number" && f.slope >= 0 ? f.slope : D > 5 ? 1 : 0;

  const Lb = L + 2 * pos(f.overdigFt);
  const Wb = W + 2 * pos(f.overdigFt);
  const pit = Lb * Wb * D + s * D * D * (Lb + Wb) + (4 / 3) * s * s * D ** 3;

  // Walls sit flush with the outside line; their centerline runs t/2 inside it.
  const centerline = 2 * (L + W) - 4 * t;
  const footing = centerline * fw * fd;
  const wall = centerline * pos(f.wallHeight) * t;
  // Footing toe outside the wall, which backfill does not fill.
  const toe = Math.max(0, (fw - t) / 2);
  const toeVol = (2 * (L + W) + 4 * toe) * toe * fd;
  const backfill = Math.max(0, pit - L * W * D - toeVol);

  const interiorSqFt = Math.max(0, L - 2 * t) * Math.max(0, W - 2 * t);
  const allInterior = interiorSqFt + pos(f.extraInteriorSqFt);
  const interior = allInterior * (pos(f.slabIn) / 12);
  const exterior = pos(f.exteriorSqFt) * (pos(f.exteriorIn) / 12);
  const gravel = interiorSqFt * (pos(f.gravelIn) / 12);

  const backfillDirt = backfill / (1 - SOILS[soil].shrink);
  const concrete = (footing + wall + interior + exterior) / 27;
  const y = (n: number) => round(n / 27, 0.1);
  return {
    digDepthFt: round(D, 0.01),
    slope: s,
    excavationYards: y(pit),
    backfillYards: y(backfill),
    backfillDirtYards: y(backfillDirt),
    extraDirtYards: y(Math.max(0, pit - backfillDirt)),
    footingYards: y(footing),
    wallYards: y(wall),
    foundationYards: y(footing + wall),
    interiorSqFt: Math.round(allInterior),
    interiorYards: y(interior),
    exteriorSqFt: Math.round(pos(f.exteriorSqFt)),
    exteriorYards: y(exterior),
    gravelYards: y(gravel),
    orderYards: Math.ceil(concrete * (1 + pos(f.waste)) * 4) / 4,
  };
}

/** The foundation spec an estimator input describes. */
function foundationOf(i: ExcavationInput) {
  return { ...i.foundation, length: pos(i.length), width: pos(i.width), wallHeight: pos(i.depth) || 4 };
}

/** Cubic yards in the ground. */
export function bankYards(i: ExcavationInput): number {
  const L = pos(i.length);
  const W = pos(i.width);
  const D = pos(i.depth);
  const over = OVERDIG[i.project] ?? 0;
  switch (i.project) {
    case "foundation":
      return foundationTakeoff(foundationOf(i), i.soil).excavationYards;
    case "pool":
      return ((L + 2 * over) * (W + 2 * over) * D) / 27;
    case "trench":
      return (L * (W || 2) * D) / 27;
    case "pad":
      return (L * W * (D || 1)) / 27;
    case "grading":
      return (L * W * GRADING_DEPTH_FT) / 27;
    case "haul":
      // A pile is already loose; express it in bank yards so the swell math is one path.
      return pos(i.pileYards) / (1 + SOILS[i.soil].swell);
  }
}

export function estimateExcavation(i: ExcavationInput, rates: Rates = DEFAULT_RATES): ExcavationEstimate {
  const soil = SOILS[i.soil];
  const m = rates.machines[i.access];
  const bank = bankYards(i);
  const loose = bank * (1 + soil.swell);
  const takeoff = i.project === "foundation" ? foundationTakeoff(foundationOf(i), i.soil) : undefined;
  // A foundation keeps enough dirt to backfill the walls; only the rest leaves.
  const haulBank = takeoff ? takeoff.extraDirtYards : bank;
  const haulLoose = haulBank * (1 + soil.swell);
  const tons = haulBank * soil.tonsPerYard;

  // Loose yards an hour the machine moves. Loading an existing pile is faster than digging.
  const perHour =
    m.bucketYards * FILL_FACTOR * (3600 / m.cycleSeconds) * FIFTY_MINUTE_HOUR * (i.project === "haul" ? 1.3 : soil.digSpeed);
  let hours = loose / perHour;
  if (i.project === "trench") hours *= 1.6; // dig, then backfill and compact the same dirt
  if (i.spoils === "spread" && i.project !== "trench") hours *= 1.4; // push it out and grade it
  // Backfill: load from the pile, place in lifts and compact. Slower than digging.
  const backfillHours = takeoff ? (takeoff.backfillDirtYards * (1 + soil.swell)) / (perHour * 0.6) : 0;

  // Trench spoils go back in the trench; grading spreads them. Everything else can be trucked.
  const trucked = i.spoils === "haul" && i.project !== "trench" && i.project !== "grading";
  const miles = pos(i.dumpMiles) || 10;
  const loads = trucked ? Math.ceil(haulLoose / rates.truckYards) : 0;
  const loadMin = (rates.truckYards / perHour) * 60;
  const cycleMin = loadMin + ((2 * miles) / rates.truckMph) * 60 + rates.dumpMinutes;
  const truckHours = (loads * cycleMin) / 60;
  // The machine is on the clock until the last truck is loaded.
  hours = Math.max(rates.minMachineHours, hours, truckHours / Math.max(1, rates.trucks));

  const items: LineItem[] = [];
  const add = (key: string, label: string, detail: string, amount: number) => {
    if (amount > 0) items.push({ key, label, detail, amount: round(amount) });
  };

  add("mobilize", "Equipment delivery", `${m.label}, delivered and picked up`, rates.mobilization);
  add("machine", "Digging", `${m.label}, about ${round(hours, 0.5)} hrs at $${m.hourly}/hr`, hours * m.hourly);
  if (takeoff) {
    add("backfill", "Backfill and compaction", `${takeoff.backfillYards} yd³ around the walls, about ${round(backfillHours, 0.5)} hrs`, backfillHours * m.hourly);
  }
  if (trucked) {
    add("trucking", "Trucking", `${loads} load${loads === 1 ? "" : "s"}, ${miles} mi to the dump`, truckHours * rates.truckHourly);
    add("dump", "Dump fees", `About ${round(tons)} tons at $${rates.dumpPerTon}/ton`, tons * rates.dumpPerTon);
  }

  const footprint = pos(i.length) * pos(i.width);
  if (i.project === "grading") {
    add("fine", "Fine grading", `${round(footprint, 10).toLocaleString("en-US")} sq ft at $${rates.fineGradingPerSqFt}`, footprint * rates.fineGradingPerSqFt);
  }
  const gravelIn = pos(i.gravelInches);
  if (gravelIn && (i.project === "pad" || i.project === "foundation")) {
    // Under a foundation the gravel goes inside the walls, under the slab.
    const area = takeoff ? takeoff.interiorSqFt - pos(i.foundation?.extraInteriorSqFt) : footprint;
    const gTons = ((area * (gravelIn / 12)) / 27) * GRAVEL_TONS_PER_YARD;
    add("gravel", "Gravel base", `${gravelIn}" over ${round(area).toLocaleString("en-US")} sq ft, about ${round(gTons)} tons`, gTons * rates.gravelPerTon);
  }
  if (i.permit) add("permit", "Permit", "Pulled and scheduled for you", rates.permit);

  const subtotal = items.reduce((s, x) => s + x.amount, 0);
  const total = Math.max(rates.minimumCharge, subtotal);
  const rock = i.soil === "rocky" || i.soil === "unknown";
  const high = total * (rock ? rates.rockHighFactor : rates.highFactor);

  const notes: string[] = [];
  if (rock) notes.push("Rock is the biggest unknown. Hitting ledge can double the digging time.");
  if (i.access === "tight") notes.push("Tight access means a mini excavator: smaller bucket, more hours.");
  if (loads > 0) notes.push(`Distance to the dump matters: ${loads} truckload${loads === 1 ? "" : "s"} at ${miles} mi each way.`);
  if (i.spoils === "spread") notes.push("Keeping the dirt on site saves the trucking and dump fees.");
  if (total === rates.minimumCharge) notes.push(`Small job: the $${rates.minimumCharge} minimum applies.`);
  notes.push("Utilities are marked (811) before any digging.");

  return {
    bankYards: round(bank, 0.1),
    takeoff,
    looseYards: round(loose, 0.1),
    tons: round(tons, 0.1),
    machine: m.label,
    machineHours: round(hours, 0.5),
    truckloads: loads,
    items,
    total: round(total, 10),
    low: round(total * rates.lowFactor, 50),
    high: round(high, 50),
    notes,
  };
}

/** One line for the lead's `message` in Themis, e.g. for deliverLead(). */
export function estimateSummary(i: ExcavationInput, e: ExcavationEstimate): string {
  const usd = (n: number) => "$" + n.toLocaleString("en-US");
  const size =
    i.project === "haul"
      ? `${pos(i.pileYards)} yd pile`
      : i.project === "trench"
        ? `${pos(i.length)} ft × ${pos(i.depth)} ft deep`
        : `${pos(i.length)}×${pos(i.width)}${i.depth ? `×${pos(i.depth)}` : ""} ft`;
  return `Estimator: ${i.project} ${size}, ${SOILS[i.soil].label.toLowerCase()}, ${i.access} access, ${
    i.spoils === "haul" ? "haul off" : "spread on site"
  } — ${usd(e.low)}–${usd(e.high)} (${e.bankYards} yd³)`;
}
