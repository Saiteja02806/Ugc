resource "google_project_service" "storage" {
  project            = var.project_id
  service            = "storage.googleapis.com"
  disable_on_destroy = false
}

resource "google_storage_bucket" "terraform_state" {
  project                     = var.project_id
  name                        = var.state_bucket_name
  location                    = var.state_bucket_location
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
  labels                      = merge(var.labels, { component = "terraform-state" })

  versioning {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.storage]
}
