// AI : generate Estimate Intelligence fixtures — structured assessments + denormalized past jobs.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(SCRIPT_DIR, "../documents/estimate_intelligence");

const BUILDER_PRIME = "bld-prime-north";
const BUILDER_OTHER = "bld-south-repairs";

type WorkItem = {
  id: string;
  code: string;
  trade: string;
  unit: string;
  unit_rate: number;
  description: string;
};

type BilledLine = {
  work_item_id: string;
  code: string;
  trade: string;
  description: string;
  unit: string;
  quantity: number;
  unit_rate: number;
};

type PastJob = {
  id: string;
  builder_id: string;
  title: string;
  peril: string;
  construction: string;
  storeys: number;
  rooms_affected: string;
  narrative: string;
  billed_lines: BilledLine[];
};

type Assessment = {
  builder_id: string;
  peril: string;
  construction: string;
  storeys: number;
  rooms_affected: string;
  narrative: string;
  coverage_note: string;
};

type TradeRow = { code: string; unit: string; unit_rate: number; description: string };

const TRADE_ORDER = [
  "plumbing",
  "electrical",
  "roofing",
  "flooring",
  "drywall",
  "painting",
  "demolition",
  "mitigation",
  "cabinetry",
  "structural",
] as const;

const TRADE_PREFIX: Record<(typeof TRADE_ORDER)[number], string> = {
  plumbing: "PLB",
  electrical: "ELC",
  roofing: "ROF",
  flooring: "FLR",
  drywall: "DRW",
  painting: "PNT",
  demolition: "DEM",
  mitigation: "MIT",
  cabinetry: "CAB",
  structural: "STR",
};

const TRADE_ROWS: Record<(typeof TRADE_ORDER)[number], TradeRow[]> = {
  plumbing: [
    { code: "ISO-001", unit: "each", unit_rate: 95, description: "Isolate water supply to upstairs bathroom suite" },
    { code: "RPR-002", unit: "each", unit_rate: 145, description: "Repair burst flexi hose at vanity basin" },
    { code: "SWR-003", unit: "each", unit_rate: 220, description: "Re-seal shower waste and pressure test tray" },
    { code: "TAP-004", unit: "each", unit_rate: 280, description: "Replace leaking mixer tap — ensuite" },
    { code: "PIPE-007", unit: "lm", unit_rate: 85, description: "Reroute copper feed line in wall cavity" },
  ],
  electrical: [
    { code: "ISO-001", unit: "each", unit_rate: 165, description: "Isolate and tag circuits in wet-area bathroom" },
    { code: "GPO-002", unit: "each", unit_rate: 190, description: "Replace water-damaged GPO — kitchen bench" },
    { code: "LED-003", unit: "each", unit_rate: 85, description: "Supply and install LED downlight — living" },
    { code: "SMK-006", unit: "each", unit_rate: 240, description: "Replace interconnected smoke alarm (hardwired)" },
  ],
  roofing: [
    { code: "TIL-001", unit: "each", unit_rate: 38, description: "Replace broken concrete roof tile" },
    { code: "RID-002", unit: "lm", unit_rate: 55, description: "Reseal ridge capping with flexible pointing" },
    { code: "VLY-003", unit: "lm", unit_rate: 95, description: "Replace corroded valley flashing" },
    { code: "EP-009", unit: "each", unit_rate: 480, description: "Erect edge protection — single storey" },
    { code: "FLS-005", unit: "each", unit_rate: 210, description: "Install lead flashing at chimney abutment" },
  ],
  flooring: [
    { code: "MST-001", unit: "each", unit_rate: 120, description: "Moisture content testing — timber subfloor" },
    { code: "SND-002", unit: "m2", unit_rate: 72, description: "Sand and recoat cupped timber floorboards — affected zone" },
    { code: "BRD-003", unit: "m2", unit_rate: 145, description: "Replace crowned timber boards after drying period" },
  ],
  drywall: [
    { code: "SH-001", unit: "m2", unit_rate: 68, description: "Install 13mm plasterboard to kitchen ceiling" },
    { code: "JT-002", unit: "m2", unit_rate: 42, description: "Tape and joint ceiling sheets — Level 4 finish" },
    { code: "SH-003", unit: "m2", unit_rate: 55, description: "Line internal wall — standard 10mm board" },
    { code: "NCH-005", unit: "each", unit_rate: 95, description: "Patch nib wall after doorway relocation" },
  ],
  painting: [
    { code: "CLG-001", unit: "m2", unit_rate: 28, description: "Prime and paint kitchen ceiling — two coats" },
    { code: "WAL-002", unit: "m2", unit_rate: 24, description: "Wash, prep and paint internal walls — living" },
    { code: "STN-008", unit: "m2", unit_rate: 32, description: "Block stain and spot prime water marks" },
    { code: "EXT-003", unit: "m2", unit_rate: 36, description: "Repaint weatherboard exterior — front elevation" },
  ],
  demolition: [
    { code: "CLG-001", unit: "m2", unit_rate: 48, description: "Remove collapsed plasterboard ceiling — kitchen below bathroom" },
    { code: "STR-002", unit: "m2", unit_rate: 52, description: "Strip water-damaged drywall to studs — wet line" },
    { code: "DEBRIS-006", unit: "each", unit_rate: 180, description: "Load and dispose wet plaster and floor waste" },
  ],
  mitigation: [
    { code: "DHM-001", unit: "each", unit_rate: 95, description: "Place industrial dehumidifier — affected zone" },
    { code: "FAN-002", unit: "day", unit_rate: 45, description: "Air mover hire — drying period" },
    { code: "MON-003", unit: "each", unit_rate: 75, description: "Moisture mapping and daily readings" },
  ],
  cabinetry: [
    { code: "REM-001", unit: "each", unit_rate: 420, description: "Remove existing kitchen cabinetry and benchtops" },
    { code: "SUP-002", unit: "lm", unit_rate: 380, description: "Supply and install flat-pack base cabinets" },
  ],
  structural: [
    { code: "JST-001", unit: "each", unit_rate: 310, description: "Replace water-damaged ceiling joist — kitchen" },
    { code: "CHK-002", unit: "each", unit_rate: 180, description: "Structural inspection of wet framing" },
    { code: "DECK-004", unit: "m2", unit_rate: 290, description: "Hardwood decking on screw piles" },
  ],
};

function idByTradeIndex(trade: (typeof TRADE_ORDER)[number], indexInTrade: number): string {
  const tradeIdx = TRADE_ORDER.indexOf(trade);
  const n = tradeIdx * 10 + indexInTrade;
  return `WI-${String(n).padStart(5, "0")}`;
}

function buildCatalog(): WorkItem[] {
  const items: WorkItem[] = [];
  for (const trade of TRADE_ORDER) {
    TRADE_ROWS[trade].forEach((row, i) => {
      items.push({
        id: idByTradeIndex(trade, i + 1),
        code: `${TRADE_PREFIX[trade]}-${row.code}`,
        trade,
        unit: row.unit,
        unit_rate: row.unit_rate,
        description: row.description,
      });
    });
  }
  return items;
}

function line(
  catalog: Map<string, WorkItem>,
  trade: (typeof TRADE_ORDER)[number],
  indexInTrade: number,
  quantity: number,
): BilledLine {
  const item = catalog.get(idByTradeIndex(trade, indexInTrade));
  if (!item) throw new Error(`missing catalog ${trade} #${indexInTrade}`);
  return {
    work_item_id: item.id,
    code: item.code,
    trade: item.trade,
    description: item.description,
    unit: item.unit,
    quantity,
    unit_rate: item.unit_rate,
  };
}

function buildJobs(catalog: Map<string, WorkItem>): PastJob[] {
  const L = (trade: (typeof TRADE_ORDER)[number], indexInTrade: number, quantity: number) =>
    line(catalog, trade, indexInTrade, quantity);

  return [
    {
      id: "job-bathroom-ceiling-collapse",
      builder_id: BUILDER_PRIME,
      title: "Upstairs bathroom leak — kitchen ceiling collapse",
      peril: "escape of water",
      construction: "brick veneer",
      storeys: 2,
      rooms_affected: "ensuite, kitchen",
      narrative:
        "Water escaped from an upstairs ensuite. Plasterboard ceiling in the kitchen below failed and fell. Timber joists were wet; insurer requested drying before rebuild.",
      billed_lines: [
        L("plumbing", 1, 1),
        L("plumbing", 2, 1),
        L("demolition", 1, 12),
        L("mitigation", 1, 2),
        L("mitigation", 2, 14),
        L("mitigation", 3, 12),
        L("structural", 1, 2),
        L("drywall", 1, 12),
        L("drywall", 2, 12),
        L("painting", 1, 12),
      ],
    },
    {
      id: "job-slow-leak-cupping",
      builder_id: BUILDER_PRIME,
      title: "Slow bathroom leak — cupped timber floor",
      peril: "escape of water",
      construction: "brick veneer",
      storeys: 2,
      rooms_affected: "bathroom, hallway",
      narrative:
        "Long-term leak at shower screen. Kitchen ceiling stained but intact; hallway timber flooring cupped. Scope focused on leak rectification, drying, and floor restoration.",
      billed_lines: [
        L("plumbing", 3, 1),
        L("electrical", 1, 1),
        L("flooring", 1, 1),
        L("flooring", 2, 14),
        L("flooring", 3, 1),
        L("mitigation", 1, 1),
        L("mitigation", 2, 7),
        L("painting", 3, 6),
      ],
    },
    {
      id: "job-bathroom-stack-failure",
      builder_id: BUILDER_PRIME,
      title: "Bathroom stack leak — multi-room water damage",
      peril: "escape of water",
      construction: "weatherboard",
      storeys: 2,
      rooms_affected: "bathroom, kitchen, laundry",
      narrative:
        "Failed waste connection in upstairs bathroom affected kitchen ceiling and laundry wall. Full strip of wet linings, structural check, and phased reinstatement.",
      billed_lines: [
        L("plumbing", 1, 1),
        L("plumbing", 5, 3),
        L("demolition", 1, 8),
        L("demolition", 2, 16),
        L("mitigation", 1, 2),
        L("structural", 2, 1),
        L("drywall", 1, 8),
        L("drywall", 3, 16),
        L("painting", 1, 8),
        L("painting", 2, 16),
      ],
    },
    {
      id: "job-roof-tile-storm",
      builder_id: BUILDER_PRIME,
      title: "Roof storm damage — tile and flashing",
      peril: "storm",
      construction: "brick veneer",
      storeys: 1,
      rooms_affected: "roof, bedroom",
      narrative:
        "Hail and wind lifted tiles on north slope. Minor ceiling staining in bedroom; primary scope is roof make-safe and tile replacement.",
      billed_lines: [
        L("roofing", 4, 1),
        L("roofing", 1, 18),
        L("roofing", 2, 12),
        L("roofing", 3, 6),
        L("painting", 3, 4),
      ],
    },
    {
      id: "job-roof-valley-leak",
      builder_id: BUILDER_PRIME,
      title: "Valley flashing leak — patch ceiling stain only",
      peril: "storm",
      construction: "brick veneer",
      storeys: 1,
      rooms_affected: "roof, bedroom",
      narrative:
        "Active roof leak at valley during heavy rain. Roofer replaced flashing; internal works limited to stain block and ceiling touch-up where leak tracked.",
      billed_lines: [
        L("roofing", 3, 8),
        L("roofing", 5, 1),
        L("painting", 3, 3),
        L("drywall", 4, 2),
      ],
    },
    {
      id: "job-hail-roof",
      builder_id: BUILDER_PRIME,
      title: "Hail strike — tile field and ridge",
      peril: "hail",
      construction: "weatherboard",
      storeys: 1,
      rooms_affected: "roof",
      narrative: "Severe hail cracked a tile field on the street elevation. No internal water ingress. Make-safe and replace broken tiles.",
      billed_lines: [L("roofing", 4, 1), L("roofing", 1, 42), L("roofing", 2, 18)],
    },
    {
      id: "job-kitchen-cabinet-refresh",
      builder_id: BUILDER_PRIME,
      title: "Kitchen renovation — cabinetry and bench",
      peril: "owner upgrade",
      construction: "brick veneer",
      storeys: 1,
      rooms_affected: "kitchen",
      narrative: "Owner upgrade: new flat-pack kitchen, stone bench, and connections. No water damage; bathroom and ceilings out of scope.",
      billed_lines: [L("cabinetry", 1, 1), L("cabinetry", 2, 6), L("plumbing", 4, 1), L("electrical", 3, 4)],
    },
    {
      id: "job-exterior-repaint",
      builder_id: BUILDER_PRIME,
      title: "Whole-house exterior repaint",
      peril: "owner upgrade",
      construction: "weatherboard",
      storeys: 1,
      rooms_affected: "exterior",
      narrative: "Wash down, scrape, and repaint weatherboard elevations including trims and fascia. No insurance claim.",
      billed_lines: [L("painting", 4, 180)],
    },
    {
      id: "job-deck-extension",
      builder_id: BUILDER_PRIME,
      title: "Timber deck extension — rear yard",
      peril: "owner upgrade",
      construction: "weatherboard",
      storeys: 1,
      rooms_affected: "exterior",
      narrative: "New hardwood deck on screw piles with balustrade; unrelated to internal water claims.",
      billed_lines: [L("structural", 3, 12), L("painting", 4, 8)],
    },
    {
      id: "job-gpo-kitchen-accidental",
      builder_id: BUILDER_PRIME,
      title: "Kitchen GPO — accidental damage",
      peril: "accidental damage",
      construction: "brick veneer",
      storeys: 1,
      rooms_affected: "kitchen",
      narrative: "Impact damage to a kitchen bench GPO. Replace outlet only; no water or ceiling works.",
      billed_lines: [L("electrical", 2, 1)],
    },
    {
      id: "job-other-builder-bathroom",
      builder_id: BUILDER_OTHER,
      title: "Ensuite leak — other builder price book",
      peril: "escape of water",
      construction: "brick veneer",
      storeys: 2,
      rooms_affected: "ensuite, kitchen",
      narrative:
        "Same damage pattern as a bathroom leak with ceiling collapse, but billed on another builder's rates and methods. Must not leak into this tenant's estimate.",
      billed_lines: [
        L("plumbing", 1, 1),
        L("demolition", 1, 10),
        L("drywall", 1, 10),
        L("painting", 1, 10),
      ],
    },
    {
      id: "job-other-builder-deck",
      builder_id: BUILDER_OTHER,
      title: "Deck rebuild — other builder",
      peril: "owner upgrade",
      construction: "weatherboard",
      storeys: 1,
      rooms_affected: "exterior",
      narrative: "Unrelated deck job from another repairer network.",
      billed_lines: [L("structural", 3, 8)],
    },
  ];
}

const BATHROOM_ASSESSMENT: Assessment = {
  builder_id: BUILDER_PRIME,
  peril: "escape of water",
  construction: "brick veneer",
  storeys: 2,
  rooms_affected: "ensuite, kitchen",
  narrative:
    "Water leaked from the upstairs bathroom suite. The kitchen ceiling below collapsed and the timber floor is cupping.",
  coverage_note: "Sudden escape of water is covered. Wear and tear and owner upgrades are excluded.",
};

const STORM_ASSESSMENT: Assessment = {
  builder_id: BUILDER_PRIME,
  peril: "storm",
  construction: "brick veneer",
  storeys: 1,
  rooms_affected: "roof, bedroom",
  narrative:
    "Overnight storm lifted tiles on the north roof slope. Bedroom ceiling has water stains. No bathroom or kitchen involvement.",
  coverage_note: "Storm damage to the roof is covered. Cosmetic matching of undamaged elevations is excluded.",
};

function writeJson(relativePath: string, value: unknown): void {
  const path = join(OUT_DIR, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote ${relativePath}`);
}

function main(): void {
  const items = buildCatalog();
  const catalog = new Map(items.map((i) => [i.id, i]));
  const jobs = buildJobs(catalog);
  if (jobs.length !== 12) throw new Error(`expected 12 jobs, got ${jobs.length}`);
  for (const job of jobs) {
    if (!job.billed_lines.length) throw new Error(`${job.id} has no billed_lines`);
    for (const bl of job.billed_lines) {
      if (!catalog.has(bl.work_item_id)) throw new Error(`unknown ${bl.work_item_id} in ${job.id}`);
    }
  }
  mkdirSync(OUT_DIR, { recursive: true });
  writeJson("past_job_library.json", jobs);
  writeJson("bathroom_leak_assessment.json", BATHROOM_ASSESSMENT);
  writeJson("roof_storm_assessment.json", STORM_ASSESSMENT);
  console.log(`jobs: ${jobs.length}; catalog rows used internally: ${items.length}`);
}

main();
