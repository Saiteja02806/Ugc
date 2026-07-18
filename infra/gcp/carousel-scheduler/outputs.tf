output "cloud_run_job_name" {
  value       = var.enable_replenishment_scheduler ? google_cloud_run_v2_job.carousel_replenishment[0].name : null
  description = "Cloud Run Job name for Carousel replenishment when enabled."
}

output "cloud_run_job_location" {
  value       = var.enable_replenishment_scheduler ? google_cloud_run_v2_job.carousel_replenishment[0].location : null
  description = "Cloud Run Job region for Carousel replenishment when enabled."
}

output "scheduler_job_name" {
  value       = var.enable_replenishment_scheduler ? google_cloud_scheduler_job.carousel_replenishment[0].name : null
  description = "Cloud Scheduler job name when enabled."
}

output "scheduler_paused" {
  value       = var.enable_replenishment_scheduler ? google_cloud_scheduler_job.carousel_replenishment[0].paused : null
  description = "Whether the Cloud Scheduler job is paused."
}

output "schedule" {
  value       = var.schedule
  description = "Configured Carousel replenishment cron schedule."
}

output "worker_image_uri" {
  value       = var.worker_image_uri
  description = "Worker image URI configured for the scheduler runner."
}
