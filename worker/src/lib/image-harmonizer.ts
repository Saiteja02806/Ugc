import sharp from "sharp";

/** 1.2% of the CIE L range. Both starting frames and slideshow face swaps use this. */
export const STARTING_FRAME_HARMONIZER_GRAIN = 0.012;

export type HarmonizerOptions = {
  grainIntensity?: number;
};

const FACE_OUTER = { x0: 0.18, x1: 0.82, y0: 0.05, y1: 0.58 };
const FACE_INNER = { x0: 0.3, x1: 0.7, y0: 0.12, y1: 0.46 };
const MAX_L_SHIFT = 12;
const MIN_TEXTURE_SCALE = 0.8;
const MAX_TEXTURE_SCALE = 1.4;
const D65 = { x: 0.95047, y: 1, z: 1.08883 };

/**
 * Matches the strength of the face's fine skin grain to the other skin in the
 * photograph, in CIE LAB, then adds Gaussian grain on the L channel.
 * The face keeps its own pores and freckles. A darker face can be lifted by a
 * bounded amount. A brighter face is left alone, so a lit face is not pulled
 * down toward a hand in shadow. A frame without enough skin in both regions
 * keeps its light and texture and only receives grain.
 */
export async function harmonizeStartingFrameImage(
  inputBuffer: Buffer,
  options: HarmonizerOptions = {},
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const decoded = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = decoded.info.width;
  const height = decoded.info.height;
  if (!width || !height || decoded.info.channels !== 4) {
    throw new Error("Harmonizer could not read the image size.");
  }

  const source = decoded.data;
  const pixelCount = width * height;
  const lab = new Float32Array(pixelCount * 3);
  const lightness = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) {
    const offset = i * 4;
    const [l, a, b] = rgbToLab(source[offset], source[offset + 1], source[offset + 2]);
    const labOffset = i * 3;
    lab[labOffset] = l;
    lab[labOffset + 1] = a;
    lab[labOffset + 2] = b;
    lightness[i] = l;
  }

  const faceHistogram = new Uint32Array(101);
  const referenceHistogram = new Uint32Array(101);
  const faceWeight = new Float32Array(pixelCount);
  const skin = new Uint8Array(pixelCount);
  let faceCount = 0;
  let referenceCount = 0;
  for (let y = 0; y < height; y += 1) {
    const ny = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const labOffset = index * 3;
      if (!isSkin(lab[labOffset], lab[labOffset + 1], lab[labOffset + 2])) continue;
      skin[index] = 1;
      const weight = faceRegionWeight((x + 0.5) / width, ny);
      faceWeight[index] = weight;
      const bin = Math.max(0, Math.min(100, Math.round(lab[labOffset])));
      if (weight >= 0.999) {
        faceHistogram[bin] += 1;
        faceCount += 1;
      } else if (weight === 0) {
        referenceHistogram[bin] += 1;
        referenceCount += 1;
      }
    }
  }

  const minimum = Math.max(48, Math.round(pixelCount * 0.002));
  let shift = 0;
  if (faceCount >= minimum && referenceCount >= minimum) {
    const gap = medianFromHistogram(referenceHistogram, referenceCount) - medianFromHistogram(faceHistogram, faceCount);
    // Darkening toward a shadowed hand made the lit face dull and speckled.
    // Only lift a face that is darker than the other skin.
    if (gap >= 1) {
      const bounded = Math.min(MAX_L_SHIFT, gap * 0.7);
      if (bounded >= 1) shift = bounded;
    }
  }

  const texture = faceCount >= minimum && referenceCount >= minimum
    ? referenceSkinTextureScale(lightness, skin, faceWeight, width, height)
    : null;

  const intensity = options.grainIntensity ?? STARTING_FRAME_HARMONIZER_GRAIN;
  const grain = Math.max(0, intensity) * 100;
  const nextGaussian = grain > 0 ? createGaussian(42) : null;
  const output = Buffer.alloc(pixelCount * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const labOffset = index * 3;
      const weight = faceWeight[index];
      let l = lab[labOffset];
      if (texture && weight > 0 && skin[index]) {
        l += texture.residual[index] * (texture.scale - 1) * weight;
      }
      if (weight > 0 && skin[index]) l += shift * weight;
      if (nextGaussian) l += nextGaussian() * grain;
      l = Math.max(0, Math.min(100, l));
      const [r, g, b] = labToRgb(l, lab[labOffset + 1], lab[labOffset + 2]);
      const offset = index * 4;
      output[offset] = r;
      output[offset + 1] = g;
      output[offset + 2] = b;
      output[offset + 3] = source[offset + 3];
    }
  }

  const buffer = await sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { buffer, width, height };
}

function referenceSkinTextureScale(
  lightness: Float32Array,
  skin: Uint8Array,
  faceWeight: Float32Array,
  width: number,
  height: number,
) {
  const radius = Math.max(1, Math.min(3, Math.round(Math.min(width, height) / 400)));
  const blurred = boxBlur(lightness, width, height, radius);
  const residual = new Float32Array(lightness.length);
  let faceSum = 0;
  let faceSquares = 0;
  let faceSamples = 0;
  let referenceSum = 0;
  let referenceSquares = 0;
  let referenceSamples = 0;
  for (let index = 0; index < residual.length; index += 1) {
    const value = lightness[index] - blurred[index];
    residual[index] = value;
    if (!skin[index]) continue;
    const weight = faceWeight[index];
    if (weight >= 0.999) {
      faceSum += value;
      faceSquares += value * value;
      faceSamples += 1;
    } else if (weight === 0) {
      referenceSum += value;
      referenceSquares += value * value;
      referenceSamples += 1;
    }
  }
  if (faceSamples < 48 || referenceSamples < 48) return null;
  const faceDeviation = deviation(faceSum, faceSquares, faceSamples);
  const referenceDeviation = deviation(referenceSum, referenceSquares, referenceSamples);
  if (faceDeviation < 0.2 || referenceDeviation < 0.2) return null;
  const scale = Math.max(MIN_TEXTURE_SCALE, Math.min(MAX_TEXTURE_SCALE, referenceDeviation / faceDeviation));
  if (Math.abs(scale - 1) < 0.05) return null;
  return { residual, scale };
}

function deviation(sum: number, sumSquares: number, count: number) {
  const mean = sum / count;
  return Math.sqrt(Math.max(0, sumSquares / count - mean * mean));
}

function boxBlur(source: Float32Array, width: number, height: number, radius: number) {
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const window = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) sum += source[row + clampIndex(offset, width)];
    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = sum / window;
      sum += source[row + clampIndex(x + radius + 1, width)] - source[row + clampIndex(x - radius, width)];
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) sum += horizontal[clampIndex(offset, height) * width + x];
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / window;
      sum += horizontal[clampIndex(y + radius + 1, height) * width + x] - horizontal[clampIndex(y - radius, height) * width + x];
    }
  }
  return output;
}

function clampIndex(value: number, size: number) {
  if (value < 0) return 0;
  if (value >= size) return size - 1;
  return value;
}

function faceRegionWeight(nx: number, ny: number) {
  return Math.min(
    axisWeight(nx, FACE_OUTER.x0, FACE_INNER.x0, FACE_INNER.x1, FACE_OUTER.x1),
    axisWeight(ny, FACE_OUTER.y0, FACE_INNER.y0, FACE_INNER.y1, FACE_OUTER.y1),
  );
}

function axisWeight(value: number, outerStart: number, innerStart: number, innerEnd: number, outerEnd: number) {
  if (value <= outerStart || value >= outerEnd) return 0;
  if (value >= innerStart && value <= innerEnd) return 1;
  if (value < innerStart) return (value - outerStart) / (innerStart - outerStart);
  return (outerEnd - value) / (outerEnd - innerEnd);
}

function isSkin(l: number, a: number, b: number) {
  return l >= 20 && l <= 90 && a >= 6 && a <= 30 && b >= 8 && b <= 35;
}

function medianFromHistogram(histogram: Uint32Array, count: number) {
  const target = (count - 1) / 2;
  let seen = 0;
  let lower = 0;
  for (let bin = 0; bin < histogram.length; bin += 1) {
    const next = seen + histogram[bin];
    if (next > Math.floor(target) && seen <= Math.floor(target)) lower = bin;
    if (next > Math.ceil(target)) return (lower + bin) / 2;
    seen = next;
  }
  return lower;
}

function createGaussian(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return () => {
    const u = Math.max(next(), 1e-12);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

function srgbToLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number) {
  const value = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, value * 255)));
}

function pivot(value: number) {
  const cubed = value ** 3;
  return cubed > 0.008856 ? cubed : (value - 16 / 116) / 7.787037;
}

function rgbToLab(r: number, g: number, b: number) {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);
  const x = red * 0.4124564 + green * 0.3575761 + blue * 0.1804375;
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  const z = red * 0.0193339 + green * 0.119192 + blue * 0.9503041;
  const fx = labPivot(x / D65.x);
  const fy = labPivot(y / D65.y);
  const fz = labPivot(z / D65.z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)] as const;
}

function labPivot(value: number) {
  return value > 0.008856 ? Math.cbrt(value) : 7.787037 * value + 16 / 116;
}

function labToRgb(l: number, a: number, b: number) {
  const fy = (l + 16) / 116;
  const x = D65.x * pivot(a / 500 + fy);
  const y = D65.y * pivot(fy);
  const z = D65.z * pivot(fy - b / 200);
  return [
    linearToSrgb(x * 3.2404542 + y * -1.5371385 + z * -0.4985314),
    linearToSrgb(x * -0.969266 + y * 1.8760108 + z * 0.041556),
    linearToSrgb(x * 0.0556434 + y * -0.2040259 + z * 1.0572252),
  ] as const;
}
