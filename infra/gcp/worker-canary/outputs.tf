output "canary_job_name" {
  value       = var.enable_canary_job ? google_cloud_run_v2_job.worker_canary[0].name : null
  description = "Cloud Run Job name for the worker canary when enabled."
}

output "canary_job_location" {
  value       = var.enable_canary_job ? google_cloud_run_v2_job.worker_canary[0].location : null
  description = "Cloud Run Job location for the worker canary when enabled."
}

output "worker_image_uri" {
  value       = var.worker_image_uri
  description = "Worker image URI configured for the canary."
}

output "pubsub_subscription_name" {
  value       = var.pubsub_subscription_name
  description = "Pub/Sub subscription configured for the canary worker."
}
