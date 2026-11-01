import { Composition, registerRoot } from "remotion";
import React from "react";
import "@fontsource/inter/700.css";
import "@fontsource/inter/900.css";

import { WOTExploreCover } from "./WOTExploreCover";
import { TIMELINE } from "./assets.config";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WOTExploreCover"
        component={WOTExploreCover}
        durationInFrames={TIMELINE.totalFrames}
        fps={TIMELINE.fps}
        width={TIMELINE.width}
        height={TIMELINE.height}
      />
    </>
  );
};

registerRoot(RemotionRoot);
