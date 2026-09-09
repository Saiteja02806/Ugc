variable "project_id" {
  type        = string
  description = "Google Cloud project ID."
  default     = "ugcsaas"
}

variable "region" {
  type        = string
  description = "Cloud Run region."
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "Environment label."
  default     = "prod"
}

variable "enable_reaction_render_worker" {
  type        = bool
  description = "Creates the dedicated request-based Reaction render service."
  default     = false
}

variable "worker_image_uri" {
  type        = string
  description = "Artifact Registry worker image URI."
  default     = ""
}

variable "worker_service_account_email" {
  type        = string
  description = "Service account used by the Reaction render worker."
  default     = "ugc-worker-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "scheduler_service_account_email" {
  type        = string
  description = "Cloud Tasks OIDC caller service account."
  default     = "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "service_name" {
  type        = string
  description = "Cloud Run service name."
  default     = "ugc-reaction-render-worker"
}

variable "queue_name" {
  type        = string
  description = "Logical queue carried by Reaction render jobs."
  default     = "reaction-render"
}

variable "worker_version" {
  type        = string
  description = "Release label written to worker logs."
  default     = "worker-gcp"
}

variable "worker_git_commit" {
  type        = string
  description = "Git SHA baked into the worker image."
  default     = "unknown"
}

variable "min_instance_count" {
  type        = number
  description = "Idle worker instances. Keep zero for scale-to-zero operation."
  default     = 0
}

variable "max_instance_count" {
  type        = number
  description = "Maximum concurrently rendered Reaction Reels."
  default     = 4
}

variable "request_timeout_seconds" {
  type        = number
  description = "Maximum duration of one Reaction render HTTP task."
  default     = 1800
}

variable "worker_visibility_timeout_seconds" {
  type        = number
  description = "Durable background-job claim lease."
  default     = 1800
}

variable "cpu" {
  type        = string
  description = "CPU limit for FFmpeg composition."
  default     = "2"
}

variable "memory" {
  type        = string
  description = "Memory limit for FFmpeg composition."
  default     = "4Gi"
}

variable "container_port" {
  type        = number
  description = "HTTP port exposed by the worker."
  default     = 8080
}

variable "gcp_storage_bucket" {
  type        = string
  description = "GCS bucket for rendered media."
  default     = "ugcsaas-media"
}

variable "gcp_storage_public_base_url" {
  type        = string
  description = "Public GCS media base URL."
  default     = "https://storage.googleapis.com/ugcsaas-media"
}

variable "internal_app_url" {
  type        = string
  description = "Production app URL used to reconcile each completed Reaction item into the Trending feed."
  default     = "https://getugcpilot.com"
}
