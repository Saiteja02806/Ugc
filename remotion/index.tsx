import { Composition, registerRoot } from "remotion";
import React from "react";
import "@fontsource/inter/700.css";
import "@fontsource/inter/900.css";

import { WOTExploreCover } from "./WOTExploreCover";
import { TalkingHeadDemoPromo } from "./TalkingHeadDemoPromo";
import { HookVideoPromo } from "./HookVideoPromo";
import { WallOfTextPromo, WOT_PROMO_FRAMES } from "./WallOfTextPromo";
import { SlideshowPromo, SLIDESHOW_PROMO_FRAMES } from "./SlideshowPromo";
import { AICharacterPromo, AI_CHARACTER_PROMO_FRAMES } from "./AICharacterPromo";
import { VidmakeLaunchPromo, VIDMAKE_LAUNCH_FRAMES } from "./VidmakeLaunchPromo";
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
      <Composition
        id="TalkingHeadDemoPromo"
        component={TalkingHeadDemoPromo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="HookVideoPromo"
        component={HookVideoPromo}
        durationInFrames={270}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="WallOfTextPromo"
        component={WallOfTextPromo}
        durationInFrames={WOT_PROMO_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="SlideshowPromo"
        component={SlideshowPromo}
        durationInFrames={SLIDESHOW_PROMO_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="AICharacterPromo"
        component={AICharacterPromo}
        durationInFrames={AI_CHARACTER_PROMO_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="VidmakeLaunchPromo"
        component={VidmakeLaunchPromo}
        durationInFrames={VIDMAKE_LAUNCH_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(RemotionRoot);
