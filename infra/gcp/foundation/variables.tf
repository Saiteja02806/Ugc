variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "ugcsaas"
}

variable "project_number" {
  description = "Google Cloud project number. Required for Google-managed service agents."
  type        = string
  default     = "58051192797"
}

variable "region" {
  description = "Primary region for Cloud Run, Cloud Tasks, and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment label for resources."
  type        = string
  default     = "prod"
}

variable "name_prefix" {
  description = "Short prefix for resource names."
  type        = string
  default     = "ugc"
}

variable "enable_background_job_recovery_scheduler" {
  description = "Enable the Cloud Scheduler request that recovers stale durable background jobs."
  type        = bool
  default     = false
}

variable "background_job_recovery_url" {
  description = "HTTPS URL for /api/internal/jobs/recover on the deployed app."
  type        = string
  default     = ""

  validation {
    condition = (
      !var.enable_background_job_recovery_scheduler ||
      can(regex("^https://", var.background_job_recovery_url))
    )
    error_message = "background_job_recovery_url must be an HTTPS URL when recovery scheduling is enabled."
  }
}

variable "background_job_recovery_schedule" {
  description = "Cron schedule for stale background-job recovery."
  type        = string
  default     = "*/5 * * * *"
}

variable "media_bucket_name" {
  description = "Globally unique Cloud Storage bucket name for app media."
  type        = string
  default     = "ugcsaas-media"
}

variable "media_bucket_location" {
  description = "Cloud Storage bucket location for app media."
  type        = string
  default     = "US"
}

variable "media_bucket_public_read" {
  description = "Set true only when ready to publicly serve media directly or through the optional Cloud CDN."
  type        = bool
  default     = false
}

variable "enable_media_cdn" {
  description = "Create the optional media CDN and global external load balancer. Keep false while testing with direct GCS URLs."
  type        = bool
  default     = false
}

variable "media_cors_origins" {
  description = "Allowed browser origins for direct media uploads."
  type        = list(string)
  default = [
    "https://getugcpilot.com",
    "https://www.getugcpilot.com",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://localhost:4300"
  ]
}

variable "cdn_domain_names" {
  description = "Optional custom domains used when the media CDN is enabled. Leave empty until DNS is ready."
  type        = list(string)
  default     = []
}

variable "secret_ids" {
  description = "Secret Manager secret IDs to create. Values are intentionally not managed here."
  type        = set(string)
  default = [
    "supabase-url",
    "supabase-service-role-key",
    "next-public-supabase-anon-key",
    "openai-api-key",
    "gemini-api-key",
    "runwayml-api-secret",
    "heygen-api-key",
    "pexels-api-key",
    "firecrawl-api-key",
    "ugc-internal-scheduling-secret",
    "ugc-internal-carousel-secret",
    "hook-video-preview-secret",
    "social-token-encryption-key",
    "oauth-token-encryption-key",
    "tiktok-client-key",
    "tiktok-client-secret",
    "instagram-app-id",
    "instagram-app-secret",
    "meta-app-secret",
    "google-client-id",
    "google-client-secret"
  ]
}

variable "retained_legacy_secret_ids" {
  description = "Legacy Secret Manager containers retained to avoid accidental deletion while runtime usage is removed."
  type        = set(string)
  default = [
    "trigger-access-token",
    "trigger-secret-key"
  ]
}
