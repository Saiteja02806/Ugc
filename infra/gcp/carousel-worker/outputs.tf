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

output "carousel_edit_worker_service_uri" {
  value       = var.enable_carousel_edit_worker ? google_cloud_run_v2_service.carousel_edit_worker[0].uri : null
  description = "Set GCP_CAROUSEL_EDIT_TASK_URL to this base service URI; dispatch appends /tasks/jobs."
}

output "storage_public_base_url" {
  value       = var.gcp_storage_public_base_url
  description = "Public base URL used for rendered Carousel media."
}
