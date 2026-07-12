import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgDir = path.join(__dirname, "exports", "svg");
const outDir = path.join(__dirname, "exports", "png");
fs.mkdirSync(outDir, { recursive: true });

// AI : 1440p long edge — one isolated logo per file, transparent background
const TARGET_LONG_EDGE = 1440;

function parseSvgSize(svg) {
  const viewBox = svg.match(/viewBox="([^"]+)"/);
  if (viewBox) {
    const parts = viewBox[1].split(/\s+/).map(Number);
    return { w: parts[2], h: parts[3] };
  }
  const w = Number(svg.match(/\swidth="(\d+(?:\.\d+)?)"/)?.[1] ?? 0);
  const h = Number(svg.match(/\sheight="(\d+(?:\.\d+)?)"/)?.[1] ?? 0);
  return { w, h };
}

const svgs = fs.readdirSync(svgDir).filter((f) => f.endsWith(".svg"));

for (const file of svgs) {
  const name = file.replace(/\.svg$/, "");
  const svg = fs.readFileSync(path.join(svgDir, file), "utf8");
  const { w, h } = parseSvgSize(svg);
  const longEdge = Math.max(w, h);
  const scale = TARGET_LONG_EDGE / longEdge;
  const outW = Math.round(w * scale);
  const outH = Math.round(h * scale);

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: outW },
    background: "rgba(0,0,0,0)",
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "Inter",
    },
  });

  const png = resvg.render().asPng();
  const outPath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${outW}×${outH})`);
}
