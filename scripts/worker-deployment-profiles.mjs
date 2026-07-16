export const workerProfiles = {
  "ai-generation": {
    defaultDesiredCount: "1",
    defaultImageModel: "gpt-image-1",
    defaultLogStreamPrefix: "ai-generation",
    defaultServiceName: "ugc-ai-generation-worker-service",
    defaultTaskFamily: "ugc-ai-generation-worker-task",
    defaultVisibilityTimeoutSeconds: "1800",
    envPrefix: "ECS_AI_GENERATION",
    jobTypes: ["generate_avatar", "generate_image", "generate_hook_video"],
    queueName: "ai-generation",
    queueUrlEnv: "UGC_AI_GENERATION_QUEUE_URL",
    secretKeys: ["OPENAI_API_KEY", "GEMINI_API_KEY", "RUNWAYML_API_SECRET"],
  },
  carousel: {
    defaultDesiredCount: "1",
    defaultLogStreamPrefix: "carousel-worker",
    defaultServiceName: "ugc-carousel-worker-service",
    defaultTaskFamily: "ugc-carousel-worker-task",
    defaultVisibilityTimeoutSeconds: "900",
    envPrefix: "ECS_CAROUSEL",
    jobTypes: ["generate_carousel"],
    queueName: "carousel",
    queueUrlEnv: "UGC_CAROUSEL_QUEUE_URL",
    secretKeys: ["OPENAI_API_KEY"],
  },
  "video-render": {
    defaultDesiredCount: "1",
    defaultLogStreamPrefix: "video-render",
    defaultServiceName: "ugc-video-render-worker-service",
    defaultTaskFamily: "ugc-video-render-worker-task",
    defaultVisibilityTimeoutSeconds: "900",
    envPrefix: "ECS_VIDEO_RENDER",
    jobTypes: ["render_edit_video", "render_schedule_combination"],
    queueName: "video-render",
    queueUrlEnv: "UGC_VIDEO_RENDER_QUEUE_URL",
  },
  "social-publish": {
    defaultDesiredCount: "1",
    defaultLogStreamPrefix: "social-publish",
    defaultServiceName: "ugc-social-publish-worker-service",
    defaultTaskFamily: "ugc-social-publish-worker-task",
    defaultVisibilityTimeoutSeconds: "300",
    envPrefix: "ECS_SOCIAL_PUBLISH",
    jobTypes: ["publish_social_post"],
    queueName: "social-publish",
    queueUrlEnv: "UGC_SOCIAL_PUBLISH_QUEUE_URL",
    secretKeyAlternatives: [
      {
        keys: ["OAUTH_TOKEN_ENCRYPTION_KEY", "SOCIAL_TOKEN_ENCRYPTION_KEY"],
        overrideEnv: "ECS_SOCIAL_PUBLISH_TOKEN_SECRET_KEY",
      },
    ],
    secretSources: {
      GOOGLE_CLIENT_ID: {
        required: false,
        secretArnEnv: "ECS_SOCIAL_PUBLISH_GOOGLE_CLIENT_ID_SECRET_ARN",
        workerSecretFallbackEnv:
          "ECS_SOCIAL_PUBLISH_USE_WORKER_SECRET_GOOGLE_OAUTH",
        workerSecretKey: "GOOGLE_CLIENT_ID",
      },
      GOOGLE_CLIENT_SECRET: {
        required: false,
        secretArnEnv: "ECS_SOCIAL_PUBLISH_GOOGLE_CLIENT_SECRET_SECRET_ARN",
        workerSecretFallbackEnv:
          "ECS_SOCIAL_PUBLISH_USE_WORKER_SECRET_GOOGLE_OAUTH",
        workerSecretKey: "GOOGLE_CLIENT_SECRET",
      },
    },
  },
};

export const implementedWorkerJobTypes = new Set([
  "generate_avatar",
  "generate_carousel",
  "generate_hook_video",
  "generate_image",
  "publish_social_post",
  "render_edit_video",
  "render_schedule_combination",
  "test_worker_job",
]);
