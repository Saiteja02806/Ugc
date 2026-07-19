terraform {
  backend "gcs" {
    bucket = "ugcsaas-terraform-state"
    prefix = "terraform/gcp-ai-generation-worker"
  }
}
