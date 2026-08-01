locals {
  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    runtime     = "gcp-only"
  }

  resource_prefix = "${var.name_prefix}-${var.environment}"

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "cloudtasks.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com"
  ])

  cloud_tasks_service_agent     = "serviceAccount:service-${var.project_number}@gcp-sa-cloudtasks.iam.gserviceaccount.com"
  cloud_scheduler_service_agent = "serviceAccount:service-${var.project_number}@gcp-sa-cloudscheduler.iam.gserviceaccount.com"
}
