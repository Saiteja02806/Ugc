variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "ugcsaas"
}

variable "region" {
  description = "Region for the Cloud Run canary job."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment label for canary resources."
  type        = string
  default     = "prod"
}

variable "name_prefix" {
  description = "Short prefix for resource names."
  type        = string
  default     = "ugc"
}

variable "enable_canary_job" {
  description = "Set true only when worker_image_uri and required secret values are ready."
  type        = bool
  default     = false
}

variable "worker_image_uri" {
  description = "Artifact Registry image URI for the worker container."
  type        = string
  default     = ""
}

variable "worker_service_account_email" {
  description = "Service account used by the worker canary job."
  type        = string
  default     = "ugc-worker-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "canary_job_name" {
  description = "Cloud Run Job name for the one-off worker canary."
  type        = string
  default     = "ugc-worker-canary-test"
}

variable "pubsub_subscription_name" {
  description = "Pub/Sub subscription the canary worker pulls from."
  type        = string
  default     = "ugc-media-processing-sub"
}

variable "queue_name" {
  description = "Logical worker queue name stored on background_jobs."
  type        = string
  default     = "media-processing"
}

variable "worker_job_types" {
  description = "Comma-separated job types allowed for this canary worker."
  type        = string
  default     = "test_worker_job"
}

variable "worker_poll_wait_seconds" {
  description = "Pub/Sub pull wait behavior. Use a small non-zero wait so one-off Cloud Run canaries do not exit before Pub/Sub returns a message."
  type        = number
  default     = 10
}

variable "worker_visibility_timeout_seconds" {
  description = "Worker delivery visibility timeout."
  type        = number
  default     = 300
}

variable "task_timeout_seconds" {
  description = "Cloud Run task timeout for the one-off canary job."
  type        = number
  default     = 900
}

variable "cpu" {
  description = "CPU limit for the canary worker task."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit for the canary worker task."
  type        = string
  default     = "1Gi"
}

variable "enable_social_publish_canary_job" {
  description = "Set true only for the fake-target social-publish worker queue canary."
  type        = bool
  default     = false
}

variable "social_publish_canary_job_name" {
  description = "Cloud Run Job name for the one-off social-publish worker canary."
  type        = string
  default     = "ugc-social-publish-worker-canary"
}

variable "social_publish_worker_image_uri" {
  description = "Optional Artifact Registry image URI for the social-publish canary. Defaults to worker_image_uri when blank."
  type        = string
  default     = ""
}

variable "social_publish_pubsub_subscription_name" {
  description = "Pub/Sub subscription the social-publish canary worker pulls from."
  type        = string
  default     = "ugc-social-publish-sub"
}

variable "social_publish_queue_name" {
  description = "Logical queue name for social publish background jobs."
  type        = string
  default     = "social-publish"
}

variable "social_publish_worker_job_types" {
  description = "Comma-separated job types allowed for the social-publish canary worker."
  type        = string
  default     = "publish_social_post"
}

variable "social_publish_worker_poll_max_messages" {
  description = "Maximum Pub/Sub messages the one-off social-publish canary may pull in one run. Higher than 1 lets it drain stale terminal canary messages first."
  type        = number
  default     = 10
}
