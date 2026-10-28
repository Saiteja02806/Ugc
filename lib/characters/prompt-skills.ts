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
    description: "Reduces face glow and background lighting for a natural, human look",
    instruction: "reduce face glow, make skin tone dull and natural, reduce face skin glow, use normal human skin texture, reduce background lighting",
    category: "Realism",
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
