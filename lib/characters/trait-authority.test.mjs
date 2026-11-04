import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_INFLUENCER_SELECTION, getTraitsByCategory } from './influencer-registry.ts';
import { compileInfluencerPrompt } from './master-prompt-compiler.ts';
import { compileStudioSelection } from './studio-selection.ts';

test('each selected eye colour overrides all ethnicity and eye-shape photo colours', () => {
  for (const ethnicity of getTraitsByCategory('ethnicity')) {
    assert.doesNotMatch(ethnicity.promptSnippet, /(?:dark|brown|blue|green|hazel|amber|grey|gray)[-\s\w]*eyes/i);
    for (const eyeColor of getTraitsByCategory('eye_color')) {
      const compiled = compileStudioSelection({ ...DEFAULT_INFLUENCER_SELECTION, ethnicityId: ethnicity.id, eyeColorId: eyeColor.id });
      assert(compiled.prompt.includes(eyeColor.promptSnippet));
      assert(compiled.prompt.includes(`both irises must be ${eyeColor.label}`));
      assert.match(compiled.prompt, /Eye-shape references supply eyelid shape only, never iris color/);
      assert.match(compiled.prompt, /selected eye color overrides every photo's iris color/);
      assert.doesNotMatch(compiled.prompt, /dark expressive almond eyes|deep expressive dark-brown eyes/);
    }
  }
});

test('none explicitly requires bare ears while selected accessories remain allowed', () => {
  const none = compileStudioSelection(DEFAULT_INFLUENCER_SELECTION);
  assert.match(none.prompt, /both ears must have bare, natural unpierced earlobes/);
  assert.match(none.prompt, /No earrings, jewelry.*even when visible in reference photos/);
  assert.match(none.prompt, /Only selected accessories may appear; ignore jewelry in all other references/);
  assert(!none.references.some(ref => ref.role === 'accessory'));
  for (const accessory of getTraitsByCategory('accessories').filter(trait => trait.imagePath)) {
    const compiled = compileInfluencerPrompt({ ...DEFAULT_INFLUENCER_SELECTION, accessoryIds: [accessory.id] });
    assert(compiled.prompt.includes(accessory.promptSnippet));
    assert.match(compiled.prompt, /Use only these selected accessories/);
    assert.doesNotMatch(compiled.prompt, /unpierced earlobes|No earrings|No accessories required/);
  }
});
