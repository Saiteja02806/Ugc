output "social_publish_worker_service_name" {
  value       = var.enable_social_publish_worker ? google_cloud_run_v2_service.social_publish_worker[0].name : null
  description = "Cloud Run Service name for the social-publish worker when enabled."
}

output "social_publish_worker_service_uri" {
  value       = var.enable_social_publish_worker ? google_cloud_run_v2_service.social_publish_worker[0].uri : null
  description = "Cloud Run Service URI for the social-publish worker when enabled."
}

output "worker_image_uri" {
  value       = var.worker_image_uri
  description = "Worker image URI configured for the social-publish worker."
}

output "pubsub_subscription_name" {
  value       = var.pubsub_subscription_name
  description = "Pub/Sub subscription configured for the social-publish worker."
}

output "social_reconciliation_enabled" {
  value       = var.social_reconciliation_enabled
  description = "Whether DB recovery reconciliation is enabled for this worker."
}
