resource "google_monitoring_alert_policy" "pubsub_dlq_backlog" {
  for_each = var.enable_monitoring_alerts ? local.queue_configs : {}

  project               = var.project_id
  display_name          = "UGC ${each.value.dlq_subscription} has messages"
  combiner              = "OR"
  enabled               = true
  notification_channels = var.monitoring_notification_channels

  conditions {
    display_name = "DLQ backlog is greater than zero"

    condition_threshold {
      comparison      = "COMPARISON_GT"
      duration        = "300s"
      filter          = "resource.type = \"pubsub_subscription\" AND metric.type = \"pubsub.googleapis.com/subscription/num_undelivered_messages\" AND resource.label.subscription_id = \"${each.value.dlq_subscription}\""
      threshold_value = 0

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }

      trigger {
        count = 1
      }
    }
  }

  depends_on = [google_pubsub_subscription.dlq]
}
