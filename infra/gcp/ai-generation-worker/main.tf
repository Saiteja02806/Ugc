resource "google_cloud_run_v2_service" "ai_generation_worker" {
  count = var.enable_ai_generation_worker ? 1 : 0

  project  = var.project_id
  name     = var.service_name
  location = var.region
  labels   = local.labels
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  lifecycle {
    # Reaction planning creates one durable render job per selected Reel. Those
    # jobs cannot reach the dedicated renderer unless this worker is given its
    # exact Cloud Run task endpoint. Fail the plan before a partial daily pack
    # can be committed with undeliverable Reaction items.
    precondition {
      condition = !contains(
        [for job_type in split(",", var.worker_job_types) : trimspace(job_type)],
        "reaction_generation",
      ) || can(regex(
        "^https://[^/?#]+/tasks/jobs$",
        trimspace(var.reaction_render_task_url),
      ))
      error_message = "reaction_render_task_url must be the dedicated HTTPS Reaction worker /tasks/jobs endpoint whenever worker_job_types includes reaction_generation."
    }
  }

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
        # Request-based billing: Cloud Run starts instances for queued HTTP work
        # and can scale back to zero after it completes. Each worker request is
        # deliberately single-concurrency because an AI/provider call owns the
        # full job lifetime.
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
        name  = "GCP_CLOUD_TASKS_LOCATION"
        value = var.region
      }

      env {
        name  = "GCP_CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL"
        value = var.scheduler_service_account_email
      }

      env {
        name  = "GCP_RESOURCE_NAME_PREFIX"
        value = var.resource_name_prefix
      }

      env {
        name  = "GCP_WALL_TEXT_PUBLICATION_TASKS_QUEUE"
        value = var.wall_text_publication_tasks_queue
      }

      env {
        name  = "GCP_REACTION_RENDER_TASKS_QUEUE"
        value = var.reaction_render_tasks_queue
      }

      env {
        name  = "GCP_REACTION_RENDER_TASK_URL"
        value = var.reaction_render_task_url
      }

      env {
        name  = "GCP_REACTION_RENDER_TASK_AUDIENCE"
        value = var.reaction_render_task_audience
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
        name  = "OPENAI_IMAGE_MODEL"
        value = var.openai_image_model
      }

      env {
        name  = "GEMINI_IMAGE_MODEL"
        value = var.gemini_image_model
      }

      env {
        name  = "GEMINI_OMNI_MODEL"
        value = var.gemini_omni_model
      }

      env {
        name  = "RUNWAY_DAILY_CREDIT_LIMIT"
        value = tostring(var.runway_daily_credit_limit)
      }

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

      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.openai_api_key_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.gemini_api_key_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "RUNWAYML_API_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.runwayml_api_secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "UGC_INTERNAL_SCHEDULING_SECRET"
        value_source {
          secret_key_ref {
            secret  = var.scheduling_secret_id
            version = "latest"
          }
        }
      }
    }
  }

  # Always direct Cloud Tasks to the latest healthy worker revision. Without an
  # explicit traffic target, an older revision pin can keep newly deployed
  # worker code from receiving any jobs.
  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }
}

resource "google_cloud_run_v2_service_iam_member" "cloud_tasks_invoker" {
  count = var.enable_ai_generation_worker ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.ai_generation_worker[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${var.scheduler_service_account_email}"
}
