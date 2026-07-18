output "carousel_worker_service_name" {
  value       = var.enable_carousel_worker ? google_cloud_run_v2_service.carousel_worker[0].name : null
  description = "Cloud Run Service name for the Carousel worker when enabled."
}

output "carousel_worker_service_uri" {
  value       = var.enable_carousel_worker ? google_cloud_run_v2_service.carousel_worker[0].uri : null
  description = "Cloud Run Service URI for the Carousel worker when enabled."
}

output "worker_image_uri" {
  value       = var.worker_image_uri
  description = "Worker image URI configured for the Carousel worker."
}

output "pubsub_subscription_name" {
  value       = var.pubsub_subscription_name
  description = "Pub/Sub subscription configured for the Carousel worker."
}

output "storage_public_base_url" {
  value       = var.gcp_storage_public_base_url
  description = "Public base URL used for rendered Carousel media."
}
