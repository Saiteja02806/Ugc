terraform {
  backend "gcs" {
    bucket = "ugcsaas-terraform-state"
    prefix = "terraform/gcp-foundation"
  }
}
