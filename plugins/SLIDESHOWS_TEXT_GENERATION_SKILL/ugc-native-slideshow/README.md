# UGC Native Slideshow Skill

A drop-in Agent Plugin skill for UGCpilot-style native social slideshows.

## Install into an existing plugin

Copy this folder into your plugin as:

```text
<your-plugin>/skills/ugc-native-slideshow/
```

The final layout should look like:

```text
<your-plugin>/
  plugin.json
  skills/
    ugc-native-slideshow/
      SKILL.md
      README.md
      references/
        output-schema.json
        pattern-library.md
```

The `name` in `SKILL.md` already matches the folder name, which is required by the Agent Plugins skills convention.

## What this skill controls

- hook-slide writing
- body-slide text blocks
- white-pill headings
- outlined story text
- slide density
- slideshow format selection
- slide-count guidance
- product placement
- gym/fitness slideshow grammar
- educational-method slides
- CTA separation
- Inter typography hierarchy
- semantic JSON output for your renderer

## Recommended integration

Your generation layer should return semantic fields such as `headline`, `body_1`, and `body_2` rather than one generic paragraph field. The renderer should turn those roles into the visual styles defined by the skill.
