terraform {
  backend "gcs" {
    bucket = "ugcsaas-terraform-state"
    prefix = "terraform/gcp-social-publish-worker"
  }
}
