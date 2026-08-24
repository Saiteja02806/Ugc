/**
 * One authoritative text model for every Carousel writing request.
 *
 * Keep this pinned in source so a stale deployment environment variable cannot
 * silently route Structure 1 and Structure 2 through different models.
 */
export const CAROUSEL_TEXT_MODEL = "gpt-4o-mini";
