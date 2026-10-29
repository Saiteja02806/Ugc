export type CharacterPromptSkill = {
  id: string;
  name: string;
  description: string;
  instruction: string;
  category?: string;
};

// Extend this config without editing the picker. Published instructions are
// immutable: use a new ID for revised wording so saved requests remain stable.
export const CHARACTER_PROMPT_SKILLS: readonly CharacterPromptSkill[] = [
  {
    id: "realistic-skin",
    name: "Realistic Skin",
    description: "Removes heavy oily face glow and plastic shine so skin looks like normal human skin",
    instruction: "Authentic unretouched human skin texture, realistic matte non-reflective skin finish, completely eliminate oily face glow and plastic shine, natural dermal pores and subtle skin micro-texture, fine facial peach fuzz, believable natural complexion with healthy realistic undertones. Avoid glowing shiny skin, avoid greasy specular highlights on forehead and cheeks, avoid airbrushed porcelain smoothness, avoid synthetic plastic wax sheen.",
    category: "Realism",
  },
  {
    id: "natural-face",
    name: "Natural Face",
    description: "Natural facial features and subtle asymmetry instead of a hyper-sculpted supermodel",
    instruction: "Natural and believable human facial features, subtle facial asymmetry, authentic ordinary facial proportions, relaxed candid expression with gentle natural micro-expressions, subtle natural creases around eyes and mouth, light everyday grooming, natural realistic eyebrows, un-sculpted natural jawline. Avoid hyper-chiseled supermodel features, avoid heavy glam runway makeup, avoid uncanny plastic symmetry, avoid stiff catalog model poses.",
    category: "Persona",
  },
  {
    id: "soft-natural-light",
    name: "Soft Natural Light",
    description: "Soft window daylight or room light instead of harsh studio lamps and bright ring lights",
    instruction: "Soft natural ambient lighting, gentle diffused daylight from a nearby window or indirect indoor room light, soft realistic shadows with gentle light roll-off, authentic even exposure, natural realistic eye catchlights. Avoid 3-point commercial studio lighting, avoid artificial rim-lighting and neon edge glow, avoid harsh camera flash, avoid circular ring-light reflections in the eyes, avoid theatrical high-contrast shadows.",
    category: "Lighting",
  },
  {
    id: "real-world-background",
    name: "Real-World Background",
    description: "A believable lived-in room or street setting instead of a fake, sterile AI 3D render",
    instruction: "Authentic lived-in real-world environment, realistic room depth with everyday practical furniture and objects, natural optical depth of field from a 35mm f/2.8 camera lens, believable background perspective and optical bokeh, authentic human space. Avoid sterile 3D CGI architectural renderings, avoid empty synthetic rooms, avoid blurry amorphous AI dreamscapes, avoid melting or warped background geometry.",
    category: "Environment",
  },
];

export function resolveCharacterPromptSkills(ids: readonly string[] = [], catalog = CHARACTER_PROMPT_SKILLS) {
  return ids.map(id => {
    const skill = catalog.find(candidate => candidate.id === id);
    if (!skill) throw new Error("Choose an available skill before generating.");
    return skill;
  });
}

export function composeCharacterPrompt(prompt: string, skills: readonly CharacterPromptSkill[]) {
  return [prompt.trim(), ...skills.map(skill => skill.instruction)].join("\n");
}

export type CharacterPromptPresentation = {
  displayPrompt?: string;
  skills?: { id: string; name: string }[];
};

/** Read the frozen server snapshot, never today's catalogue or the current draft. */
export function characterPromptPresentation(input: unknown): CharacterPromptPresentation {
  if (!input || typeof input !== "object" || !("characterPromptPresentation" in input)) return {};
  const snapshot = input.characterPromptPresentation;
  if (!snapshot || typeof snapshot !== "object" || !("userPrompt" in snapshot) || typeof snapshot.userPrompt !== "string"
    || !("skills" in snapshot) || !Array.isArray(snapshot.skills)) return {};
  const skills = snapshot.skills.filter((skill): skill is { id: string; name: string } =>
    skill && typeof skill === "object" && typeof skill.id === "string" && typeof skill.name === "string");
  return { displayPrompt: snapshot.userPrompt, skills: skills.map(({ id, name }) => ({ id, name })) };
}
