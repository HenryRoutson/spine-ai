import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, "index.html");
const fileUrl = `file://${indexPath}`;

const exports = [
  {
    name: "spine-mark-lg",
    selector: "section:nth-of-type(4) .spine-mark.lg",
    padding: 24,
    omitBackground: true,
  },
  {
    name: "spine-mark-xl",
    selector: "section:nth-of-type(4) .spine-mark.xl",
    padding: 24,
    omitBackground: true,
  },
  {
    name: "spine-mark-56",
    selector: "section:nth-of-type(5) .spine-mark.lg",
    padding: 32,
    omitBackground: true,
  },
  {
    name: "spine-logo-nav-dark",
    selector: "section:nth-of-type(1) .spine-logo",
    padding: 16,
    omitBackground: true,
  },
  {
    name: "spine-logo-nav-light",
    selector: "section:nth-of-type(2) .spine-logo",
    padding: 16,
    omitBackground: true,
  },
  {
    name: "spine-logo-hero",
    selector: "section:nth-of-type(3) .spine-logo",
    padding: 24,
    omitBackground: true,
  },
  {
    name: "spine-logo-vertical-dark",
    selector: "section:nth-of-type(6) .spine-logo-vertical",
    padding: 16,
    omitBackground: true,
  },
  {
    name: "spine-logo-vertical-light",
    selector: "section:nth-of-type(7) .spine-logo-vertical",
    padding: 16,
    omitBackground: true,
  },
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
await page.goto(fileUrl, { waitUntil: "networkidle0" });

for (const item of exports) {
  const handle = await page.$(item.selector);
  if (!handle) {
    console.warn(`skip ${item.name}: selector not found`);
    continue;
  }

  const box = await handle.boundingBox();
  if (!box) {
    console.warn(`skip ${item.name}: no bounding box`);
    continue;
  }

  const pad = item.padding ?? 0;
  const outPath = path.join(__dirname, `${item.name}.png`);

  await page.screenshot({
    path: outPath,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
    omitBackground: item.omitBackground ?? false,
  });

  console.log(`wrote ${outPath}`);
}

await browser.close();
