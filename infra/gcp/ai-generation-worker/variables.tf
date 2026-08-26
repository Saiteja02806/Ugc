variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "ugcsaas"
}

variable "region" {
  description = "Region for the Cloud Run AI-generation worker service."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment label for AI-generation worker resources."
  type        = string
  default     = "prod"
}

variable "enable_ai_generation_worker" {
  description = "Set true after the worker image, Cloud Tasks queue, storage env, and AI Secret Manager versions are ready."
  type        = bool
  default     = false
}

variable "worker_image_uri" {
  description = "Artifact Registry image URI for the worker container."
  type        = string
  default     = ""
}

variable "worker_service_account_email" {
  description = "Service account used by the AI-generation worker service."
  type        = string
  default     = "ugc-worker-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "scheduler_service_account_email" {
  description = "Service account used by Cloud Tasks to invoke this worker."
  type        = string
  default     = "ugc-scheduler-sa@ugcsaas.iam.gserviceaccount.com"
}

variable "service_name" {
  description = "Cloud Run Service name for the AI-generation worker."
  type        = string
  default     = "ugc-ai-generation-worker"
}

variable "queue_name" {
  description = "Logical worker queue name stored on background_jobs."
  type        = string
  default     = "ai-generation"
}

variable "worker_job_types" {
  description = "Comma-separated job types allowed for this worker service."
  type        = string
  default     = "generate_avatar,generate_image,generate_hook_video,generate_trending_hook_copy,hook_text_generation,wall_text_content_plan_generation,wall_text_generation,media_analysis,analytics_sync,carousel_content_plan_generation"
}

variable "worker_visibility_timeout_seconds" {
  description = "Worker delivery visibility timeout for image/avatar/hook-video generation jobs."
  type        = number
  default     = 1800
}

variable "min_instance_count" {
  description = "Minimum request-based Cloud Run instances. Use 0 to eliminate idle worker CPU cost; Cloud Run starts instances when Cloud Tasks delivers work."
  type        = number
  default     = 0
}

variable "max_instance_count" {
  description = "Maximum concurrent single-job AI worker instances. Keep this aligned with the ai-generation Cloud Tasks concurrent-dispatch limit and provider quotas."
  type        = number
  default     = 10
}

variable "request_timeout_seconds" {
  description = "Cloud Run request timeout for health checks and incidental requests."
  type        = number
  default     = 1800
}

variable "cpu" {
  description = "CPU limit for AI-generation worker service."
  type        = string
  default     = "2"
}

variable "memory" {
  description = "Memory limit for AI-generation worker service."
  type        = string
  default     = "4Gi"
}

variable "container_port" {
  description = "HTTP health port exposed by the worker container."
  type        = number
  default     = 8080
}

variable "storage_provider" {
  description = "Storage provider for generated image, avatar, and hook-video assets."
  type        = string
  default     = "gcp"
}

variable "gcp_storage_bucket" {
  description = "GCS bucket for generated AI assets."
  type        = string
  default     = "ugcsaas-media"
}

variable "gcp_storage_public_base_url" {
  description = "Public base URL for GCS media used by generated AI assets."
  type        = string
  default     = "https://storage.googleapis.com/ugcsaas-media"
}

variable "openai_api_key_secret_id" {
  description = "Secret Manager secret ID injected as OPENAI_API_KEY."
  type        = string
  default     = "openai-api-key"
}

variable "openai_image_model" {
  description = "OpenAI image generation model used by generate_image and generate_avatar."
  type        = string
  default     = "gpt-image-2"
}

variable "gemini_image_model" {
  description = "Gemini image generation model used by worker image-generation flows."
  type        = string
  default     = "gemini-3.1-flash-image"
}

variable "gemini_omni_model" {
  description = "Gemini multimodal model used by worker analysis flows."
  type        = string
  default     = "gemini-omni-flash-preview"
}

variable "gemini_api_key_secret_id" {
  description = "Secret Manager secret ID injected as GEMINI_API_KEY for Veo hook-video generation."
  type        = string
  default     = "gemini-api-key"
}

variable "runwayml_api_secret_id" {
  description = "Secret Manager secret ID injected as RUNWAYML_API_SECRET for Runway hook-video fallback."
  type        = string
  default     = "runwayml-api-secret"
}

variable "runway_daily_credit_limit" {
  description = "Maximum Runway credits the worker may spend during one UTC calendar day."
  type        = number
  default     = 100

  validation {
    condition     = var.runway_daily_credit_limit > 0 && floor(var.runway_daily_credit_limit) == var.runway_daily_credit_limit
    error_message = "runway_daily_credit_limit must be a positive integer."
  }
}

variable "internal_app_url" {
  description = "Production app base URL used for authenticated background persistence calls."
  type        = string
  default     = "https://www.getugcpilot.com"
}

variable "scheduling_secret_id" {
  description = "Secret Manager secret ID used to authenticate internal worker calls."
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
