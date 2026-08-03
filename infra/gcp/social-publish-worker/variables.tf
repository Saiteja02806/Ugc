variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "ugcsaas"
}

variable "region" {
  description = "Region for the Cloud Run social-publish worker service."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment label for social-publish worker resources."
  type        = string
  default     = "prod"
}

variable "enable_social_publish_worker" {
  description = "Set true only after secrets are configured and manual social publish cutover is approved."
  type        = bool
  default     = false
}

variable "worker_image_uri" {
  description = "Artifact Registry image URI for the worker container."
  type        = string
  default     = ""
}

variable "worker_service_account_email" {
  description = "Service account used by the social-publish worker service."
  type        = string
  default     = "ugc-worker-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "scheduler_service_account_email" {
  description = "Service account used by Cloud Tasks to invoke this worker."
  type        = string
  default     = "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "service_name" {
  description = "Cloud Run Service name for the social-publish worker."
  type        = string
  default     = "ugc-social-publish-worker"
}

variable "queue_name" {
  description = "Logical worker queue name stored on background_jobs."
  type        = string
  default     = "social-publish"
}

variable "worker_job_types" {
  description = "Comma-separated job types allowed for this worker service."
  type        = string
  default     = "publish_social_post"
}

variable "worker_visibility_timeout_seconds" {
  description = "Worker delivery visibility timeout for social publish jobs."
  type        = number
  default     = 300
}

variable "min_instance_count" {
  description = "Minimum Cloud Run instances for the social-publish worker."
  type        = number
  default     = 1
}

variable "max_instance_count" {
  description = "Maximum Cloud Run instances for the social-publish worker."
  type        = number
  default     = 1
}

variable "request_timeout_seconds" {
  description = "Cloud Run request timeout for health checks and incidental requests."
  type        = number
  default     = 300
}

variable "cpu" {
  description = "CPU limit for social-publish worker service."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit for social-publish worker service."
  type        = string
  default     = "1Gi"
}

variable "container_port" {
  description = "HTTP health port exposed by the worker container."
  type        = number
  default     = 8080
}

variable "storage_provider" {
  description = "Storage provider for social publish helper uploads such as Instagram carousel JPG preparation."
  type        = string
  default     = "gcp"
}

variable "gcp_storage_bucket" {
  description = "GCS bucket for social publish helper uploads."
  type        = string
  default     = "ugcsaas-media"
}

variable "gcp_storage_public_base_url" {
  description = "Public base URL for GCS media used by social publishing."
  type        = string
  default     = "https://storage.googleapis.com/ugcsaas-media"
}

variable "token_encryption_secret_id" {
  description = "Secret Manager secret ID injected as OAUTH_TOKEN_ENCRYPTION_KEY for decrypting stored social tokens."
  type        = string
  default     = "oauth-token-encryption-key"
}

variable "google_client_id_secret_id" {
  description = "Secret Manager secret ID for GOOGLE_CLIENT_ID used by YouTube token refresh."
  type        = string
  default     = "google-client-id"
}

variable "google_client_secret_secret_id" {
  description = "Secret Manager secret ID for GOOGLE_CLIENT_SECRET used by YouTube token refresh."
  type        = string
  default     = "google-client-secret"
}

variable "tiktok_client_key_secret_id" {
  description = "Secret Manager secret ID for TIKTOK_CLIENT_KEY."
  type        = string
  default     = "tiktok-client-key"
}

variable "tiktok_client_secret_secret_id" {
  description = "Secret Manager secret ID for TIKTOK_CLIENT_SECRET."
  type        = string
  default     = "tiktok-client-secret"
}

variable "social_publish_max_attempts" {
  description = "Maximum social publish attempts before marking the target failed."
  type        = number
  default     = 4
}

variable "social_publish_retry_base_seconds" {
  description = "Base retry delay for social publish jobs."
  type        = number
  default     = 30
}

variable "social_publish_retry_max_seconds" {
  description = "Maximum retry delay for social publish jobs."
  type        = number
  default     = 900
}

variable "social_reconciliation_enabled" {
  description = "Allow this worker to recover due social publish jobs directly from the database. Keep false for the first GCP canary."
  type        = bool
  default     = false
}

variable "social_reconciliation_batch_size" {
  description = "Maximum number of due social publish jobs recovered per reconciliation pass when enabled."
  type        = number
  default     = 10
}

variable "social_reconciliation_interval_seconds" {
  description = "Reconciliation interval when social_reconciliation_enabled is true."
  type        = number
  default     = 15
}

variable "tiktok_media_transfer_mode" {
  description = "TikTok video transfer mode. FILE_UPLOAD avoids requiring a verified pull URL host for video posts."
  type        = string
  default     = "FILE_UPLOAD"
}

variable "tiktok_verified_media_hosts" {
  description = "Comma-separated verified media hosts for TikTok PULL_FROM_URL/photo carousel publishing."
  type        = string
  default     = ""
}

variable "worker_version" {
  description = "Human-readable worker version label."
  type        = string
  default     = "worker-gcp"
}

variable "worker_git_commit" {
  description = "Git commit embedded in Cloud Run worker logs."
  type        = string
  default     = "unknown"
}
