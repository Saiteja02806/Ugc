"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./landing-rotating-text.module.css";

export const heroPhrases = [
  { text: "Recreate for your brand", emoji: "⭐" },
  { text: "Use formats that work", emoji: "🔥" },
  { text: "Get ready to post", emoji: "🚀" },
] as const;

export function LandingRotatingText({ showEmojis = true }: { showEmojis?: boolean }) {
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    let inView = !("IntersectionObserver" in window);
    const updateTimer = () => {
      clearInterval(timer);
      timer = undefined;
      if (!reduced.matches && !document.hidden && inView) {
        timer = setInterval(() => setActive(value => (value + 1) % heroPhrases.length), 2400);
      }
    };
    const onMotionChange = () => {
      if (reduced.matches) setActive(0);
      updateTimer();
    };
    updateTimer();
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting && entry.intersectionRatio >= 0.5;
          updateTimer();
        }, { threshold: [0, 0.5] })
      : undefined;
    if (wrapper.current) observer?.observe(wrapper.current);
    reduced.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", updateTimer);
    return () => {
      clearInterval(timer);
      observer?.disconnect();
      reduced.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", updateTimer);
    };
  }, []);

  return (
    <span ref={wrapper} className={styles.wrapper} data-hero-rotating-text>
      <span className="sr-only">{heroPhrases[0].text}</span>
      <span aria-hidden="true" className={styles.stage}>
        {heroPhrases.map(({ text, emoji }, index) => (
          <span
            key={text}
            className={styles.phrase}
            data-active={index === active}
            data-outgoing={index === (active + heroPhrases.length - 1) % heroPhrases.length}
          >
            {text}{showEmojis && <span className={styles.emoji}> {emoji}</span>}
          </span>
        ))}
      </span>
    </span>
  );
}
