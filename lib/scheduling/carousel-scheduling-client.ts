import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type {
  ScheduleCreateInput,
  ScheduleCreateTargetInput,
  ScheduledPost,
} from "@/lib/scheduling/types";

export type CarouselScheduleSubmission = {
  caption: string;
  scheduledDate: string;
  scheduledFor: string;
  scheduledTime: string;
  targets: ScheduleCreateTargetInput[];
  timezone: string;
  useDefaultScheduleTime?: boolean;
};

export type CreateCarouselScheduleInput = {
  assignmentId?: string;
  carouselId: string;
  idempotencyKey: string;
  libraryItemId: string;
  sourceSurface: "library" | "trending";
  submission: CarouselScheduleSubmission;
  title: string;
};

type ScheduleResponse =
  | {
      created?: boolean;
      ok: true;
      schedule: ScheduledPost;
    }
  | {
      code?: string;
      message: string;
      ok: false;
    };

const successfulTargetStatuses = new Set([
  "published",
  "publishing",
  "scheduled",
]);

export class CarouselScheduleRecoveryError extends Error {
  readonly draftId: string | null;

  constructor(message: string, draftId: string | null) {
    super(message);
    this.draftId = draftId;
    this.name = "CarouselScheduleRecoveryError";
  }
}

export function createCarouselScheduleIdempotencyKey(
  scope: "library" | "trending",
  sourceId: string,
) {
  return `carousel-${scope}:${sourceId}:${globalThis.crypto.randomUUID()}`.slice(
    0,
    120,
  );
}

export async function createAndPublishCarouselSchedule(
  input: CreateCarouselScheduleInput,
) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before scheduling this carousel.");
  }

  const requestBody = buildCarouselScheduleRequest(input);
  const createResponse = await fetch("/api/schedules", {
    body: JSON.stringify(requestBody),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const createData = (await createResponse.json().catch(() => null)) as
    | ScheduleResponse
    | null;

  if (!createResponse.ok || createData?.ok !== true) {
    throw new Error(
      createData?.ok === false
        ? createData.message
        : "Could not save this carousel schedule.",
    );
  }

  let draft = createData.schedule;

  if (isSuccessfullyScheduled(draft, input.submission.targets)) {
    return draft;
  }

  if (draft.targets.length === 0 && createData.created === false) {
    const updateResponse = await fetch(`/api/schedules/${draft.id}`, {
      body: JSON.stringify({
        ...requestBody,
        expectedUpdatedAt: draft.updatedAt,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
    const updateData = (await updateResponse.json().catch(() => null)) as
      | ScheduleResponse
      | null;

    if (!updateResponse.ok || updateData?.ok !== true) {
      throw new CarouselScheduleRecoveryError(
        updateData?.ok === false
          ? updateData.message
          : "The draft was saved, but its latest scheduling details could not be updated.",
        draft.id,
      );
    }

    draft = updateData.schedule;
  }

  const connectionIds = input.submission.targets.map(
    (target) => target.connectionId,
  );
  const publishResponse = await fetch(`/api/schedules/${draft.id}/publish`, {
    body: JSON.stringify({
      connectionIds,
      timezone: input.submission.timezone,
    }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const publishData = (await publishResponse.json().catch(() => null)) as
    | ScheduleResponse
    | null;

  if (!publishResponse.ok || publishData?.ok !== true) {
    throw new CarouselScheduleRecoveryError(
      publishData?.ok === false
        ? `Draft saved, but scheduling did not start: ${publishData.message}`
        : "The draft was saved, but scheduling did not start.",
      draft.id,
    );
  }

  if (!isSuccessfullyScheduled(publishData.schedule, input.submission.targets)) {
    throw new CarouselScheduleRecoveryError(
      "The draft was saved, but one or more platform schedules need attention.",
      publishData.schedule.id,
    );
  }

  return publishData.schedule;
}

export function buildCarouselScheduleRequest(
  input: CreateCarouselScheduleInput,
): ScheduleCreateInput {
  const { submission } = input;

  return {
    caption: submission.caption,
    idempotencyKey: input.idempotencyKey,
    metadata: {
      assignmentId: input.assignmentId,
      carouselId: input.carouselId,
      mediaMode: "carousel",
      plannedScheduledFor: submission.scheduledFor,
      scheduledDate: submission.scheduledDate,
      scheduledTime: submission.scheduledTime,
      sourceSurface: input.sourceSurface,
    },
    plannedTargets: submission.targets,
    scheduledDate: submission.scheduledDate,
    scheduledFor: submission.scheduledFor,
    scheduledTime: submission.scheduledTime,
    source: {
      id: input.libraryItemId,
      kind: "library_item",
    },
    targets: [],
    timezone: submission.timezone,
    title: input.title.slice(0, 160),
    useDefaultScheduleTime: submission.useDefaultScheduleTime,
  };
}

function isSuccessfullyScheduled(
  schedule: ScheduledPost,
  targets: ScheduleCreateTargetInput[],
) {
  if (!schedule.scheduledFor || targets.length === 0) {
    return false;
  }

  const scheduledTargetsByConnectionId = new Map(
    schedule.targets.map((target) => [target.socialConnectionId, target]),
  );

  return targets.every((target) => {
    const scheduledTarget = scheduledTargetsByConnectionId.get(
      target.connectionId,
    );

    return Boolean(
      scheduledTarget && successfulTargetStatuses.has(scheduledTarget.status),
    );
  });
}
