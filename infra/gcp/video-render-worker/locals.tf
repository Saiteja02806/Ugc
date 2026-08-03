locals {
  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    runtime     = "gcp-only"
    slice       = "video-render-worker"
  }

  video_render_job_env = {
    GCP_PROJECT_ID                    = var.project_id
    GOOGLE_CLOUD_PROJECT              = var.project_id
    QUEUE_PROVIDER                    = "gcp"
    WORKER_QUEUE_PROVIDER             = "gcp"
    WORKER_TRANSPORT                  = "cloud-tasks"
    WORKER_QUEUE_NAME                 = var.queue_name
    WORKER_JOB_TYPES                  = var.worker_job_types
    WORKER_RUN_ONCE                   = "true"
    WORKER_RUNTIME_NAME               = "gcp-cloud-run-job"
    WORKER_VERSION                    = var.worker_version
    WORKER_GIT_COMMIT                 = var.worker_git_commit
    WORKER_VISIBILITY_TIMEOUT_SECONDS = tostring(var.worker_visibility_timeout_seconds)
    STORAGE_PROVIDER                  = var.storage_provider
    GCP_STORAGE_BUCKET                = var.gcp_storage_bucket
    GCP_STORAGE_PUBLIC_BASE_URL       = var.gcp_storage_public_base_url
    UGC_INTERNAL_APP_URL              = var.internal_app_url
  }
}
