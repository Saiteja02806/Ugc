data "google_service_account" "scheduler" {
  count = var.enable_replenishment_scheduler ? 1 : 0

  account_id = local.scheduler_account_id
  project    = var.project_id
}

resource "google_secret_manager_secret_iam_member" "scheduler_secret_accessor" {
  for_each = var.enable_replenishment_scheduler ? toset([
    var.app_base_url_secret_id,
    var.carousel_secret_id,
  ]) : toset([])

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.scheduler_service_account_email}"
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_can_run_cloud_run_job" {
  count = var.enable_replenishment_scheduler ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_job.carousel_replenishment[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.scheduler_service_account_email}"
}

resource "google_service_account_iam_member" "cloud_scheduler_can_mint_scheduler_oauth" {
  count = var.enable_replenishment_scheduler ? 1 : 0

  service_account_id = data.google_service_account.scheduler[0].name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.cloud_scheduler_service_agent
}

resource "google_cloud_run_v2_job" "carousel_replenishment" {
  count = var.enable_replenishment_scheduler ? 1 : 0

  project  = var.project_id
  name     = var.job_name
  location = var.region
  labels   = local.labels

  template {
    task_count  = 1
    parallelism = 1

    template {
      service_account = var.scheduler_service_account_email
      max_retries     = var.task_max_retries
      timeout         = "${var.task_timeout_seconds}s"

      containers {
        image   = var.worker_image_uri
        command = ["node"]
        args    = ["dist/scheduler/replenish-daily-carousels.js"]

        resources {
          limits = {
            cpu    = var.cpu
            memory = var.memory
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name = "APP_BASE_URL"
          value_source {
            secret_key_ref {
              secret  = var.app_base_url_secret_id
              version = "latest"
            }
          }
        }

        env {
          name = "UGC_INTERNAL_CAROUSEL_SECRET"
          value_source {
            secret_key_ref {
              secret  = var.carousel_secret_id
              version = "latest"
            }
          }
        }

        env {
          name  = "CAROUSEL_REPLENISHMENT_PAGE_SIZE"
          value = tostring(var.page_size)
        }

        env {
          name  = "CAROUSEL_REPLENISHMENT_REQUEST_TIMEOUT_MS"
          value = tostring(var.request_timeout_ms)
        }
      }
    }
  }

  depends_on = [
    google_secret_manager_secret_iam_member.scheduler_secret_accessor,
  ]
}

resource "google_cloud_scheduler_job" "carousel_replenishment" {
  count = var.enable_replenishment_scheduler ? 1 : 0

  project     = var.project_id
  name        = var.scheduler_job_name
  region      = var.region
  description = "Starts the Cloud Run Job that replenishes daily Carousel feeds."
  schedule    = var.schedule
  time_zone   = var.time_zone
  paused      = var.scheduler_paused

  attempt_deadline = "${var.scheduler_attempt_deadline_seconds}s"

  retry_config {
    retry_count          = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_doublings        = 3
  }

  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${var.job_name}:run"
    body        = base64encode("{}")

    headers = {
      "Content-Type" = "application/json"
    }

    oauth_token {
      service_account_email = var.scheduler_service_account_email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }

  depends_on = [
    google_cloud_run_v2_job.carousel_replenishment,
    google_cloud_run_v2_job_iam_member.scheduler_can_run_cloud_run_job,
    google_service_account_iam_member.cloud_scheduler_can_mint_scheduler_oauth,
  ]
}
