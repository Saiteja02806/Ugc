terraform {
  backend "gcs" {
    bucket = "ugcsaas-terraform-state"
    prefix = "terraform/gcp-video-render-worker"
  }
}
