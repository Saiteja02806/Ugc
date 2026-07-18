export type CreateSocialPublishScheduleInput = {
  jobId: string;
  scheduledFor: string;
  targetId: string;
};

export type SocialPublishSchedule = {
  arn: string | null;
  name: string;
};
