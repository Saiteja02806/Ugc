export type ProductExample = {
  title: string;
  introduction: string;
  input: string;
  output: readonly string[];
  review: readonly string[];
  limits: string;
};

export const productExamples = {
  carousel: {
    title: "Plan a carousel that explains one product action",
    introduction: "Illustrative brief: a tutor app groups lesson notes by student. This is a planning example, not a generated carousel or customer result. Replace its feature with what your product actually does.",
    input: "Audience: independent tutors. Question: how can I keep one student's lesson notes together? Feature: notes grouped by student. Message: organize notes before planning the next lesson. Evidence: a genuine screen recording or supplied screenshot with sample data.",
    output: [
      "Cover: Keep each student's lesson notes together.",
      "Situation: Notes from different lessons can become hard to follow.",
      "Action: Use a separate group for each student.",
      "Example: Show one genuine group containing that student's sample lesson notes.",
      "Next step: Review the group before preparing the next lesson.",
    ],
    review: ["Check the slides explain the same idea in a useful order.", "Keep words readable on a phone and verify any product imagery.", "Review claims and the caption before you download the carousel."],
    limits: "An outline is not a rendered carousel. Review the actual images produced by the workflow and download the version you approve. Do not imply improved learning outcomes or time savings without evidence.",
  },
  video: {
    title: "Plan an AI UGC opening for a real app feature",
    introduction: "An illustrative SaaS brief shows how to separate generated creator-style footage from a genuine product demonstration. Replace the bracketed details with a feature and claims you have verified.",
    input: "Audience: people evaluating [type of SaaS or mobile app]. Their question: how do I [specific task]? Verified product fact: [what the app actually does]. Prompt: Vertical, natural-light creator-style opening. The creator looks at their phone, then looks up with a curious expression as if introducing a practical solution. Keep the phone screen out of view; do not invent interface details, text, dialogue, logos or product claims.",
    output: ["Generate and review a short creator-style opening based on the prompt and the model's current capabilities.", "In a separate edit, attach a genuine screen recording that shows the verified app feature completing the task.", "Add an exact headline that states the user's question, then review the opening and real demonstration together."],
    review: ["Check the model's current duration, format, reference support and credit estimate before generating.", "Inspect the result for visual errors, invented interface details or implied claims.", "Make sure the real recording proves the feature described and the final text is readable on a phone."],
    limits: "This is a sample brief, not a generated video, customer result or performance claim. AI footage can contain visual errors and cannot prove how an app works. Use genuine product footage for the demonstration and verify every product statement before you share the video.",
  },
  manager: {
    title: "Give one customer question a manageable weekly plan",
    introduction: "Illustrative question: what can our small product team explain between launches? Choose one answer that helps the intended audience, then create only the formats that add something useful.",
    input: "Reader: a founder without a new feature announcement. Question: what can I post this week? Useful answer: take one real customer question, demonstrate the answer and offer a practical next step. Evidence: the actual product action and a reviewed explanation.",
    output: ["Monday: collect a real question, remove personal details and write its answer.", "Tuesday: record or prepare one demonstration of that answer.", "Wednesday: make a carousel if the decisions need separate steps.", "Thursday: review the media, words, claims and phone preview, then download the version you approve.", "Friday: record useful replies or follow-up questions and pick the next explanation."],
    review: ["Keep the same factual context while adapting the wording to each format.", "Approve the complete output before you keep or download it.", "Distinguish a completed signup from a button click when measuring results."],
    limits: "This is an editorial plan, not a promise that every format is created automatically each day. Trending and Explore serve different workflows. Your team keeps the finished file and decides where to share it.",
  },
} satisfies Record<string, ProductExample>;
