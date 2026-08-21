import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  spineMarkSvg,
  spineMarkTallSvg,
  spineIconSvg,
  spineLogoNavSvg,
  spineLogoHeroSvg,
  spineLogoVerticalSvg,
  gridSvg,
  wordmarkSpine,
  scaleGrid,
  THEME,
} from "./lib/spine-pixel.mjs";
import { previewHtml } from "./lib/preview-html.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "exports", "svg");
fs.mkdirSync(outDir, { recursive: true });

/** @type {Array<{ name: string, content: string }>} */
const files = [
  { name: "spine-mark-dark", content: spineMarkSvg({ theme: "dark" }) },
  { name: "spine-mark-light", content: spineMarkSvg({ theme: "light" }) },
  { name: "spine-mark-tall-dark", content: spineMarkTallSvg({ theme: "dark" }) },
  { name: "spine-mark-tall-light", content: spineMarkTallSvg({ theme: "light" }) },
  { name: "spine-icon-dark", content: spineIconSvg({ theme: "dark" }) },
  { name: "spine-icon-light", content: spineIconSvg({ theme: "light" }) },
  { name: "spine-logo-nav-dark", content: spineLogoNavSvg({ theme: "dark" }) },
  { name: "spine-logo-nav-light", content: spineLogoNavSvg({ theme: "light" }) },
  { name: "spine-logo-hero-dark", content: spineLogoHeroSvg({ theme: "dark" }) },
  { name: "spine-logo-hero-light", content: spineLogoHeroSvg({ theme: "light" }) },
  { name: "spine-logo-vertical-dark", content: spineLogoVerticalSvg({ theme: "dark" }) },
  { name: "spine-logo-vertical-light", content: spineLogoVerticalSvg({ theme: "light" }) },
  {
    name: "spine-wordmark-dark",
    content: gridSvg({
      grid: scaleGrid(wordmarkSpine(), 2),
      fill: THEME.dark.fg,
      pad: 1,
      label: "Spine",
    }),
  },
  {
    name: "spine-wordmark-light",
    content: gridSvg({
      grid: scaleGrid(wordmarkSpine(), 2),
      fill: THEME.light.fg,
      pad: 1,
      label: "Spine",
    }),
  },
];

for (const { name, content } of files) {
  const outPath = path.join(outDir, `${name}.svg`);
  fs.writeFileSync(outPath, content);
  console.log(`wrote ${outPath}`);
}

const htmlPath = path.join(__dirname, "index.html");
fs.writeFileSync(htmlPath, previewHtml());
console.log(`wrote ${htmlPath}`);
