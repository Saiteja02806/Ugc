variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "ugcsaas"
}

variable "project_number" {
  description = "Google Cloud numeric project ID, used for service agents."
  type        = string
  default     = "58051192797"
}

variable "region" {
  description = "Region for the Cloud Run Job and Cloud Scheduler job."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment label for scheduler resources."
  type        = string
  default     = "prod"
}

variable "name_prefix" {
  description = "Short prefix for resource names."
  type        = string
  default     = "ugc"
}

variable "enable_replenishment_scheduler" {
  description = "Set true only after a worker image has been pushed and required Secret Manager values exist."
  type        = bool
  default     = false
}

variable "worker_image_uri" {
  description = "Artifact Registry image URI for the worker image containing dist/scheduler/replenish-daily-carousels.js."
  type        = string
  default     = ""

  validation {
    condition     = !var.enable_replenishment_scheduler || length(trimspace(var.worker_image_uri)) > 0
    error_message = "worker_image_uri is required when enable_replenishment_scheduler is true."
  }
}

variable "scheduler_service_account_email" {
  description = "Service account used both to run the Cloud Run Job and to let Cloud Scheduler call the Run API."
  type        = string
  default     = "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "job_name" {
  description = "Cloud Run Job name for daily Carousel replenishment."
  type        = string
  default     = "ugc-carousel-replenishment"
}

variable "scheduler_job_name" {
  description = "Cloud Scheduler job name for the quarter-hour Carousel replenishment trigger."
  type        = string
  default     = "ugc-carousel-replenishment-quarter-hour"
}

variable "schedule" {
  description = "Cron schedule for Carousel replenishment."
  type        = string
  default     = "*/15 * * * *"
}

variable "time_zone" {
  description = "Cloud Scheduler timezone."
  type        = string
  default     = "Etc/UTC"
}

variable "scheduler_paused" {
  description = "Keep the Cloud Scheduler trigger paused until production canary approval."
  type        = bool
  default     = true
}

variable "app_base_url_secret_id" {
  description = "Secret Manager secret ID containing the production app base URL."
  type        = string
  default     = "app_base_url"
}

variable "carousel_secret_id" {
  description = "Secret Manager secret ID containing UGC_INTERNAL_CAROUSEL_SECRET."
  type        = string
  default     = "ugc-internal-carousel-secret"
}

variable "page_size" {
  description = "Business profile page size per internal replenishment route call."
  type        = number
  default     = 5

  validation {
    condition     = var.page_size >= 1 && var.page_size <= 10
    error_message = "page_size must be between 1 and 10."
  }
}

variable "request_timeout_ms" {
  description = "Timeout for each internal replenishment route request."
  type        = number
  default     = 50000

  validation {
    condition     = var.request_timeout_ms >= 1000 && var.request_timeout_ms <= 55000
    error_message = "request_timeout_ms must be between 1000 and 55000."
  }
}

variable "task_timeout_seconds" {
  description = "Cloud Run task timeout for one replenishment sweep execution."
  type        = number
  default     = 900
}

variable "task_max_retries" {
  description = "Cloud Run task retries within a single scheduled execution."
  type        = number
  default     = 2
}

variable "scheduler_attempt_deadline_seconds" {
  description = "Cloud Scheduler HTTP attempt deadline for starting the Cloud Run Job execution."
  type        = number
  default     = 180
}

variable "cpu" {
  description = "CPU limit for the scheduler runner task."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit for the scheduler runner task."
  type        = string
  default     = "512Mi"
}
