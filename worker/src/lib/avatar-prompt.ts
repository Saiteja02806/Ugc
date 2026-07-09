export type AvatarPromptInput = {
  ageRange: string;
  background: string;
  expression: string;
  hair: string;
  persona: string;
};

export function buildAvatarPrompt(input: AvatarPromptInput) {
  return `
Create a photorealistic vertical 9:16 UGC creator avatar image.

Creator type:
${input.persona}

Age range:
${input.ageRange}

Appearance:
${input.hair}

Expression:
${input.expression}

Background:
${input.background}

Style:
Authentic Instagram/TikTok creator aesthetic, realistic iPhone photo quality, natural skin texture, soft realistic lighting, clean modern social media ad look.

Composition:
Vertical 9:16 portrait, close-up or medium close-up framing, subject centered clearly, face visible, clean background, enough negative space for future text overlay.

Important restrictions:
No text in the image.
No captions.
No logos.
No watermarks.
No brand names.
No extra people.
No distorted hands.
No extra fingers.
No unrealistic anatomy.
No plastic skin.
No over-smoothed face.
No celebrity likeness.
No fake AI glossy look.
`.trim();
}
