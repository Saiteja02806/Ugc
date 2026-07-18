resource "google_pubsub_topic" "jobs" {
  for_each = local.queue_configs

  project = var.project_id
  name    = each.value.topic
  labels  = merge(local.labels, { component = "job-queue" })

  depends_on = [google_project_service.required]
}

resource "google_pubsub_topic" "dlq" {
  for_each = local.queue_configs

  project = var.project_id
  name    = each.value.dlq_topic
  labels  = merge(local.labels, { component = "job-dlq" })

  depends_on = [google_project_service.required]
}

resource "google_pubsub_subscription" "jobs" {
  for_each = local.queue_configs

  project                    = var.project_id
  name                       = each.value.subscription
  topic                      = google_pubsub_topic.jobs[each.key].id
  ack_deadline_seconds       = each.value.ack_deadline_seconds
  message_retention_duration = "604800s"
  retain_acked_messages      = false
  labels                     = merge(local.labels, { component = "job-subscription" })

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dlq[each.key].id
    max_delivery_attempts = each.value.max_delivery_attempts
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

resource "google_pubsub_subscription" "dlq" {
  for_each = local.queue_configs

  project                    = var.project_id
  name                       = each.value.dlq_subscription
  topic                      = google_pubsub_topic.dlq[each.key].id
  ack_deadline_seconds       = 300
  message_retention_duration = "1209600s"
  retain_acked_messages      = false
  labels                     = merge(local.labels, { component = "job-dlq-subscription" })
}

resource "google_pubsub_topic_iam_member" "app_publisher" {
  for_each = google_pubsub_topic.jobs

  project = var.project_id
  topic   = each.value.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_pubsub_subscription_iam_member" "worker_subscriber" {
  for_each = google_pubsub_subscription.jobs

  project      = var.project_id
  subscription = each.value.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_pubsub_topic_iam_member" "pubsub_service_agent_dlq_publisher" {
  for_each = google_pubsub_topic.dlq

  project = var.project_id
  topic   = each.value.name
  role    = "roles/pubsub.publisher"
  member  = local.pubsub_service_agent
}

resource "google_pubsub_subscription_iam_member" "pubsub_service_agent_source_subscriber" {
  for_each = google_pubsub_subscription.jobs

  project      = var.project_id
  subscription = each.value.name
  role         = "roles/pubsub.subscriber"
  member       = local.pubsub_service_agent
}
