locals {
  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    migration   = "aws-to-gcp"
    slice       = "video-render-worker"
  }
}
