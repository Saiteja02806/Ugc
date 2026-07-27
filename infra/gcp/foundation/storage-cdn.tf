resource "google_storage_bucket" "media" {
  project                     = var.project_id
  name                        = var.media_bucket_name
  location                    = var.media_bucket_location
  force_destroy               = false
  public_access_prevention    = var.media_bucket_public_read ? "inherited" : "enforced"
  uniform_bucket_level_access = true
  labels                      = merge(local.labels, { component = "media-storage" })

  cors {
    origin          = var.media_cors_origins
    method          = ["GET", "HEAD", "PUT"]
    response_header = ["Content-Type", "Content-Length", "ETag", "x-goog-resumable"]
    max_age_seconds = 3600
  }

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket_iam_member" "app_object_admin" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

resource "google_storage_bucket_iam_member" "worker_object_admin" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_storage_bucket_iam_member" "public_media_read" {
  count = var.media_bucket_public_read ? 1 : 0

  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_service_account_iam_member" "app_can_sign_urls" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.app.email}"
}

resource "google_compute_global_address" "media_cdn" {
  count = var.enable_media_cdn ? 1 : 0

  project     = var.project_id
  name        = "${local.resource_prefix}-media-cdn-ip"
  description = "Global IP for UGC media Cloud CDN."

  depends_on = [google_project_service.required]
}

resource "google_compute_backend_bucket" "media" {
  count = var.enable_media_cdn ? 1 : 0

  project     = var.project_id
  name        = "${local.resource_prefix}-media-backend"
  bucket_name = google_storage_bucket.media.name
  enable_cdn  = true
  description = "Cloud CDN backend bucket for generated media."

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    client_ttl        = 3600
    default_ttl       = 3600
    max_ttl           = 31536000
    negative_caching  = true
    serve_while_stale = 86400
  }
}

resource "google_compute_url_map" "media_cdn" {
  count = var.enable_media_cdn ? 1 : 0

  project         = var.project_id
  name            = "${local.resource_prefix}-media-cdn-url-map"
  default_service = google_compute_backend_bucket.media[0].id
}

resource "google_compute_target_http_proxy" "media_cdn" {
  count = var.enable_media_cdn ? 1 : 0

  project = var.project_id
  name    = "${local.resource_prefix}-media-cdn-http-proxy"
  url_map = google_compute_url_map.media_cdn[0].id
}

resource "google_compute_global_forwarding_rule" "media_cdn_http" {
  count = var.enable_media_cdn ? 1 : 0

  project               = var.project_id
  name                  = "${local.resource_prefix}-media-cdn-http"
  ip_address            = google_compute_global_address.media_cdn[0].address
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "80"
  target                = google_compute_target_http_proxy.media_cdn[0].id
}

resource "google_compute_managed_ssl_certificate" "media_cdn" {
  count = var.enable_media_cdn && length(var.cdn_domain_names) > 0 ? 1 : 0

  project = var.project_id
  name    = "${local.resource_prefix}-media-cdn-cert"

  managed {
    domains = var.cdn_domain_names
  }
}

resource "google_compute_target_https_proxy" "media_cdn" {
  count = var.enable_media_cdn && length(var.cdn_domain_names) > 0 ? 1 : 0

  project          = var.project_id
  name             = "${local.resource_prefix}-media-cdn-https-proxy"
  url_map          = google_compute_url_map.media_cdn[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.media_cdn[0].id]
}

resource "google_compute_global_forwarding_rule" "media_cdn_https" {
  count = var.enable_media_cdn && length(var.cdn_domain_names) > 0 ? 1 : 0

  project               = var.project_id
  name                  = "${local.resource_prefix}-media-cdn-https"
  ip_address            = google_compute_global_address.media_cdn[0].address
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "443"
  target                = google_compute_target_https_proxy.media_cdn[0].id
}
