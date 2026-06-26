// AI : TODO refactor — drop this shim; import from doc_text_cache directly at call sites.
// AI : re-export — vision keys live in doc_text_cache alongside parser cache.
export {
  visionCacheKey,
  type VisionCacheKey,
  type VisionCacheRow,
} from "./doc_text_cache";
