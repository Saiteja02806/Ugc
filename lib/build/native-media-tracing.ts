/** Trace the build host's runtime binaries; do not ship other platforms' probes. */
export function nativeMediaTracing(platform = process.platform, arch = process.arch) {
  const ffmpeg = `./node_modules/ffmpeg-static/${platform === "win32" ? "ffmpeg.exe" : "ffmpeg"}`;
  const ffprobe = `./node_modules/ffprobe-static/bin/${platform}/${arch}/${platform === "win32" ? "ffprobe.exe" : "ffprobe"}`;
  const probeFiles = [
    "./node_modules/ffprobe-static/index.js",
    "./node_modules/ffprobe-static/package.json",
    ffprobe,
  ];
  const otherProbeBinaries = [
    ...["darwin", "linux", "win32"].filter(target => target !== platform)
      .map(target => `./node_modules/ffprobe-static/bin/${target}/**/*`),
    `./node_modules/ffprobe-static/bin/${platform}/!(${arch})/**/*`,
  ];
  return { ffmpegFiles: [ffmpeg], mediaFiles: [ffmpeg, ...probeFiles], otherProbeBinaries };
}
