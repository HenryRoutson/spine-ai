import { PRIVACY_SECTIONS } from "@shared/legal/content"
import { createLegalPage } from "@/lib/legal/create-legal-page"
import { LEGAL } from "@shared/legal/site"

const { metadata, Page } = createLegalPage({
  metadataTitle: `Privacy Policy — ${LEGAL.productName}`,
  documentTitle: "Privacy Policy",
  sections: PRIVACY_SECTIONS,
})

export { metadata }
export default Page
