export const PRODUCT_FEEDBACK_TYPES = [
  "support_ticket",
  "feature_request",
] as const;

export type ProductFeedbackType = (typeof PRODUCT_FEEDBACK_TYPES)[number];

export type ProductFeedbackStatus =
  | "new"
  | "reviewing"
  | "planned"
  | "resolved"
  | "declined";

export type ProductFeedbackAttachment = {
  fileName: string;
  height: number;
  mimeType: string;
  sizeBytes: number;
  width: number;
};

export type ProductFeedbackItem = {
  attachment: ProductFeedbackAttachment | null;
  createdAt: string;
  description: string;
  id: string;
  status: ProductFeedbackStatus;
  title: string;
  type: ProductFeedbackType;
  userDisplayName: string | null;
  userEmail: string | null;
  userId: string;
};
