import { resolve } from "node:path"
import { exportAllPiecesToDisk } from "@/lib/n8n-share"

const appRoot = resolve(import.meta.dirname, "../../combined_full_stack")
for (const row of exportAllPiecesToDisk(appRoot)) {
  console.log(row.path)
}
