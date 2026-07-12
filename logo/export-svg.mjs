import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  spineMarkSvg,
  spineLogoHeroSvg,
  spineLogoNavSvg,
  spineLogoVerticalSvg,
} from "./lib/spine-mark-svg.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "exports", "svg");
fs.mkdirSync(outDir, { recursive: true });

/** @type {Array<{ name: string, content: string }>} */
const files = [
  { name: "spine-mark-sm-dark", content: spineMarkSvg({ variant: "sm", theme: "dark" }) },
  { name: "spine-mark-md-dark", content: spineMarkSvg({ variant: "md", theme: "dark" }) },
  { name: "spine-mark-lg-dark", content: spineMarkSvg({ variant: "lg", theme: "dark" }) },
  { name: "spine-mark-xl-dark", content: spineMarkSvg({ variant: "xl", theme: "dark" }) },
  { name: "spine-mark-sm-light", content: spineMarkSvg({ variant: "sm", theme: "light" }) },
  { name: "spine-mark-md-light", content: spineMarkSvg({ variant: "md", theme: "light" }) },
  { name: "spine-mark-lg-light", content: spineMarkSvg({ variant: "lg", theme: "light" }) },
  { name: "spine-mark-xl-light", content: spineMarkSvg({ variant: "xl", theme: "light" }) },
  { name: "spine-mark-tall-dark", content: spineMarkSvg({ variant: "tall", theme: "dark" }) },
  { name: "spine-mark-tall-light", content: spineMarkSvg({ variant: "tall", theme: "light" }) },
  { name: "spine-logo-nav-dark", content: spineLogoNavSvg({ theme: "dark" }) },
  { name: "spine-logo-nav-light", content: spineLogoNavSvg({ theme: "light" }) },
  { name: "spine-logo-hero-dark", content: spineLogoHeroSvg({ theme: "dark" }) },
  { name: "spine-logo-hero-light", content: spineLogoHeroSvg({ theme: "light" }) },
  { name: "spine-logo-vertical-dark", content: spineLogoVerticalSvg({ theme: "dark" }) },
  { name: "spine-logo-vertical-light", content: spineLogoVerticalSvg({ theme: "light" }) },
];

for (const { name, content } of files) {
  const outPath = path.join(outDir, `${name}.svg`);
  fs.writeFileSync(outPath, content);
  console.log(`wrote ${outPath}`);
}
