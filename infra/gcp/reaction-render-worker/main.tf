locals {
  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    runtime     = "gcp-only"
    slice       = "reaction-render-worker"
  }
}

resource "google_cloud_run_v2_service" "reaction_render_worker" {
  count = var.enable_reaction_render_worker ? 1 : 0

  project  = var.project_id
  name     = var.service_name
  location = var.region
  labels   = local.labels
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account                  = var.worker_service_account_email
    timeout                          = "${var.request_timeout_seconds}s"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = var.min_instance_count
      max_instance_count = var.max_instance_count
    }

    containers {
      image = var.worker_image_uri

      ports {
        container_port = var.container_port
      }

      resources {
        # One request renders exactly one Reel. CPU is allocated only while a
        # Cloud Task is active and scales all the way back to zero when idle.
        cpu_idle          = true
        startup_cpu_boost = true

        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      startup_probe {
        failure_threshold     = 12
        initial_delay_seconds = 0
        period_seconds        = 5
        timeout_seconds       = 3

        http_get {
          path = "/healthz"
          port = var.container_port
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "WORKER_QUEUE_NAME"
        value = var.queue_name
      }

      env {
        name  = "WORKER_JOB_TYPES"
        value = "reaction_render"
      }

      env {
        name  = "WORKER_VISIBILITY_TIMEOUT_SECONDS"
        value = tostring(var.worker_visibility_timeout_seconds)
      }

      env {
        name  = "WORKER_RUNTIME_NAME"
        value = "gcp-cloud-run-service"
      }

      env {
        name  = "WORKER_ID"
        value = "${var.service_name}:${var.worker_version}:${var.worker_git_commit}"
      }

      env {
        name  = "WORKER_VERSION"
        value = var.worker_version
      }

      env {
        name  = "WORKER_GIT_COMMIT"
        value = var.worker_git_commit
      }

      env {
        name  = "STORAGE_PROVIDER"
        value = "gcp"
      }

      env {
        name  = "GCP_STORAGE_BUCKET"
        value = var.gcp_storage_bucket
      }

      env {
        name  = "GCP_STORAGE_PUBLIC_BASE_URL"
        value = var.gcp_storage_public_base_url
      }

      # Each completed item immediately asks the app to refresh the Trending
      # feed. The durable reconciliation outbox still recovers this if the
      # request is temporarily unavailable.
      env {
        name  = "UGC_INTERNAL_APP_URL"
        value = var.internal_app_url
      }

      env {
        name = "SUPABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "supabase-url"
            version = "latest"
          }
        }
      }

      env {
        name = "SUPABASE_SERVICE_ROLE_KEY"
        value_source {
          secret_key_ref {
            secret  = "supabase-service-role-key"
            version = "latest"
          }
        }
      }
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

resource "google_cloud_run_v2_service_iam_member" "cloud_tasks_invoker" {
  count = var.enable_reaction_render_worker ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.reaction_render_worker[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.scheduler_service_account_email}"
}
