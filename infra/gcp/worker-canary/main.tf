resource "google_cloud_run_v2_job" "worker_canary" {
  count = var.enable_canary_job ? 1 : 0

  project  = var.project_id
  name     = var.canary_job_name
  location = var.region
  labels   = local.labels

  template {
    task_count  = 1
    parallelism = 1

    template {
      service_account = var.worker_service_account_email
      max_retries     = 0
      timeout         = "${var.task_timeout_seconds}s"

      containers {
        image = var.worker_image_uri

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
          name  = "WORKER_PUBSUB_SUBSCRIPTION"
          value = var.pubsub_subscription_name
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
          name  = "WORKER_RUN_ONCE"
          value = "true"
        }

        env {
          name  = "WORKER_POLL_MAX_MESSAGES"
          value = "1"
        }

        env {
          name  = "WORKER_POLL_WAIT_SECONDS"
          value = tostring(var.worker_poll_wait_seconds)
        }

        env {
          name  = "WORKER_VISIBILITY_TIMEOUT_SECONDS"
          value = tostring(var.worker_visibility_timeout_seconds)
        }

        env {
          name  = "WORKER_RUNTIME_NAME"
          value = "gcp-cloud-run-job"
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
  }
}
