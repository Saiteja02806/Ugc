resource "google_storage_bucket" "private_audio" {
  count                       = var.private_audio_bucket_name == "" ? 0 : 1
  project                     = var.project_id
  name                        = var.private_audio_bucket_name
  location                    = var.media_bucket_location
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
  labels                      = merge(local.labels, { component = "private-audio" })

  lifecycle {
    prevent_destroy = true
    precondition {
      condition     = var.private_audio_bucket_name != var.media_bucket_name
      error_message = "Private audio must not change the existing public media bucket."
    }
  }
  depends_on = [google_project_service.required]
}

resource "google_project_iam_custom_role" "private_audio_runtime" {
  count       = var.private_audio_bucket_name == "" ? 0 : 1
  project     = var.project_id
  role_id     = "ugcPrivateAudioRuntime"
  title       = "UGC private audio runtime"
  description = "Bounded private audio reads, immutable writes, owner-requested cleanup, and bucket privacy verification."
  permissions = ["storage.buckets.get", "storage.objects.get", "storage.objects.create", "storage.objects.delete"]
}

# Server-only access. No allUsers, browser ACL, CORS or public URL.
resource "google_storage_bucket_iam_member" "private_audio_app" {
  count  = var.private_audio_bucket_name == "" ? 0 : 1
  bucket = google_storage_bucket.private_audio[0].name
  role   = google_project_iam_custom_role.private_audio_runtime[0].name
  member = "serviceAccount:${google_service_account.app.email}"
}
resource "google_storage_bucket_iam_member" "private_audio_worker" {
  count  = var.private_audio_bucket_name == "" ? 0 : 1
  bucket = google_storage_bucket.private_audio[0].name
  role   = google_project_iam_custom_role.private_audio_runtime[0].name
  member = "serviceAccount:${google_service_account.worker.email}"
}
