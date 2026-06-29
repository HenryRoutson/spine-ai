import { TERMS_SECTIONS } from "@shared/legal/content"
import { createLegalPage } from "@/lib/legal/create-legal-page"
import { LEGAL } from "@shared/legal/site"

const { metadata, Page } = createLegalPage({
  metadataTitle: `Terms of Service — ${LEGAL.productName}`,
  documentTitle: "Terms of Service",
  sections: TERMS_SECTIONS,
})

export { metadata }
export default Page
