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
  description = "Set true only when ready to publicly serve media through Cloud CDN."
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
  description = "Optional custom domains for HTTPS Cloud CDN. Leave empty until DNS is ready."
  type        = list(string)
  default     = []
}

variable "monitoring_notification_channels" {
  description = "Optional Monitoring notification channel IDs for alert policies."
  type        = list(string)
  default     = []
}

variable "enable_monitoring_alerts" {
  description = "Create starter alert policies for Pub/Sub DLQ backlog."
  type        = bool
  default     = false
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
