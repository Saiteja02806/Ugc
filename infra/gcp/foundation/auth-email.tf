# The existing Vercel app identity can generate Firebase email action links.
# This role grants only the link-generation API permission, with no admin role.
resource "google_project_iam_custom_role" "auth_email_sender" {
  project     = var.project_id
  role_id     = "ugcAuthEmailSender"
  title       = "UGC authentication email links"
  description = "Generate Firebase verification and password-reset email links."
  permissions = ["firebaseauth.users.sendEmail"]
}

resource "google_project_iam_member" "app_auth_email_sender" {
  project = var.project_id
  role    = google_project_iam_custom_role.auth_email_sender.name
  member  = "serviceAccount:${google_service_account.app.email}"
}
