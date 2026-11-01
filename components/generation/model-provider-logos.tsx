"use client";

import type { ReactNode } from "react";

export function GoogleProviderLogo({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function OpenAIProviderLogo({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M21.5 9.77a5.52 5.52 0 0 0-.48-4.3 5.6 5.6 0 0 0-4.66-2.77 5.76 5.76 0 0 0-2.86.77A5.5 5.5 0 0 0 9.22 2a5.6 5.6 0 0 0-5.2 3.65 5.54 5.54 0 0 0-1.8 3.86 5.6 5.6 0 0 0 1.25 5.17 5.5 5.5 0 0 0 .48 4.3 5.6 5.6 0 0 0 4.66 2.77 5.76 5.76 0 0 0 2.86-.77 5.5 5.5 0 0 0 4.28 1.47 5.6 5.6 0 0 0 5.2-3.65 5.54 5.54 0 0 0 1.8-3.86 5.6 5.6 0 0 0-1.25-5.17zm-8.86 11.2a4.2 4.2 0 0 1-2.42-.77l.12-.07 4.02-2.32a.7.7 0 0 0 .36-.61v-5.67l1.7.98v4.27a4.22 4.22 0 0 1-3.78 4.19zm-8.73-3.79a4.2 4.2 0 0 1-.46-2.5 4.25 4.25 0 0 1 1.7-3.41v4.75a.7.7 0 0 0 .36.61l4.9 2.83-.85 1.48-5.65-3.76zm-1.1-9.52A4.2 4.2 0 0 1 4.77 5.9l4.9 2.83a.7.7 0 0 0 .72 0l4.9-2.83v1.97l-4.9 2.83a.7.7 0 0 0-.36.61v5.67l-1.7-.98V11.7a.7.7 0 0 0-.36-.61l-4.9-2.83zm15.42 2.65l-4.9-2.83.85-1.48 5.65 3.76a4.2 4.2 0 0 1 .46 2.5 4.25 4.25 0 0 1-1.7 3.41v-4.75a.7.7 0 0 0-.36-.61zm1.1 6.87a4.2 4.2 0 0 1-1.96 1.76l-4.9-2.83a.7.7 0 0 0-.72 0l-4.9 2.83v-1.97l4.9-2.83a.7.7 0 0 0 .36-.61V7.93l1.7.98v4.27a.7.7 0 0 0 .36.61l4.9 2.83.26-.44.26.44zm-7.66-3.32l-2.4-1.39 2.4-1.39 2.4 1.39-2.4 1.39z" />
    </svg>
  );
}

export function ByteDanceProviderLogo({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="7" width="3.5" height="10" rx="1.75" fill="#3A86FF" />
      <rect x="8.5" y="3" width="3.5" height="18" rx="1.75" fill="#00C49F" />
      <rect x="14" y="6" width="3.5" height="12" rx="1.75" fill="#FF007F" />
      <rect x="19.5" y="9" width="3.5" height="6" rx="1.75" fill="#FFBE0B" />
    </svg>
  );
}

export function KlingProviderLogo({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5v-9l7 4.5-7 4.5zm-2-9v9H6v-9h5z" />
    </svg>
  );
}

export function WanProviderLogo({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2 12c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" />
      <path d="M2 17c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" />
      <path d="M2 7c2.5-3 5-3 7.5 0s5 3 7.5 0 5-3 7.5 0" />
    </svg>
  );
}

export function ElevenLabsProviderLogo({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 4h3v16H8V4zm5 0h3v16h-3V4z" />
    </svg>
  );
}

export function HiggsfieldProviderLogo({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 18L18 6M6 6l12 12" stroke="#0078d4" />
      <circle cx="12" cy="12" r="3" fill="#0078d4" />
    </svg>
  );
}

export type ModelProviderMeta = {
  provider: "Google" | "OpenAI" | "ByteDance" | "Kuaishou" | "Alibaba" | "Higgsfield" | "ElevenLabs";
  logo: ReactNode;
  badge?: "NEW" | "PREMIUM";
  description: string;
};

export function getModelProviderInfo(modelId: string): ModelProviderMeta {
  switch (modelId) {
    case "nano_banana_2":
    case "nano_banana_pro":
      return {
        provider: "Google",
        logo: <GoogleProviderLogo />,
        badge: "NEW",
        description: "Google's next-gen flagship visual model",
      };
    case "google_omni":
      return {
        provider: "Google",
        logo: <GoogleProviderLogo />,
        badge: "NEW",
        description: "Google's multimodal real-time video foundation",
      };
    case "seedance_2_5":
      return {
        provider: "ByteDance",
        logo: <ByteDanceProviderLogo />,
        badge: "NEW",
        description: "ByteDance's high-motion video engine with audio guidance",
      };
    case "seedream_5_pro":
    case "seedream_5_flash":
    case "seedream_4_5":
      return {
        provider: "ByteDance",
        logo: <ByteDanceProviderLogo />,
        badge: "PREMIUM",
        description: "ByteDance's 4K intelligent visual reasoning engine",
      };
    case "kling_3_0":
      return {
        provider: "Kuaishou",
        logo: <KlingProviderLogo className="size-3.5 text-amber-400" />,
        badge: "PREMIUM",
        description: "Ultra-consistent high-motion video generation",
      };
    case "wan_3_0":
    case "wan_2_1":
      return {
        provider: "Alibaba",
        logo: <WanProviderLogo className="size-3.5 text-sky-400" />,
        badge: "NEW",
        description: "Alibaba's open visual generative engine with exact prompt adherence",
      };
    case "gpt_image_2_5":
    case "gpt_image_2_5_flare":
    case "gpt_image_2_5_sunburst":
      return {
        provider: "OpenAI",
        logo: <OpenAIProviderLogo className="size-3.5 text-emerald-400" />,
        badge: "PREMIUM",
        description: "OpenAI's high-fidelity image synthesis with precise edits",
      };
    case "soul_cinema":
    case "soul_2":
      return {
        provider: "Higgsfield",
        logo: <HiggsfieldProviderLogo />,
        badge: "NEW",
        description: "Cinema-grade photorealistic visual creation",
      };
    default:
      return {
        provider: "ByteDance",
        logo: <ByteDanceProviderLogo />,
        description: "High-quality generative visual model",
      };
  }
}
