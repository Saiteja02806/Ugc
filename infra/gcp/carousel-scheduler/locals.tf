locals {
  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    runtime     = "gcp-only"
    slice       = "carousel-scheduler"
  }

  cloud_scheduler_service_agent = "serviceAccount:service-${var.project_number}@gcp-sa-cloudscheduler.iam.gserviceaccount.com"
  scheduler_account_id          = split("@", var.scheduler_service_account_email)[0]
}
