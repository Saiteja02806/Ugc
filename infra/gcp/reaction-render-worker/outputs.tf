output "service_name" {
  value       = try(google_cloud_run_v2_service.reaction_render_worker[0].name, null)
  description = "Dedicated Reaction render Cloud Run service name."
}

output "service_uri" {
  value       = try(google_cloud_run_v2_service.reaction_render_worker[0].uri, null)
  description = "Cloud Tasks target base URI. Append /tasks/jobs."
}
