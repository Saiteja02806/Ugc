import publicFrames from "./hook-curated-frames.json" with { type: "json" };
import creatorFrames from "./creator-source-frames.json" with { type: "json" };

export const HOOK_FULL_RECREATION_PILOT_REFERENCE_ID = "explore-paired-hook-fc44f6214b6e17413600ec13";
export const HOOK_FULL_RECREATION_PILOT_SOURCE_SHA256 = "405670a27856c31e698a0ef13b178ece82c18cc379c0cec7489b0c1c1414fa1e";

export const hookFullRecreationPilot = {
  version: 1 as const,
  referenceId: HOOK_FULL_RECREATION_PILOT_REFERENCE_ID,
  sourceSha256: HOOK_FULL_RECREATION_PILOT_SOURCE_SHA256,
  sourceDurationSeconds: 3.8,
  animationOpeningFrame: { index: 0, timeSeconds: 0 },
  identityClarityAnchor: {
    index: 70,
    timeSeconds: 2.333333,
    presentationTimeSeconds: 2.399349,
    sha256: "df452e82eadb2e7ed8338f34e2424e623b59ef4015d646a2a3c89d63a34d5a9c",
    width: 720,
    height: 1280,
  },
} as const;

export type HookFullRecreationPilot = {
  version: 1;
  referenceId: string;
  sourceSha256: string;
  sourceDurationSeconds: number;
  animationOpeningFrame: { index: 0; timeSeconds: 0 };
  identityClarityAnchor: { index: number; timeSeconds: number; presentationTimeSeconds: number; sha256: string; width: number; height: number };
};

/** Reviewed decoded frame counts, on the elapsed source clock at 30 fps.
 * Provenance only: private prompt prose stays server-only. Keep the original
 * Hook 100 object above frozen for accepted receipt recovery. */
const fullRecreationFrameCounts: Readonly<Record<string, number>> = {
  "explore-paired-hook-03d314d5268b8c31ec390bf1": 73,
  "explore-paired-hook-43cc1dae0a6cfcb03e0a9333": 258,
  "explore-paired-hook-e683292d4cd22b2a8b5a9cd8": 88,
  "explore-paired-hook-f1afdb3229e127c8b6563087": 97,
  "explore-paired-hook-09c4e9b5de6a85f0f4c371da": 98,
  "explore-paired-hook-9309a041061ae5abc6970d52": 63,
  "explore-paired-hook-bdc5af5aedfac3ddb93b4348": 105,
  "explore-paired-hook-99ff813ebc24c61f1c92828e": 116,
  "explore-paired-hook-4aa27111a23b04a6dd27717b": 72,
  "explore-paired-hook-892b0f65083c8cf03270a7c9": 83,
  "explore-paired-hook-c8b971f4cea086703e106c92": 84,
  "explore-paired-hook-114b58d5c22018e273a346de": 104,
  "explore-paired-hook-775bf4f0fc41f253d04663e2": 91,
  "explore-paired-hook-8d49391ade6ddf5261d43d2a": 90,
  "explore-paired-hook-bee95bd7a34b5d2a72775282": 181,
  "explore-paired-hook-61eb29067f56267684b7cfe6": 82,
  "explore-paired-hook-f12c90a72871c0cdaf3503db": 118,
  "explore-paired-hook-50dd086ef9d1c758d5ae3bb5": 86,
  "explore-paired-hook-fc44f6214b6e17413600ec13": 112,
  "explore-paired-hook-ddcfb2950d40f37771058b73": 113,
  "explore-paired-hook-185ed6ac17073e3bc1b8f6b5": 100,
  "creator-account-1-01": 81,
  "creator-account-1-02": 82,
  "creator-account-1-03": 61,
  "creator-account-1-06": 76,
  "creator-account-2-01": 125,
  "creator-account-2-02": 76,
  "creator-account-2-03": 87,
  "creator-account-2-04": 117,
  "creator-account-2-05": 96,
  "creator-account-2-06": 95,
};

export function getHookFullRecreationPilot(referenceId: string, sourceSha256: string): HookFullRecreationPilot | undefined {
  if (referenceId === hookFullRecreationPilot.referenceId && sourceSha256 === hookFullRecreationPilot.sourceSha256) return hookFullRecreationPilot;
  const frameCount = fullRecreationFrameCounts[referenceId];
  const frame = publicFrames.frames.find(row => row.referenceId === referenceId)
    ?? creatorFrames.frames.find(row => row.referenceId === referenceId);
  if (!frameCount || !frame || frame.index <= 0 || frame.sourceSha256 !== sourceSha256) return undefined;
  return { version: 1, referenceId, sourceSha256, sourceDurationSeconds: frameCount / 30,
    animationOpeningFrame: { index: 0, timeSeconds: 0 },
    identityClarityAnchor: { index: frame.index, timeSeconds: frame.timeSeconds,
      presentationTimeSeconds: frame.presentationTimeSeconds, sha256: frame.sha256, width: frame.width, height: frame.height } };
}

export function matchesHookFullRecreationPilotAnchor(referenceId: string, sourceSha256: string, frame: {
  index: number; timeSeconds: number; sha256: string; width: number; height: number;
}) {
  const pilot = getHookFullRecreationPilot(referenceId, sourceSha256);
  return Boolean(pilot && (["index", "timeSeconds", "sha256", "width", "height"] as const)
    .every(key => pilot.identityClarityAnchor[key] === frame[key]));
}

export function isHookFullRecreationPilotOpeningFrame(referenceId: string, sourceSha256: string, frame: {
  index: number; timeSeconds: number; width: number; height: number; sha256: string;
}) {
  const pilot = getHookFullRecreationPilot(referenceId, sourceSha256);
  return Boolean(pilot && frame.index === pilot.animationOpeningFrame.index && frame.timeSeconds === pilot.animationOpeningFrame.timeSeconds &&
    frame.width === pilot.identityClarityAnchor.width && frame.height === pilot.identityClarityAnchor.height && /^[a-f0-9]{64}$/.test(frame.sha256));
}
