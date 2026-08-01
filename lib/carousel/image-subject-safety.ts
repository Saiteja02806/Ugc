import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import sharp from "sharp";
import { z } from "zod";

const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";
export const IMAGE_SUBJECT_ANALYZER_VERSION = "openai-vision-v2";

type FaceDetail = {
  BoundingBox?: { Height?: number; Width?: number };
  Confidence?: number;
  FaceOccluded?: { Confidence?: number; Value?: boolean };
};

type Label = {
  Confidence?: number;
  Instances?: unknown[];
  Name?: string;
};

export const SAFE_CAROUSEL_IMAGE_SUBJECT_CLASSES = [
  "object-only",
] as const;

export type CarouselImageSubjectClass =
  | "clear-face"
  | "faceless-human"
  | "object-only";

export type CarouselImageSubjectAnalysis = {
  analyzerVersion: string;
  faceCount: number;
  hasHuman: boolean;
  imageSubjectClass: CarouselImageSubjectClass;
  maxFaceAreaRatio: number;
  maxFaceHeightRatio: number;
  maxFaceWidthRatio: number;
  personCount: number;
  personLabelConfidence: number;
};

const FACE_CONFIDENCE_THRESHOLD = 90;
const PERSON_CONFIDENCE_THRESHOLD = 80;
const CLEAR_FACE_AREA_RATIO = 0.012;
const CLEAR_FACE_DIMENSION_RATIO = 0.12;
const MAX_ANALYSIS_DIMENSION = 1_600;

let openAIClient: OpenAI | null = null;

const OpenAIImageSubjectAnalysisSchema = z.object({
  faceCount: z.number().int().min(0),
  hasHuman: z.boolean(),
  imageSubjectClass: z.enum([
    "clear-face",
    "faceless-human",
    "object-only",
  ]),
  maxFaceAreaRatio: z.number().min(0).max(1),
  personCount: z.number().int().min(0),
});

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for carousel image subject analysis.");
  }

  if (!openAIClient) {
    openAIClient = new OpenAI({ apiKey });
  }

  return openAIClient;
}

function getFaceMeasurements(face: FaceDetail) {
  const width = face.BoundingBox?.Width ?? 0;
  const height = face.BoundingBox?.Height ?? 0;

  return {
    areaRatio: width * height,
    heightRatio: height,
    widthRatio: width,
  };
}

function isConfidentFace(face: FaceDetail) {
  return (face.Confidence ?? 0) >= FACE_CONFIDENCE_THRESHOLD;
}

function isClearlyVisibleFace(face: FaceDetail) {
  if (!isConfidentFace(face)) {
    return false;
  }

  const measurements = getFaceMeasurements(face);
  const confidentlyOccluded =
    face.FaceOccluded?.Value === true &&
    (face.FaceOccluded.Confidence ?? 0) >= FACE_CONFIDENCE_THRESHOLD;

  return (
    !confidentlyOccluded &&
    (measurements.areaRatio >= CLEAR_FACE_AREA_RATIO ||
      measurements.widthRatio >= CLEAR_FACE_DIMENSION_RATIO ||
      measurements.heightRatio >= CLEAR_FACE_DIMENSION_RATIO)
  );
}

function isPersonLabel(label: Label) {
  return ["human", "people", "person"].includes(
    (label.Name ?? "").trim().toLowerCase(),
  );
}

export function classifyCarouselImageSubject(input: {
  faces?: FaceDetail[];
  labels?: Label[];
}): CarouselImageSubjectAnalysis {
  const faces = (input.faces ?? []).filter(isConfidentFace);
  const personLabels = (input.labels ?? []).filter(
    (label) =>
      isPersonLabel(label) &&
      (label.Confidence ?? 0) >= PERSON_CONFIDENCE_THRESHOLD,
  );
  const faceMeasurements = faces.map(getFaceMeasurements);
  const personCount = Math.max(
    ...personLabels.map((label) => label.Instances?.length ?? 0),
    0,
  );
  const personLabelConfidence = Math.max(
    ...personLabels.map((label) => label.Confidence ?? 0),
    0,
  );
  const hasHuman = faces.length > 0 || personLabels.length > 0;
  const hasClearFace = faces.some(isClearlyVisibleFace);

  return {
    analyzerVersion: IMAGE_SUBJECT_ANALYZER_VERSION,
    faceCount: faces.length,
    hasHuman,
    imageSubjectClass: hasClearFace
      ? "clear-face"
      : hasHuman
        ? "faceless-human"
        : "object-only",
    maxFaceAreaRatio: Math.max(
      ...faceMeasurements.map((measurement) => measurement.areaRatio),
      0,
    ),
    maxFaceHeightRatio: Math.max(
      ...faceMeasurements.map((measurement) => measurement.heightRatio),
      0,
    ),
    maxFaceWidthRatio: Math.max(
      ...faceMeasurements.map((measurement) => measurement.widthRatio),
      0,
    ),
    personCount,
    personLabelConfidence,
  };
}

async function normalizeForAnalysis(inputBuffer: Buffer) {
  return sharp(inputBuffer)
    .rotate()
    .resize({
      fit: "inside",
      height: MAX_ANALYSIS_DIMENSION,
      width: MAX_ANALYSIS_DIMENSION,
      withoutEnlargement: true,
    })
    .jpeg({ quality: 84 })
    .toBuffer();
}

async function analyzeCarouselImageSubjectWithOpenAI(
  inputBuffer: Buffer,
): Promise<CarouselImageSubjectAnalysis> {
  const model =
    process.env.CAROUSEL_IMAGE_ANALYSIS_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const imageBytes = await normalizeForAnalysis(inputBuffer);
  const response = await getOpenAIClient().responses.parse({
    input: [
      {
        content: [
          {
            text: [
              "Classify this stock image for use as a background in a multi-slide brand carousel.",
              "Use clear-face when any random person has a recognizable visible face large or sharp enough to establish identity, including side profiles and faces on screens or photographs.",
              "Use faceless-human only when people appear without a recognizable face: hands, cropped bodies, back-facing people, silhouettes, heavily occluded faces, or distant tiny people.",
              "Use object-only when no person or human body part is visible.",
              "Only object-only images are safe for carousel backgrounds. Hands, bodies, silhouettes, and distant people are human-positive and unsafe.",
              "When uncertain between clear-face and faceless-human, choose clear-face.",
              "Estimate face and person counts and the largest visible face area as a fraction from 0 to 1.",
            ].join(" "),
            type: "input_text",
          },
          {
            detail: "high",
            image_url: `data:image/jpeg;base64,${imageBytes.toString("base64")}`,
            type: "input_image",
          },
        ],
        role: "user",
      },
    ],
    model,
    text: {
      format: zodTextFormat(
        OpenAIImageSubjectAnalysisSchema,
        "carousel_image_subject_analysis",
      ),
    },
  });
  const parsed = response.output_parsed;

  if (!parsed) {
    throw new Error("OpenAI returned no parsed carousel image subject analysis.");
  }

  return {
    analyzerVersion: `${IMAGE_SUBJECT_ANALYZER_VERSION}:${model}`,
    faceCount: parsed.faceCount,
    hasHuman: parsed.hasHuman,
    imageSubjectClass: parsed.imageSubjectClass,
    maxFaceAreaRatio: parsed.maxFaceAreaRatio,
    maxFaceHeightRatio: 0,
    maxFaceWidthRatio: 0,
    personCount: parsed.personCount,
    personLabelConfidence: 0,
  };
}

export async function analyzeCarouselImageSubject(
  inputBuffer: Buffer,
): Promise<CarouselImageSubjectAnalysis> {
  return analyzeCarouselImageSubjectWithOpenAI(inputBuffer);
}

export function isSafeCarouselImageSubject(
  value: string | null | undefined,
): value is (typeof SAFE_CAROUSEL_IMAGE_SUBJECT_CLASSES)[number] {
  return SAFE_CAROUSEL_IMAGE_SUBJECT_CLASSES.some((item) => item === value);
}
