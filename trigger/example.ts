import { logger, task } from "@trigger.dev/sdk";

export const helloWorldTask = task({
  id: "hello-world",
  run: async (payload: { message?: string }) => {
    logger.info("Hello from Trigger.dev", {
      message: payload.message ?? "UGC Trigger.dev setup is ready.",
    });

    return {
      ok: true,
      message: payload.message ?? "UGC Trigger.dev setup is ready.",
    };
  },
});
