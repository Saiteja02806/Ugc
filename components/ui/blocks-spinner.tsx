"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type BlocksSpinnerProps = ComponentProps<"svg"> & { size?: number };

/** The application's loading indicator: three blocks shuffling in a loop.
 * One shared SMIL animation with per-instance ids, plus a static
 * three-block fallback for reduced motion (toggled in globals.css). */
export function BlocksSpinner({ className, size = 24, ...props }: BlocksSpinnerProps) {
  // Keep the entire SMIL syncbase id alphanumeric: hyphens can be parsed as
  // timing offsets. Separate the instance from numeric step ids to avoid collisions.
  const id = `blocksSpinner${useId().replace(/[^a-zA-Z0-9]/g, "")}step`;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      data-blocks-spinner=""
      className={cn("shrink-0", className)}
      {...props}
    >
      <g className="blocks-spinner-motion">
        <rect width="10" height="10" x="1" y="1" fill="currentColor" rx="1">
          <animate id={`${id}1`} fill="freeze" attributeName="x" begin={`0;${id}12.end`} dur="0.2s" values="1;13" />
          <animate id={`${id}2`} fill="freeze" attributeName="y" begin={`${id}9.end`} dur="0.2s" values="1;13" />
          <animate id={`${id}3`} fill="freeze" attributeName="x" begin={`${id}10.end`} dur="0.2s" values="13;1" />
          <animate id={`${id}4`} fill="freeze" attributeName="y" begin={`${id}11.end`} dur="0.2s" values="13;1" />
        </rect>
        <rect width="10" height="10" x="1" y="13" fill="currentColor" rx="1">
          <animate id={`${id}5`} fill="freeze" attributeName="y" begin={`${id}1.end`} dur="0.2s" values="13;1" />
          <animate id={`${id}6`} fill="freeze" attributeName="x" begin={`${id}2.end`} dur="0.2s" values="1;13" />
          <animate id={`${id}7`} fill="freeze" attributeName="y" begin={`${id}3.end`} dur="0.2s" values="1;13" />
          <animate id={`${id}8`} fill="freeze" attributeName="x" begin={`${id}4.end`} dur="0.2s" values="13;1" />
        </rect>
        <rect width="10" height="10" x="13" y="13" fill="currentColor" rx="1">
          <animate id={`${id}9`} fill="freeze" attributeName="x" begin={`${id}5.end`} dur="0.2s" values="13;1" />
          <animate id={`${id}10`} fill="freeze" attributeName="y" begin={`${id}6.end`} dur="0.2s" values="13;1" />
          <animate id={`${id}11`} fill="freeze" attributeName="x" begin={`${id}7.end`} dur="0.2s" values="1;13" />
          <animate id={`${id}12`} fill="freeze" attributeName="y" begin={`${id}8.end`} dur="0.2s" values="1;13" />
        </rect>
      </g>
      <g className="blocks-spinner-static" fill="currentColor">
        <rect width="10" height="10" x="1" y="1" rx="1" />
        <rect width="10" height="10" x="1" y="13" rx="1" />
        <rect width="10" height="10" x="13" y="13" rx="1" />
      </g>
    </svg>
  );
}
