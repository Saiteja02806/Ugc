export type BackgroundAudioSource = "hook" | "wall";

export type BackgroundAudioTrack = {
  id: string;
  source: BackgroundAudioSource;
  name: string;
  durationSeconds: number;
  moods: string[];
  energy: string;
  loopable: boolean;
};

export type BackgroundAudioLibrary = { tracks: BackgroundAudioTrack[] };
