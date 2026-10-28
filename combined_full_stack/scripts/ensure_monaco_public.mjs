import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const src = path.join(root, "node_modules", "monaco-editor", "min", "vs")
const dest = path.join(root, "public", "monaco", "vs")
const marker = path.join(dest, "loader.js")

if (fs.existsSync(marker)) {
  process.exit(0)
}

if (!fs.existsSync(src)) {
  console.error("ensure_monaco_public: monaco-editor not installed — run npm install")
  process.exit(1)
}

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.cpSync(src, dest, { recursive: true })
console.log("ensure_monaco_public: copied monaco-editor assets to public/monaco/vs")
