output "project_id" {
  value       = var.project_id
  description = "Google Cloud project ID."
}

output "project_number" {
  value       = var.project_number
  description = "Google Cloud project number."
}

output "state_bucket_name" {
  value       = google_storage_bucket.terraform_state.name
  description = "Terraform remote state bucket name."
}
