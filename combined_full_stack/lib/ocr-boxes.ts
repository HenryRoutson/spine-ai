// AI : Bounding-box OCR viewer plan (spec §documents — "OCR labelled with bounding boxes like deepseek OCR can").
//
// 1. DeepSeek-OCR-2 grounding prompt (`<|grounding|>`) can emit tokens with boxes.
//    Persist boxes in a cache table keyed like vision cache (doc + model + prompt) — NOT on Document
//    and NOT as extra encoded page rasters (originals already live in doc-originals storage).
// 2. Convert-to-text (OCR mode) is the producer: when DeepSeek returns grounded markdown, parse
//    boxes into OcrBox[] and store beside the transcribed text. Parser mode has no boxes.
// 3. Doc viewer: add DocViewMode.OcrBoxes tab for pdf/image when boxes exist. Overlay rects on the
//    existing original-bytes blob URL (pdf.js / <img>) — click a box to highlight the matching text
//    span. Do not duplicate the file as base64 in React state.
// 4. Keep boxes off the pipeline spine so convert-to-text output stays { content, filename }.

export type OcrBox = {
  text: string
  page: number
  x: number
  y: number
  w: number
  h: number
}

export type OcrBoxCacheRow = {
  docId: string
  model: string
  boxes: OcrBox[]
  createdAt: number
}
