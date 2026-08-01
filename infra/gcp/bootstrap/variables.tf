variable "project_id" {
  description = "Google Cloud project ID that will own the Terraform state bucket."
  type        = string
  default     = "ugcsaas"
}

variable "project_number" {
  description = "Google Cloud project number. Kept here for operator verification."
  type        = string
  default     = "58051192797"
}

variable "region" {
  description = "Default Google Cloud region for provider operations."
  type        = string
  default     = "us-central1"
}

variable "state_bucket_name" {
  description = "Globally unique GCS bucket name for Terraform remote state."
  type        = string
  default     = "ugcsaas-terraform-state"
}

variable "state_bucket_location" {
  description = "Location for the Terraform state bucket."
  type        = string
  default     = "US"
}

variable "labels" {
  description = "Labels applied to bootstrap resources."
  type        = map(string)
  default = {
    application = "ugc-pilot"
    environment = "prod"
    managed_by  = "terraform"
    runtime     = "gcp-only"
  }
}
