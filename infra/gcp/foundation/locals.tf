locals {
  labels = {
    application = "ugc-pilot"
    environment = var.environment
    managed_by  = "terraform"
    migration   = "aws-to-gcp"
  }

  resource_prefix = "${var.name_prefix}-${var.environment}"

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "cloudtasks.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com"
  ])

  pubsub_service_agent      = "serviceAccount:service-${var.project_number}@gcp-sa-pubsub.iam.gserviceaccount.com"
  cloud_tasks_service_agent = "serviceAccount:service-${var.project_number}@gcp-sa-cloudtasks.iam.gserviceaccount.com"

  queue_configs = {
    ai_generation = {
      topic                 = "${var.name_prefix}-ai-generation"
      subscription          = "${var.name_prefix}-ai-generation-sub"
      dlq_topic             = "${var.name_prefix}-ai-generation-dlq"
      dlq_subscription      = "${var.name_prefix}-ai-generation-dlq-sub"
      ack_deadline_seconds  = 600
      max_delivery_attempts = 5
    }
    carousel = {
      topic                 = "${var.name_prefix}-carousel"
      subscription          = "${var.name_prefix}-carousel-sub"
      dlq_topic             = "${var.name_prefix}-carousel-dlq"
      dlq_subscription      = "${var.name_prefix}-carousel-dlq-sub"
      ack_deadline_seconds  = 600
      max_delivery_attempts = 5
    }
    video_render = {
      topic                 = "${var.name_prefix}-video-render"
      subscription          = "${var.name_prefix}-video-render-sub"
      dlq_topic             = "${var.name_prefix}-video-render-dlq"
      dlq_subscription      = "${var.name_prefix}-video-render-dlq-sub"
      ack_deadline_seconds  = 600
      max_delivery_attempts = 5
    }
    media_processing = {
      topic                 = "${var.name_prefix}-media-processing"
      subscription          = "${var.name_prefix}-media-processing-sub"
      dlq_topic             = "${var.name_prefix}-media-processing-dlq"
      dlq_subscription      = "${var.name_prefix}-media-processing-dlq-sub"
      ack_deadline_seconds  = 300
      max_delivery_attempts = 5
    }
    social_publish = {
      topic                 = "${var.name_prefix}-social-publish"
      subscription          = "${var.name_prefix}-social-publish-sub"
      dlq_topic             = "${var.name_prefix}-social-publish-dlq"
      dlq_subscription      = "${var.name_prefix}-social-publish-dlq-sub"
      ack_deadline_seconds  = 300
      max_delivery_attempts = 5
    }
  }
}
