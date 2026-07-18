variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "ugcsaas"
}

variable "region" {
  description = "Region for the Cloud Run video-render worker service."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment label for video-render worker resources."
  type        = string
  default     = "prod"
}

variable "enable_video_render_worker" {
  description = "Set true after the worker image, storage env, Pub/Sub subscription, and required Secret Manager versions are ready."
  type        = bool
  default     = false
}

variable "worker_image_uri" {
  description = "Artifact Registry image URI for the worker container."
  type        = string
  default     = ""
}

variable "worker_service_account_email" {
  description = "Service account used by the video-render worker service."
  type        = string
  default     = "ugc-worker-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "service_name" {
  description = "Cloud Run Service name for the video-render worker."
  type        = string
  default     = "ugc-video-render-worker"
}

variable "pubsub_subscription_name" {
  description = "Pub/Sub subscription the video-render worker pulls from."
  type        = string
  default     = "ugc-video-render-sub"
}

variable "queue_name" {
  description = "Logical worker queue name stored on background_jobs."
  type        = string
  default     = "video-render"
}

variable "worker_job_types" {
  description = "Comma-separated job types allowed for this worker service."
  type        = string
  default     = "render_edit_video,render_schedule_combination"
}

variable "worker_poll_max_messages" {
  description = "Maximum Pub/Sub messages to pull per worker loop."
  type        = number
  default     = 1
}

variable "worker_poll_wait_seconds" {
  description = "Pub/Sub pull wait behavior for the always-on worker."
  type        = number
  default     = 20
}

variable "worker_visibility_timeout_seconds" {
  description = "Worker delivery visibility timeout for video render jobs."
  type        = number
  default     = 900
}

variable "min_instance_count" {
  description = "Minimum Cloud Run instances for the video-render worker. Keep 1 for active queue consumption."
  type        = number
  default     = 1
}

variable "max_instance_count" {
  description = "Maximum Cloud Run instances for the video-render worker."
  type        = number
  default     = 1
}

variable "request_timeout_seconds" {
  description = "Cloud Run request timeout for health checks and incidental requests."
  type        = number
  default     = 300
}

variable "cpu" {
  description = "CPU limit for ffmpeg-based video rendering."
  type        = string
  default     = "2"
}

variable "memory" {
  description = "Memory limit for ffmpeg-based video rendering."
  type        = string
  default     = "4Gi"
}

variable "container_port" {
  description = "HTTP health port exposed by the worker container."
  type        = number
  default     = 8080
}

variable "storage_provider" {
  description = "Storage provider for rendered video assets."
  type        = string
  default     = "gcp"
}

variable "gcp_storage_bucket" {
  description = "GCS bucket for rendered video assets."
  type        = string
  default     = "ugcsaas-media"
}

variable "gcp_storage_public_base_url" {
  description = "Public base URL for rendered GCS media."
  type        = string
  default     = "https://storage.googleapis.com/ugcsaas-media"
}

variable "internal_app_url" {
  description = "Production app base URL used by render_schedule_combination when auto-finalizing schedules."
  type        = string
  default     = "https://getugcpilot.com"
}

variable "scheduling_secret_id" {
  description = "Secret Manager secret ID for UGC_INTERNAL_SCHEDULING_SECRET."
  type        = string
  default     = "ugc-internal-scheduling-secret"
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
