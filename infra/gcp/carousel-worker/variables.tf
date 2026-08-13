variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "ugcsaas"
}

variable "region" {
  description = "Region for the Cloud Run Carousel worker service."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment label for Carousel worker resources."
  type        = string
  default     = "prod"
}

variable "enable_carousel_worker" {
  description = "Set true after the worker image includes the Cloud Run health listener and required secrets have enabled versions."
  type        = bool
  default     = false
}

variable "worker_image_uri" {
  description = "Artifact Registry image URI for the worker container."
  type        = string
  default     = ""
}

variable "worker_service_account_email" {
  description = "Service account used by the Carousel worker service."
  type        = string
  default     = "ugc-worker-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "scheduler_service_account_email" {
  description = "Service account used by Cloud Tasks to invoke this worker."
  type        = string
  default     = "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "service_name" {
  description = "Cloud Run Service name for the Carousel worker."
  type        = string
  default     = "ugc-carousel-worker"
}

variable "queue_name" {
  description = "Logical worker queue name stored on background_jobs."
  type        = string
  default     = "carousel"
}

variable "worker_job_types" {
  description = "Comma-separated job types allowed for this worker service."
  type        = string
  default     = "generate_carousel,render_trending_carousel_edit"
}

variable "worker_visibility_timeout_seconds" {
  description = "Worker delivery visibility timeout."
  type        = number
  default     = 900
}

variable "min_instance_count" {
  description = "Minimum Cloud Run instances for the Carousel worker."
  type        = number
  default     = 1
}

variable "max_instance_count" {
  description = "Maximum Cloud Run instances for the Carousel worker."
  type        = number
  default     = 1
}

variable "request_timeout_seconds" {
  description = "Cloud Run request timeout for health checks and incidental requests."
  type        = number
  default     = 300
}

variable "cpu" {
  description = "CPU limit for the Carousel worker service."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit for the Carousel worker service."
  type        = string
  default     = "2Gi"
}

variable "container_port" {
  description = "HTTP health port exposed by the worker container."
  type        = number
  default     = 8080
}

variable "storage_provider" {
  description = "Storage provider for rendered Carousel assets."
  type        = string
  default     = "gcp"
}

variable "gcp_storage_bucket" {
  description = "GCS bucket for rendered Carousel assets."
  type        = string
  default     = "ugcsaas-media"
}

variable "gcp_storage_public_base_url" {
  description = "Public base URL for rendered GCS media."
  type        = string
  default     = "https://storage.googleapis.com/ugcsaas-media"
}

variable "carousel_broad_matcher_mode" {
  description = "Carousel broad matcher mode used by the GCP worker."
  type        = string
  default     = "enabled"
}

variable "carousel_broad_matcher_canary_business_profile_ids" {
  description = "Comma-separated business profile IDs allowed to use the broad matcher while the global mode is dry-run."
  type        = string
  default     = ""
}

variable "carousel_broad_matcher_canary_user_ids" {
  description = "Comma-separated user IDs allowed to use the broad matcher while the global mode is dry-run."
  type        = string
  default     = ""
}

variable "carousel_disable_category_fallback" {
  description = "Disables unrelated Carousel category fallback."
  type        = bool
  default     = true
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
