/** New approved-script requests only. Legacy/free-text prompts are unchanged. */
export function talkingHeadScriptInputError(script: unknown, duration: number, generateAudio: boolean) {
  if (script === undefined) return null;
  if (typeof script !== "string" || !script.trim() || script.length > 6000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(script)) return "Review a nonempty Talking Head script within 6,000 characters.";
  if (!generateAudio) return "Turn Sound on to generate the spoken Talking Head script.";
  const estimate = Math.ceil(script.trim().split(/\s+/u).length / 2.8 * 10) / 10;
  if (estimate > duration) return `This script needs about ${estimate}s of speech. Choose a longer supported duration or shorten the script; words will not be cut automatically.`;
  return null;
}
