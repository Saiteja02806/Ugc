import sharp from "sharp";

/** 1.2% of the CIE L range. Both starting frames and slideshow face swaps use this. */
export const STARTING_FRAME_HARMONIZER_GRAIN = 0.012;

export type HarmonizerOptions = {
  grainIntensity?: number;
};

const FACE_OUTER = { x0: 0.18, x1: 0.82, y0: 0.05, y1: 0.58 };
const FACE_INNER = { x0: 0.3, x1: 0.7, y0: 0.12, y1: 0.46 };
const MAX_L_SHIFT = 12;
const D65 = { x: 0.95047, y: 1, z: 1.08883 };

/**
 * Relights skin in the face region toward the other skin in the photograph,
 * in CIE LAB, then adds Gaussian grain on the L channel.
 * The shift is bounded. A frame without enough skin in both regions keeps its light and only receives grain.
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
  for (let i = 0; i < pixelCount; i += 1) {
    const offset = i * 4;
    const [l, a, b] = rgbToLab(source[offset], source[offset + 1], source[offset + 2]);
    const labOffset = i * 3;
    lab[labOffset] = l;
    lab[labOffset + 1] = a;
    lab[labOffset + 2] = b;
  }

  const faceHistogram = new Uint32Array(101);
  const referenceHistogram = new Uint32Array(101);
  const faceWeight = new Float32Array(pixelCount);
  let faceCount = 0;
  let referenceCount = 0;
  for (let y = 0; y < height; y += 1) {
    const ny = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const labOffset = index * 3;
      if (!isSkin(lab[labOffset], lab[labOffset + 1], lab[labOffset + 2])) continue;
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
    const bounded = Math.max(-MAX_L_SHIFT, Math.min(MAX_L_SHIFT, gap * 0.7));
    if (Math.abs(bounded) >= 1) shift = bounded;
  }

  const intensity = options.grainIntensity ?? STARTING_FRAME_HARMONIZER_GRAIN;
  const grain = Math.max(0, intensity) * 100;
  const nextGaussian = grain > 0 ? createGaussian(42) : null;
  const output = Buffer.alloc(pixelCount * 4);
  for (let i = 0; i < pixelCount; i += 1) {
    const labOffset = i * 3;
    const weight = faceWeight[i];
    let l = lab[labOffset] + (weight > 0 ? shift * weight : 0);
    if (nextGaussian) l += nextGaussian() * grain;
    l = Math.max(0, Math.min(100, l));
    const [r, g, b] = labToRgb(l, lab[labOffset + 1], lab[labOffset + 2]);
    const offset = i * 4;
    output[offset] = r;
    output[offset + 1] = g;
    output[offset + 2] = b;
    output[offset + 3] = source[offset + 3];
  }

  const buffer = await sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
  return { buffer, width, height };
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
