resource "google_service_account" "app" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-app-sa"
  display_name = "UGC web/API runtime"
  description  = "Runtime identity for the Next.js app/API when running on GCP."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "worker" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-worker-sa"
  display_name = "UGC worker runtime"
  description  = "Runtime identity for Cloud Run worker pools/services."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "scheduler" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-scheduler-sa"
  display_name = "UGC scheduler/runtime invoker"
  description  = "Identity used by Cloud Tasks and future Cloud Scheduler jobs."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "deploy" {
  project      = var.project_id
  account_id   = "${var.name_prefix}-deploy-sa"
  display_name = "UGC deploy identity"
  description  = "Identity for CI/CD to push images and deploy Cloud Run resources."

  depends_on = [google_project_service.required]
}
