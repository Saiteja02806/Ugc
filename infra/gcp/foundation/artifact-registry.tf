resource "google_artifact_registry_repository" "worker" {
  project       = var.project_id
  location      = var.region
  repository_id = "${var.name_prefix}-worker"
  description   = "Docker images for UGC background workers"
  format        = "DOCKER"
  labels        = merge(local.labels, { component = "artifact-registry" })

  depends_on = [google_project_service.required]
}

resource "google_artifact_registry_repository_iam_member" "worker_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.worker.location
  repository = google_artifact_registry_repository.worker.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_artifact_registry_repository_iam_member" "deploy_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.worker.location
  repository = google_artifact_registry_repository.worker.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}
