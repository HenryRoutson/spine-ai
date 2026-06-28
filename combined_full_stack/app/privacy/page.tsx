import { PRIVACY_SECTIONS } from "@shared/legal/content"
import { createLegalPage } from "@/lib/legal/create-legal-page"

const { metadata, Page } = createLegalPage({
  metadataTitle: "Privacy Policy — auto pipeline",
  documentTitle: "Privacy Policy",
  sections: PRIVACY_SECTIONS,
})

export { metadata }
export default Page
