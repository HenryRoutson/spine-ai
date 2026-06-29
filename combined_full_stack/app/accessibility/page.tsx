import { ACCESSIBILITY_SECTIONS } from "@shared/legal/content"
import { createLegalPage } from "@/lib/legal/create-legal-page"
import { LEGAL } from "@shared/legal/site"

const { metadata, Page } = createLegalPage({
  metadataTitle: `Accessibility — ${LEGAL.productName}`,
  documentTitle: "Accessibility Statement",
  sections: ACCESSIBILITY_SECTIONS,
})

export { metadata }
export default Page
