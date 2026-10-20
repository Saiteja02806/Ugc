import { config, higgsfield } from "@higgsfield/client/v2";

const credentials = process.env.HF_CREDENTIALS;
if (!credentials || !/^[^:\s]+:[^:\s]+$/.test(credentials)) {
  console.error("Set HF_CREDENTIALS in .env.local as key-id:key-secret before running this example.");
  process.exitCode = 1;
} else {
  config({ credentials, maxPollTime: 15 * 60_000, maxRetries: 0 });

  try {
    const result = await higgsfield.subscribe(
      "bytedance/seedance-2.5/text-to-video",
      {
        input: {
          prompt: "A cinematic scene at sunset",
          duration: 5,
          resolution: "720p",
          aspect_ratio: "16:9",
          output_format: "mp4",
        },
        withPolling: true,
      },
    );

    if (result.status !== "completed") {
      throw new Error(
        result.status === "nsfw"
          ? "Seedance request was moderated."
          : `Seedance request ended with status ${result.status}.`,
      );
    }
    if (!result.video?.url || !/^https:\/\//i.test(result.video.url)) {
      throw new Error("Seedance completed without a video URL.");
    }

    console.log(result.video.url);
  } catch (error) {
    // Do not print SDK error objects: they may contain request headers.
    console.error(error instanceof Error && /^(Seedance request|Seedance completed)/.test(error.message)
      ? error.message
      : "Seedance generation failed. Check the provider request dashboard.");
    process.exitCode = 1;
  }
}
