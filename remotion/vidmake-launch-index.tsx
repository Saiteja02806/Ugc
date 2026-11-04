import { Composition, registerRoot } from "remotion";
import React from "react";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/900.css";

import {
  VidmakeLaunchPromo,
  VIDMAKE_LAUNCH_FRAMES,
} from "./VidmakeLaunchPromo";

export const VidmakeLaunchRoot: React.FC = () => (
  <Composition
    id="VidmakeLaunchPromo"
    component={VidmakeLaunchPromo}
    durationInFrames={VIDMAKE_LAUNCH_FRAMES}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(VidmakeLaunchRoot);
