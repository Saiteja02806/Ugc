export type CreatorReference = {
  fileName: string;
  id: string;
  src: string;
};

export const CREATOR_REFERENCES: readonly CreatorReference[] = Array.from(
  { length: 17 },
  (_, index) => {
    const number = index + 1;
    const paddedNumber = String(number).padStart(2, "0");

    return {
      fileName: `creator-reference-${paddedNumber}.png`,
      id: `creator-${paddedNumber}`,
      src: `/ai-studio/creator-references/creator-${paddedNumber}.png`,
    };
  },
);
