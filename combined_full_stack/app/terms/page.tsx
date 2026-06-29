import { TERMS_SECTIONS } from "@shared/legal/content"
import { createLegalPage } from "@/lib/legal/create-legal-page"

const { metadata, Page } = createLegalPage({
  metadataTitle: "Terms of Service — Spine",
  documentTitle: "Terms of Service",
  sections: TERMS_SECTIONS,
})

export { metadata }
export default Page
