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

output "media_cdn_ip_address" {
  value       = google_compute_global_address.media_cdn.address
  description = "Global IP address for the media CDN load balancer."
}

output "pubsub_topics" {
  value = {
    for key, topic in google_pubsub_topic.jobs : key => topic.name
  }
  description = "Pub/Sub job topic names."
}

output "pubsub_subscriptions" {
  value = {
    for key, subscription in google_pubsub_subscription.jobs : key => subscription.name
  }
  description = "Pub/Sub job subscription names."
}

output "pubsub_dlq_topics" {
  value = {
    for key, topic in google_pubsub_topic.dlq : key => topic.name
  }
  description = "Pub/Sub dead-letter topic names."
}

output "cloud_tasks_social_publish_queue" {
  value       = google_cloud_tasks_queue.social_publish_scheduler.name
  description = "Cloud Tasks queue for scheduled social publish dispatch."
}

output "secret_ids" {
  value       = sort(tolist(setunion(var.secret_ids, var.retained_legacy_secret_ids)))
  description = "Secret Manager secret containers managed by the foundation without values."
}
