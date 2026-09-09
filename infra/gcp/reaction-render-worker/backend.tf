terraform {
  backend "gcs" {
    bucket = "ugcsaas-terraform-state"
    prefix = "terraform/gcp-reaction-render-worker"
  }
}
