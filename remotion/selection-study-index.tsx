import { Composition, registerRoot } from "remotion";
import React from "react";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import {
  AICharacterSelectionStudy,
  AI_CHARACTER_SELECTION_STUDY_FRAMES,
} from "./AICharacterSelectionStudy";

// Isolated entry for the selection-flow study so the delivered covers'
// registry (remotion/index.tsx) stays untouched.
export const StudyRoot: React.FC = () => (
  <Composition
    id="AICharacterSelectionStudy"
    component={AICharacterSelectionStudy}
    durationInFrames={AI_CHARACTER_SELECTION_STUDY_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(StudyRoot);
