const MIN_MP4_HEADER_BYTES = 12;

export function assertGeneratedMp4(buffer: Buffer) {
  if (buffer.length < MIN_MP4_HEADER_BYTES) {
    throw new Error("Generated video output is empty or incomplete.");
  }

  if (buffer.subarray(4, 8).toString("ascii") !== "ftyp") {
    throw new Error("Generated video output is not a valid MP4 container.");
  }

  return buffer;
}
