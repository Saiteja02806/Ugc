export type CarouselTextMode =
  | "body_only"
  | "checklist"
  | "cta_takeaway"
  | "headline_body"
  | "question_list"
  | "single_statement";

export type PlannedCarouselSlide = {
  body: string | null;
  ctaText: string | null;
  formatRole?: string | null;
  headline: string | null;
  imageDirection: string;
  layoutPreset:
    | "bottom-message"
    | "caption-cluster"
    | "interactive-list"
    | "middle-statement"
    | "top-hook";
  listItems: string[];
  slideNumber: number;
  slideType: "benefit" | "cta" | "differentiator" | "hook" | "problem" | "solution";
  subtext: string | null;
  textMode: CarouselTextMode;
  textPosition: "bottom" | "center" | "top";
};
