output "project_id" {
  value       = var.project_id
  description = "Google Cloud project ID."
}

output "service_accounts" {
  value = {
    app       = google_service_account.app.email
    worker    = google_service_account.worker.email
    scheduler = google_service_account.scheduler.email
    deploy    = google_service_account.deploy.email
  }
  description = "Service account emails created by the foundation."
}

output "artifact_registry_worker_repository" {
  value       = google_artifact_registry_repository.worker.name
  description = "Artifact Registry repository for worker images."
}

output "media_bucket_name" {
  value       = google_storage_bucket.media.name
  description = "Cloud Storage media bucket."
}

output "media_cdn_enabled" {
  value       = var.enable_media_cdn
  description = "Whether the optional media CDN load balancer is enabled."
}

output "media_cdn_ip_address" {
  value       = try(google_compute_global_address.media_cdn[0].address, null)
  description = "Global IP address for the optional media CDN load balancer, or null when disabled."
}

output "cloud_tasks_social_publish_queue" {
  value       = google_cloud_tasks_queue.social_publish_scheduler.name
  description = "Cloud Tasks queue for scheduled social publish dispatch."
}

output "cloud_tasks_background_job_queues" {
  value = {
    for key, queue in google_cloud_tasks_queue.background_jobs : key => queue.name
  }
  description = "Cloud Tasks queues used by the shared durable background-job runtime."
}

output "background_job_recovery_scheduler" {
  value       = try(google_cloud_scheduler_job.background_job_recovery[0].name, null)
  description = "Cloud Scheduler job that invokes durable background-job recovery, when enabled."
}

output "secret_ids" {
  value       = sort(tolist(setunion(var.secret_ids, var.retained_legacy_secret_ids)))
  description = "Secret Manager secret containers managed by the foundation without values."
}
