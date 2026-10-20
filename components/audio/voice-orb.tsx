import type { CSSProperties } from "react";

export function VoiceOrb({ id }: { id: string }) {
  const palettes = [["#d9b0ab","#52647e","#251c29"],["#cbd5ae","#598c76","#1c3434"],["#dfbf94","#a46a47","#2c252f"],["#a8d9d3","#6b95b4","#2a3656"],["#d7a9c8","#856d9d","#35263c"],["#eed493","#849766","#293b37"]];
  const hash = [...id].reduce((sum,letter) => sum + letter.charCodeAt(0),0); const colors = palettes[hash % palettes.length];
  return <span aria-hidden="true" className="audio-voice-orb" style={{ "--orb-light": colors[0], "--orb-mid": colors[1], "--orb-dark": colors[2], "--orb-angle": `${hash % 360}deg` } as CSSProperties} />;
}
