locals {
  # Preserve every existing AI job type. Audio is additive, never a replacement.
  effective_worker_job_types = join(",", distinct(concat(
    [for job_type in split(",", var.worker_job_types) : trimspace(job_type)],
    var.enable_audio_generation ? ["generate_audio"] : []
  )))
  audio_env = var.enable_audio_generation ? {
    AUDIO_GENERATION_ENABLED          = "true"
    AUDIO_GENERATION_PUBLIC_ENABLED   = tostring(var.audio_generation_public_enabled)
    AUDIO_GENERATION_ALLOWED_USER_IDS = var.audio_generation_allowed_user_ids
    GCP_PRIVATE_AUDIO_BUCKET          = var.private_audio_bucket_name
  } : {}
  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    runtime     = "gcp-only"
    slice       = "ai-generation-worker"
  }
}
