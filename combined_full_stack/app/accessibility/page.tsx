import { ACCESSIBILITY_SECTIONS } from "@shared/legal/content"
import { createLegalPage } from "@/lib/legal/create-legal-page"

const { metadata, Page } = createLegalPage({
  metadataTitle: "Accessibility — Spine",
  documentTitle: "Accessibility Statement",
  sections: ACCESSIBILITY_SECTIONS,
})

export { metadata }
export default Page
