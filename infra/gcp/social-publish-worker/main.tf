resource "google_cloud_run_v2_service" "social_publish_worker" {
  count = var.enable_social_publish_worker ? 1 : 0

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
        cpu_idle          = false
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
        name  = "QUEUE_PROVIDER"
        value = "gcp"
      }

      env {
        name  = "WORKER_QUEUE_PROVIDER"
        value = "gcp"
      }

      env {
        name  = "WORKER_TRANSPORT"
        value = "cloud-tasks"
      }

      env {
        name  = "WORKER_QUEUE_NAME"
        value = var.queue_name
      }

      env {
        name  = "WORKER_JOB_TYPES"
        value = var.worker_job_types
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
        name  = "WORKER_VERSION"
        value = var.worker_version
      }

      env {
        name  = "WORKER_GIT_COMMIT"
        value = var.worker_git_commit
      }

      env {
        name  = "STORAGE_PROVIDER"
        value = var.storage_provider
      }

      env {
        name  = "GCP_STORAGE_BUCKET"
        value = var.gcp_storage_bucket
      }

      env {
        name  = "GCP_STORAGE_PUBLIC_BASE_URL"
        value = var.gcp_storage_public_base_url
      }

      env {
        name  = "SOCIAL_PUBLISH_MAX_ATTEMPTS"
        value = tostring(var.social_publish_max_attempts)
      }

      env {
        name  = "SOCIAL_PUBLISH_RETRY_BASE_SECONDS"
        value = tostring(var.social_publish_retry_base_seconds)
      }

      env {
        name  = "SOCIAL_PUBLISH_RETRY_MAX_SECONDS"
        value = tostring(var.social_publish_retry_max_seconds)
      }

      env {
        name  = "SOCIAL_RECONCILIATION_ENABLED"
        value = tostring(var.social_reconciliation_enabled)
      }

      env {
        name  = "SOCIAL_RECONCILIATION_BATCH_SIZE"
        value = tostring(var.social_reconciliation_batch_size)
      }

      env {
        name  = "SOCIAL_RECONCILIATION_INTERVAL_SECONDS"
        value = tostring(var.social_reconciliation_interval_seconds)
      }

      env {
        name  = "TIKTOK_MEDIA_TRANSFER_MODE"
        value = var.tiktok_media_transfer_mode
      }

      env {
        name  = "TIKTOK_VERIFIED_MEDIA_HOSTS"
        value = var.tiktok_verified_media_hosts
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

      env {
        name = "OAUTH_TOKEN_ENCRYPTION_KEY"
        value_source {
          secret_key_ref {
            secret  = var.token_encryption_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "TIKTOK_CLIENT_KEY"
        value_source {
          secret_key_ref {
            secret  = var.tiktok_client_key_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "TIKTOK_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.tiktok_client_secret_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = var.google_client_id_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.google_client_secret_secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "cloud_tasks_invoker" {
  count = var.enable_social_publish_worker ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.social_publish_worker[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.scheduler_service_account_email}"
}
