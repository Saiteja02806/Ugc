resource "google_cloud_tasks_queue" "social_publish_scheduler" {
  project  = var.project_id
  name     = "${var.name_prefix}-social-publish-scheduler"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts       = 5
    max_backoff        = "600s"
    max_doublings      = 5
    max_retry_duration = "3600s"
    min_backoff        = "10s"
  }

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "app_cloud_tasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_service_account_iam_member" "app_can_attach_scheduler_oidc" {
  service_account_id = google_service_account.scheduler.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.app.email}"
}

resource "google_service_account_iam_member" "cloud_tasks_can_mint_scheduler_oidc" {
  service_account_id = google_service_account.scheduler.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.cloud_tasks_service_agent
}
