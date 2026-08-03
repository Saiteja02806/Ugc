locals {
  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    runtime     = "gcp-only"
    slice       = "ai-generation-worker"
  }
}
