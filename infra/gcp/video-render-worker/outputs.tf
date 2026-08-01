output "video_render_worker_service_name" {
  value       = var.enable_video_render_worker ? google_cloud_run_v2_service.video_render_worker[0].name : null
  description = "Cloud Run Service name for the video-render worker when enabled."
}

output "video_render_worker_service_uri" {
  value       = var.enable_video_render_worker ? google_cloud_run_v2_service.video_render_worker[0].uri : null
  description = "Cloud Run Service URI for the video-render worker when enabled."
}

output "video_render_worker_job_name" {
  value       = var.enable_video_render_worker ? google_cloud_run_v2_job.video_render_worker[0].name : null
  description = "Cloud Run Job name used for long-running render executions."
}

output "worker_image_uri" {
  value       = var.worker_image_uri
  description = "Worker image URI configured for the video-render worker."
}

output "storage_public_base_url" {
  value       = var.gcp_storage_public_base_url
  description = "Public base URL used for rendered video media."
}
