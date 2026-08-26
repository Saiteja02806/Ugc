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

locals {
  background_job_task_queues = {
    ai-generation = {
      # One request occupies one Cloud Run instance. This matches the AI
      # worker's initial max_instance_count of 10, so a burst can grow instead
      # of being artificially held at four concurrent jobs.
      concurrent_dispatches = 10
      dispatches_per_second = 5
      max_attempts          = 5
      max_retry_duration    = "3600s"
    }
    carousel = {
      # Do not dispatch parallel Carousel writers until the durable Carousel
      # assignment reservation is made safe for more than one worker.
      concurrent_dispatches = 1
      dispatches_per_second = 1
      max_attempts          = 5
      max_retry_duration    = "3600s"
    }
    media-processing = {
      concurrent_dispatches = 10
      dispatches_per_second = 5
      max_attempts          = 5
      max_retry_duration    = "3600s"
    }
    social-publish = {
      # The current social-publish worker has a single safe execution slot.
      concurrent_dispatches = 1
      dispatches_per_second = 1
      max_attempts          = 5
      max_retry_duration    = "3600s"
    }
    video-render = {
      # This limits launcher requests only. It is not an active Cloud Run Job
      # concurrency guard; add a durable render-slot gate before increasing
      # the number of simultaneously launched render jobs.
      concurrent_dispatches = 2
      dispatches_per_second = 1
      max_attempts          = 4
      max_retry_duration    = "7200s"
    }
  }
}

resource "google_cloud_tasks_queue" "background_jobs" {
  for_each = local.background_job_task_queues

  project  = var.project_id
  name     = "${var.name_prefix}-${each.key}"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = each.value.concurrent_dispatches
    max_dispatches_per_second = each.value.dispatches_per_second
  }

  retry_config {
    max_attempts       = each.value.max_attempts
    max_backoff        = "600s"
    max_doublings      = 5
    max_retry_duration = each.value.max_retry_duration
    min_backoff        = "10s"
  }

  stackdriver_logging_config {
    sampling_ratio = 1
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

resource "google_service_account_iam_member" "cloud_scheduler_can_mint_scheduler_oidc" {
  service_account_id = google_service_account.scheduler.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = local.cloud_scheduler_service_agent
}

resource "google_cloud_scheduler_job" "background_job_recovery" {
  count = var.enable_background_job_recovery_scheduler ? 1 : 0

  project     = var.project_id
  region      = var.region
  name        = "${var.name_prefix}-background-job-recovery"
  description = "Recover stale Supabase background jobs and redispatch them through Cloud Tasks."
  schedule    = var.background_job_recovery_schedule
  time_zone   = "Etc/UTC"

  attempt_deadline = "60s"

  retry_config {
    retry_count          = 3
    min_backoff_duration = "10s"
    max_backoff_duration = "120s"
    max_doublings        = 3
  }

  http_target {
    http_method = "POST"
    uri         = var.background_job_recovery_url
    body        = base64encode("{}")

    headers = {
      "Content-Type" = "application/json"
    }

    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = var.background_job_recovery_url
    }
  }

  depends_on = [
    google_project_service.required,
    google_service_account_iam_member.cloud_scheduler_can_mint_scheduler_oidc,
  ]
}
