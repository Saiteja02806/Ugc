locals {
  social_publish_worker_image_uri = trimspace(var.social_publish_worker_image_uri) != "" ? var.social_publish_worker_image_uri : var.worker_image_uri

  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    migration   = "aws-to-gcp"
    slice       = "worker-canary"
  }
}
