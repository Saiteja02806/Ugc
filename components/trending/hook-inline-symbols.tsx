"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { Fragment } from "react";

import {
  tokenizeHookInlineSymbols,
  type HookInlineSymbol,
} from "@/lib/trending/hook-inline-symbols";

type HookInlineSymbolsProps = {
  text: string;
};

export function HookInlineSymbols({ text }: HookInlineSymbolsProps) {
  return (
    <>
      {text.split(/\r?\n/u).map((line, lineIndex) => (
        <Fragment key={`${lineIndex}:${line}`}>
          {lineIndex > 0 ? <br /> : null}
          {tokenizeHookInlineSymbols(line).map((token, tokenIndex) => {
            if (token.kind === "text") {
              return <Fragment key={`${tokenIndex}:${token.value}`}>{token.value}</Fragment>;
            }

            if (token.kind === "unsupported") {
              return null;
            }

            return (
              <HookInlineSymbolIcon
                key={`${tokenIndex}:${token.name}`}
                name={token.name}
              />
            );
          })}
        </Fragment>
      ))}
    </>
  );
}

function HookInlineSymbolIcon({ name }: { name: HookInlineSymbol }) {
  const Icon = name === "check" ? CircleCheck : CircleX;
  const label = name === "check" ? "check mark" : "cross mark";

  return (
    <span
      aria-label={label}
      className="inline-flex align-[-0.12em]"
      role="img"
    >
      <Icon
        aria-hidden="true"
        className={name === "check" ? "text-emerald-300" : "text-rose-300"}
        strokeWidth={2.8}
        style={{ height: "0.96em", width: "0.96em" }}
      />
    </span>
  );
}
