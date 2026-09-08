import type { CSSProperties } from "react";

import type {
  TrendingWallTextContent,
  TrendingWallTextLayout,
} from "@/lib/trending/wall-text-types";
import { getWallTextRenderBlocks } from "@/lib/trending/wall-text-types";
import {
  getWallTextFontSize,
  getWallTextLetterSpacing,
  getWallTextOutlineWidth,
  getWallTextShadowOpacity,
  getWallTextTypography,
  WALL_TEXT_INLINE_SAFE_PADDING,
  WALL_TEXT_LINE_HEIGHT_FACTOR,
} from "@/lib/trending/wall-text-visual-style";
import {
  DEFAULT_TRENDING_TEXT_COLOR,
  type TrendingTextColor,
} from "@/lib/trending/text-color";

export function WallTextOverlay({
  content,
  layout,
  textColor = DEFAULT_TRENDING_TEXT_COLOR,
}: {
  content: TrendingWallTextContent;
  layout: TrendingWallTextLayout;
  textColor?: TrendingTextColor;
}) {
  const textBoxStyle = {
    height: `${layout.textBox.height * 100}%`,
    left: `${layout.textBox.x * 100}%`,
    top: `${layout.textBox.y * 100}%`,
    width: `${layout.textBox.width * 100}%`,
  } satisfies CSSProperties;
  const fontSize = getWallTextFontSize(content);
  const outlineWidth = getWallTextOutlineWidth(content);
  const shadowOpacity = getWallTextShadowOpacity(content);
  const letterSpacing = getWallTextLetterSpacing(content);
  const typography = getWallTextTypography(content);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 [container-type:inline-size]"
    >
      <div
        className="absolute flex flex-col justify-center overflow-visible text-center"
        style={{
          ...textBoxStyle,
          boxSizing: "border-box",
          color: textColor,
          fontFamily: typography.fontFamily,
          fontSize: `${fontSize / 10.8}cqw`,
          fontWeight: typography.fontWeight,
          letterSpacing:
            letterSpacing === 0
              ? "normal"
              : `${letterSpacing / 10.8}cqw`,
          paintOrder: "stroke fill",
          paddingInline: `${WALL_TEXT_INLINE_SAFE_PADDING / 10.8}cqw`,
          textShadow:
            shadowOpacity > 0
              ? `0 0.111111cqw 0.185185cqw rgb(0 0 0 / ${shadowOpacity})`
              : "none",
          WebkitTextStroke: `${outlineWidth / 10.8}cqw #000000`,
        }}
      >
        {getWallTextRenderBlocks(content).map((segment, segmentIndex) => (
          <p
            key={`${segment.role}-${segmentIndex}`}
            className="m-0 whitespace-nowrap"
            style={{
              lineHeight: WALL_TEXT_LINE_HEIGHT_FACTOR,
              whiteSpace: "nowrap",
            }}
          >
            {segment.lines.map((line, lineIndex) => (
              <span
                key={`${lineIndex}-${line}`}
                className="block"
                style={{ whiteSpace: "nowrap" }}
              >
                {line}
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}
