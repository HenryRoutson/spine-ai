// AI : generate document fixtures for billed_work_catalog_select — work catalog + job library.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(SCRIPT_DIR, "../documents/billed_work_catalog_select");

const WORK_DESCRIPTION =
  "Water leaked from the upstairs bathroom suite. The kitchen ceiling below collapsed and the timber floor is cupping.";

type WorkItem = {
  id: string;
  code: string;
  trade: string;
  unit: string;
  description: string;
};

type JobExample = {
  id: string;
  title: string;
  work_description: string;
  // AI : TODO (example-select-view) — keep billed_items on the library/spine; do not inline catalog rows here.
  // AI : TODO (type-join) — work_item_id is fk → WorkItem.id; expand only as a prompt/context view (pass 2 / draft).
  // AI : TODO (sql-schema) — job_example + billed_line (job_id FK, work_item_id FK) + work_item. Nested JSON is a view.
  billed_items: { work_item_id: string; quantity: number }[];
};

type TradeRow = { code: string; unit: string; description: string };

const TRADE_PREFIX: Record<string, string> = {
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

const TRADE_ROWS: Record<string, TradeRow[]> = {
  plumbing: [
    { code: "ISO-001", unit: "each", description: "Isolate water supply to upstairs bathroom suite" },
    { code: "RPR-002", unit: "each", description: "Repair burst flexi hose at vanity basin" },
    { code: "SWR-003", unit: "each", description: "Re-seal shower waste and pressure test tray" },
    { code: "TAP-004", unit: "each", description: "Replace leaking mixer tap — ensuite" },
    { code: "WC-005", unit: "each", description: "Reset and reseal close-coupled WC pan" },
    { code: "HWU-006", unit: "each", description: "Replace failed tempering valve on hot water line" },
    { code: "PIPE-007", unit: "lm", description: "Reroute copper feed line in wall cavity" },
    { code: "GAS-008", unit: "each", description: "Pressure test gas line to cooktop (compliance)" },
    { code: "DRN-009", unit: "each", description: "Clear blocked floor waste — laundry" },
    { code: "INS-010", unit: "each", description: "Install new dishwasher water connection point" },
  ],
  electrical: [
    { code: "ISO-001", unit: "each", description: "Isolate and tag circuits in wet-area bathroom" },
    { code: "GPO-002", unit: "each", description: "Replace water-damaged GPO — kitchen bench" },
    { code: "LED-003", unit: "each", description: "Supply and install LED downlight — living" },
    { code: "SW-004", unit: "each", description: "Replace light switch — hallway" },
    { code: "FAN-005", unit: "each", description: "Install exhaust fan with timer — bathroom" },
    { code: "SMK-006", unit: "each", description: "Replace interconnected smoke alarm (hardwired)" },
    { code: "SUB-007", unit: "each", description: "Upgrade sub-board RCD protection" },
    { code: "OVN-008", unit: "each", description: "Connect electric oven — new kitchen" },
    { code: "DATA-009", unit: "each", description: "Install data point — home office" },
    { code: "SOL-010", unit: "each", description: "Commission solar inverter export limit" },
  ],
  roofing: [
    { code: "TIL-001", unit: "each", description: "Replace broken concrete roof tile" },
    { code: "RID-002", unit: "lm", description: "Reseal ridge capping with flexible pointing" },
    { code: "VLY-003", unit: "lm", description: "Replace corroded valley flashing" },
    { code: "GUT-004", unit: "lm", description: "Replace damaged gutter section — rear elevation" },
    { code: "FLS-005", unit: "each", description: "Install lead flashing at chimney abutment" },
    { code: "SHT-006", unit: "m2", description: "Install sarking under tile field — storm damage" },
    { code: "BMT-007", unit: "each", description: "Secure loose barge capping screws" },
    { code: "SKY-008", unit: "each", description: "Reseal skylight curb and flashings" },
    { code: "EP-009", unit: "each", description: "Erect edge protection — single storey" },
    { code: "CLN-010", unit: "each", description: "Roof moss treatment and blow-down" },
  ],
  flooring: [
    { code: "MST-001", unit: "each", description: "Moisture content testing — timber subfloor" },
    { code: "SND-002", unit: "m2", description: "Sand and recoat cupped timber floorboards — affected zone" },
    { code: "BRD-003", unit: "m2", description: "Replace crowned timber boards after drying period" },
    { code: "VIN-004", unit: "m2", description: "Supply and lay luxury vinyl plank — bedroom" },
    { code: "TIL-005", unit: "m2", description: "Tile bathroom floor — porcelain 300x300" },
    { code: "CPT-006", unit: "m2", description: "Replace water-stained carpet and underlay" },
    { code: "SLV-007", unit: "m2", description: "Self-levelling compound to slab — garage conversion" },
    { code: "STP-008", unit: "lm", description: "Install solid timber skirting — match existing profile" },
    { code: "LAM-009", unit: "m2", description: "Floating laminate — rumpus room" },
    { code: "POL-010", unit: "m2", description: "Grind and polish exposed concrete — patio" },
  ],
  drywall: [
    { code: "SH-001", unit: "m2", description: "Install 13mm plasterboard to kitchen ceiling" },
    { code: "JT-002", unit: "m2", description: "Tape and joint ceiling sheets — Level 4 finish" },
    { code: "SH-003", unit: "m2", description: "Line internal wall — standard 10mm board" },
    { code: "COR-004", unit: "each", description: "Install plasterboard ceiling cornice — 90mm" },
    { code: "NCH-005", unit: "each", description: "Patch nib wall after doorway relocation" },
    { code: "ENC-006", unit: "each", description: "Build bulkhead over kitchen cupboards" },
    { code: "FIR-007", unit: "m2", description: "Fire-rated board to garage habitation wall" },
    { code: "WET-008", unit: "m2", description: "Wet-area fibre cement sheet to shower walls" },
    { code: "SKM-009", unit: "m2", description: "Skim coat over textured ceiling — whole room" },
    { code: "DMP-010", unit: "m2", description: "Install moisture-resistant board — laundry" },
  ],
  painting: [
    { code: "CLG-001", unit: "m2", description: "Prime and paint kitchen ceiling — two coats" },
    { code: "WAL-002", unit: "m2", description: "Wash, prep and paint internal walls — living" },
    { code: "EXT-003", unit: "m2", description: "Repaint weatherboard exterior — front elevation" },
    { code: "TRM-004", unit: "lm", description: "Prep and paint timber window trims" },
    { code: "DR-005", unit: "each", description: "Paint entry door — semi-gloss enamel" },
    { code: "FEN-006", unit: "lm", description: "Stain and seal timber fence — boundary" },
    { code: "KIT-007", unit: "each", description: "Cabinet spray finish — polyurethane" },
    { code: "STN-008", unit: "m2", description: "Block stain and spot prime water marks" },
    { code: "RF-009", unit: "m2", description: "Roof membrane topcoat — flat section" },
    { code: "FLR-010", unit: "m2", description: "Apply floor enamel to garage slab" },
  ],
  demolition: [
    { code: "CLG-001", unit: "m2", description: "Remove collapsed plasterboard ceiling — kitchen below bathroom" },
    { code: "STR-002", unit: "m2", description: "Strip water-damaged drywall to studs — wet line" },
    { code: "TIL-003", unit: "m2", description: "Hack off failed bathroom wall tiles" },
    { code: "CAB-004", unit: "each", description: "Remove existing kitchen cabinetry for disposal" },
    { code: "FLR-005", unit: "m2", description: "Lift and dispose damaged vinyl flooring" },
    { code: "FEN-006", unit: "each", description: "Demolish non-structural timber pergola" },
    { code: "SLB-007", unit: "m3", description: "Break out concrete pathway section" },
    { code: "INS-008", unit: "m2", description: "Remove contaminated ceiling insulation — bag and dispose" },
    { code: "ASB-009", unit: "each", description: "Licensed asbestos sheet removal — eaves (if present)" },
    { code: "CLR-010", unit: "each", description: "Site clearance and skip bin — 6m³" },
  ],
  mitigation: [
    { code: "DH-001", unit: "week", description: "Deploy commercial dehumidifiers — monitor 5–7 days" },
    { code: "LOG-002", unit: "each", description: "Daily moisture readings and insurer log sheet" },
    { code: "AMT-003", unit: "m2", description: "Antimicrobial treatment to exposed ceiling framing" },
    { code: "AIR-004", unit: "each", description: "Install HEPA air scrubber during drying phase" },
    { code: "EXT-005", unit: "each", description: "Extract standing water — carpeted bedroom" },
    { code: "DRY-006", unit: "each", description: "Injectidry system setup — wall cavity drying" },
    { code: "BAR-007", unit: "each", description: "Containment barriers and negative air — mould protocol" },
    { code: "MUD-008", unit: "each", description: "Mould remediation assessment — third party" },
    { code: "ODR-009", unit: "each", description: "Thermal imaging moisture mapping — post event" },
    { code: "SAN-010", unit: "each", description: "Sanitise soft furnishings — smoke not water (warehouse)" },
  ],
  cabinetry: [
    { code: "RM-001", unit: "each", description: "Remove and dispose existing kitchen base units" },
    { code: "BASE-002", unit: "lm", description: "Supply and install flat-pack base cabinetry" },
    { code: "WAL-003", unit: "lm", description: "Supply and install wall oven housing cabinets" },
    { code: "BT-004", unit: "each", description: "Template, cut and install stone benchtop" },
    { code: "PAN-005", unit: "each", description: "Install pantry pull-out shelving system" },
    { code: "VAN-006", unit: "each", description: "Supply and fit bathroom vanity — 900mm" },
    { code: "LDY-007", unit: "each", description: "Install laundry tub and cabinet combo" },
    { code: "HND-008", unit: "each", description: "Supply handles and hinges — whole kitchen" },
    { code: "WIR-009", unit: "each", description: "Built-in wardrobe internals — master bedroom" },
    { code: "BAR-010", unit: "each", description: "Outdoor kitchen BBQ module — alfresco" },
  ],
  structural: [
    { code: "JST-001", unit: "each", description: "Prop and replace deflected ceiling joist — kitchen" },
    { code: "SIS-002", unit: "each", description: "Sister joist to water-softened timber member" },
    { code: "BMT-003", unit: "each", description: "Install temporary propping under load-bearing wall" },
    { code: "LVL-004", unit: "each", description: "Install LVL beam — removed load-bearing wall" },
    { code: "PIER-005", unit: "each", description: "Replace rotted stump — subfloor access" },
    { code: "BRG-006", unit: "each", description: "Install bearer plate and ant cap" },
    { code: "STR-007", unit: "each", description: "Engineer-certified repair detail — storm bracing" },
    { code: "FND-008", unit: "each", description: "Epoxy inject crack in foundation — unrelated garage" },
    { code: "RET-009", unit: "each", description: "Retaining wall tie-back — hillside block" },
    { code: "STP-010", unit: "each", description: "Steel portal frame — new carport (greenfield)" },
  ],
};

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

function buildCatalog(): WorkItem[] {
  const items: WorkItem[] = [];
  let n = 1;
  for (const trade of TRADE_ORDER) {
    const prefix = TRADE_PREFIX[trade];
    const rows = TRADE_ROWS[trade];
    for (const row of rows) {
      items.push({
        id: `WI-${String(n).padStart(5, "0")}`,
        code: `${prefix}-${row.code}`,
        trade,
        unit: row.unit,
        description: row.description,
      });
      n += 1;
    }
  }
  return items;
}

function idByTradeIndex(trade: (typeof TRADE_ORDER)[number], indexInTrade: number): string {
  const tradeIdx = TRADE_ORDER.indexOf(trade);
  const n = tradeIdx * 10 + indexInTrade;
  return `WI-${String(n).padStart(5, "0")}`;
}

function buildJobExamples(): JobExample[] {
  const q = (trade: (typeof TRADE_ORDER)[number], indexInTrade: number, quantity: number) => ({
    work_item_id: idByTradeIndex(trade, indexInTrade),
    quantity,
  });

  return [
    {
      id: "job-bathroom-ceiling-collapse",
      title: "Upstairs bathroom leak — kitchen ceiling collapse",
      work_description:
        "Water escaped from an upstairs ensuite. Plasterboard ceiling in the kitchen below failed and fell. Timber joists were wet; insurer requested drying before rebuild.",
      billed_items: [
        q("plumbing", 1, 1),
        q("plumbing", 2, 1),
        q("demolition", 1, 12),
        q("demolition", 8, 12),
        q("mitigation", 1, 2),
        q("mitigation", 2, 14),
        q("mitigation", 3, 12),
        q("structural", 1, 2),
        q("drywall", 1, 12),
        q("drywall", 2, 12),
        q("painting", 1, 12),
      ],
    },
    {
      id: "job-slow-leak-cupping",
      title: "Slow bathroom leak — cupped timber floor",
      work_description:
        "Long-term leak at shower screen. Kitchen ceiling stained but intact; hallway timber flooring cupped. Scope focused on leak rectification, drying, and floor restoration.",
      billed_items: [
        q("plumbing", 3, 1),
        q("electrical", 1, 1),
        q("flooring", 1, 1),
        q("flooring", 2, 14),
        q("flooring", 3, 1),
        q("mitigation", 1, 1),
        q("mitigation", 2, 7),
        q("painting", 8, 6),
      ],
    },
    {
      id: "job-bathroom-stack-failure",
      title: "Bathroom stack leak — multi-room water damage",
      work_description:
        "Failed waste connection in upstairs bathroom affected kitchen ceiling and laundry wall. Full strip of wet linings, structural check, and phased reinstatement.",
      billed_items: [
        q("plumbing", 1, 1),
        q("plumbing", 5, 1),
        q("demolition", 1, 8),
        q("demolition", 2, 16),
        q("mitigation", 1, 2),
        q("mitigation", 4, 1),
        q("structural", 2, 3),
        q("drywall", 1, 8),
        q("drywall", 3, 16),
        q("painting", 1, 8),
        q("painting", 2, 16),
      ],
    },
    {
      id: "job-roof-tile-storm",
      title: "Roof storm damage — tile and flashing",
      work_description:
        "Hail and wind lifted tiles on north slope. Minor ceiling staining in bedroom; primary scope is roof make-safe and tile replacement.",
      billed_items: [
        q("roofing", 9, 1),
        q("roofing", 1, 18),
        q("roofing", 2, 12),
        q("roofing", 3, 6),
        q("painting", 8, 4),
      ],
    },
    {
      id: "job-roof-valley-leak",
      title: "Valley flashing leak — patch ceiling stain only",
      work_description:
        "Active roof leak at valley during heavy rain. Roofer replaced flashing; internal works limited to stain block and ceiling touch-up where leak tracked.",
      billed_items: [
        q("roofing", 3, 8),
        q("roofing", 4, 4),
        q("roofing", 7, 1),
        q("painting", 8, 3),
        q("drywall", 5, 2),
      ],
    },
    {
      id: "job-kitchen-cabinet-refresh",
      title: "Kitchen renovation — cabinetry and bench",
      work_description:
        "Owner upgrade: new flat-pack kitchen, stone bench, and connections. No water damage; bathroom and ceilings out of scope.",
      billed_items: [
        q("cabinetry", 1, 1),
        q("cabinetry", 2, 6),
        q("cabinetry", 3, 3),
        q("cabinetry", 4, 1),
        q("plumbing", 10, 1),
        q("electrical", 8, 1),
      ],
    },
    {
      id: "job-pool-fence-compliance",
      title: "Pool fence compliance upgrade",
      work_description:
        "Council notice: replace non-compliant pool gate and latch hardware to current standard.",
      billed_items: [q("structural", 10, 1), q("painting", 5, 1)],
    },
    {
      id: "job-office-fitout",
      title: "Commercial office data and lighting fitout",
      work_description:
        "Tenant improvement: new LED panels, data drops, and partition lining in open-plan suite.",
      billed_items: [
        q("electrical", 3, 24),
        q("electrical", 9, 8),
        q("drywall", 3, 45),
        q("painting", 2, 120),
      ],
    },
    {
      id: "job-driveway-replace",
      title: "Driveway concrete replacement",
      work_description:
        "Remove failed driveway section and pour new exposed aggregate slab with control joints.",
      billed_items: [q("demolition", 7, 4), q("flooring", 10, 28)],
    },
    {
      id: "job-hvac-split-install",
      title: "Split-system AC — lounge install",
      work_description:
        "Supply and install reverse-cycle split system with new dedicated circuit and condenser pad.",
      billed_items: [q("electrical", 7, 1), q("electrical", 5, 1)],
    },
    {
      id: "job-exterior-repaint",
      title: "Whole-house exterior repaint",
      work_description:
        "Wash down, scrape, and repaint weatherboard elevations including trims and fascia.",
      billed_items: [
        q("painting", 3, 180),
        q("painting", 4, 65),
        q("roofing", 10, 1),
      ],
    },
    {
      id: "job-deck-extension",
      title: "Timber deck extension — rear yard",
      work_description:
        "New hardwood deck on screw piles with balustrade; unrelated to internal water claims.",
      billed_items: [
        q("structural", 4, 2),
        q("structural", 5, 6),
        q("painting", 6, 28),
      ],
    },
  ];
}

function writeJson(relativePath: string, value: unknown): void {
  const path = join(OUT_DIR, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote ${relativePath}`);
}

function main(): void {
  const items = buildCatalog();
  if (items.length !== 100) {
    throw new Error(`expected 100 work items, got ${items.length}`);
  }

  const examples = buildJobExamples();
  if (examples.length !== 12) {
    throw new Error(`expected 12 job examples, got ${examples.length}`);
  }

  const itemIds = new Set(items.map((i) => i.id));
  for (const ex of examples) {
    for (const bi of ex.billed_items) {
      if (!itemIds.has(bi.work_item_id)) {
        throw new Error(`unknown work_item_id ${bi.work_item_id} in ${ex.id}`);
      }
    }
  }

  writeJson("work_item_catalog.json", items);
  writeJson("job_example_library.json", examples);
  writeFileSync(join(OUT_DIR, "billed_work_description.txt"), `${WORK_DESCRIPTION}\n`);
  console.log("wrote billed_work_description.txt");

  console.log(`catalog: ${items.length} items`);
  console.log(`examples: ${examples.length} jobs`);
}

main();
