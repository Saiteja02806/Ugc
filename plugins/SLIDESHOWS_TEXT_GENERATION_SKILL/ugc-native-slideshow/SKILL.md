---
name: ugc-native-slideshow
description: Generate native-looking TikTok, Instagram, Reels, Shorts, and carousel slideshows for UGCpilot. Use when creating, rewriting, structuring, or reviewing slideshow hooks, body-slide copy, slide counts, text hierarchy, product placement, visual intents, typography roles, or slideshow output data. Covers personal-shift listicles, story/confession slideshows, educational methods, quick tips, fitness routines, product-assisted slideshows, and CTA slides.
---

# UGC Native Slideshow

Create creator-native vertical social slideshows that feel documented from real life rather than designed like presentation decks or corporate ads.

The central rule is simple:

> **Every slide communicates one main idea.**

A slide may contain one, two, or three text blocks, but every block must support the same main idea. Never turn a slide into one large paragraph. Never put multiple unrelated points on one slide.

## 1. Separate content format from presentation mode

Always decide two things independently:

1. **Content format** — what kind of slideshow is being told.
2. **Presentation mode** — how the text for each slide is displayed.

Supported content formats:

- `personal_shift`
- `story_confession`
- `quick_tips`
- `educational_method`
- `fitness_routine`
- `product_assisted`
- `goal_based_routine`

Supported presentation modes:

- `cover`
- `outlined_story`
- `pill_story`
- `numbered_shift`
- `minimal_statement`
- `educational_method`
- `routine_explanation`
- `cta`

Do not force one renderer across all slideshows.

---

# 2. Hook slide rules

The hook slide is the simplest slide and should carry the strongest typography.

## Default hook structure

Use **one main sentence only**.

Examples:

- `5 ways i finally stopped missing deadlines while working from home:`
- `5 shifts that made me learn a new skill (fast):`
- `5 ways i stopped drowning in my endless to-do list:`
- `4 exercises i do for lifted glutes`
- `3 unusual morning habits that actually build discipline`

A hook may wrap across multiple visual lines, but it is still one point and one text block.

Example visual wrapping:

```text
5 ways i finally
stopped missing
deadlines while
working from home:
```

Do not treat those lines as separate points.

### Hook length

Prefer **7–15 words**. Up to roughly 18 words is acceptable when necessary.

If a hook becomes too long, rewrite it. Do not solve bad copy by shrinking the font heavily.

### Hook writing style

Hooks should sound like creator language rather than article headlines.

Prefer:

- first-person language
- a specific result
- a specific problem
- transformation
- mistaken belief
- curiosity
- lived experience

Useful constructions:

- `5 ways i...`
- `5 things i changed...`
- `5 shifts that made me...`
- `i thought...`
- `i kept...`
- `i finally...`
- `i stopped...`
- `i started...`
- `what changed when...`

Prefer:

`5 things i changed when my to-do list got out of control`

Avoid:

`5 Productivity Strategies for Effective Task Management`

Prefer:

`i kept blaming my schedule when the plan was actually the problem`

Avoid:

`How to Improve Workout Scheduling`

### Hook block count

Default: **1 text block**.

Optional confession hook: **2 text blocks**.

Structure:

```text
MAIN HOOK

SHORT SUPPORTING THOUGHT
```

Example:

```text
i thought every workout had to feel hard to count:

honestly this sounds obvious now but here we go
```

The support line is not a second point. It is a short conversational setup.

Never put three or more conceptual blocks on the hook slide.

### Hook typography hierarchy

The hook is the **largest and strongest text in the slideshow**.

Default font family: `Inter`.

Recommended renderer defaults for 1080×1920:

- hook: Inter Bold 700, ~62–76 px
- optional hook subline: Inter SemiBold 600, ~38–48 px

The cover normally uses plain white text, no white pill, centered, in the upper third or upper-middle.

---

# 3. Body-slide rule

Each body slide must still communicate **one main point**.

That one point may be represented with:

- **1 block** — minimal statement
- **2 blocks** — main statement + support
- **3 blocks** — headline + problem/context + change/result

Choose the minimum amount of text needed.

Never force every body slide into three blocks.

Never render a body slide as one continuous paragraph when it can be split into readable beats.

Bad:

```text
I was constantly refreshing my task list throughout the day and it was making it impossible to focus so now I only check it once in the morning and once after lunch.
```

Good:

```text
2. i quit checking my list constantly

refreshing it every hour was killing my focus completely

i look once in the morning, once after lunch
```

---

# 4. Presentation modes

## A. `numbered_shift`

Use for:

- `5 shifts...`
- `5 ways...`
- `5 things i changed...`
- `5 habits...`

Structure:

```text
HEADLINE: number + personal change
BODY 1: old problem / old belief / old behavior
BODY 2: new behavior / new rule / result
```

Example:

```text
4. i started saying no to new requests

adding tasks mid-day was derailing everything i planned for

now i ask if it can wait until tomorrow
```

Another:

```text
1. i stopped writing everything down

honestly my list was just making me more anxious

now i only track what i can do today
```

Visual treatment:

- headline in a white rounded pill
- black headline text
- body blocks in white
- body blocks visually separated
- do not combine body 1 and body 2 into a paragraph

Recommended typography:

- pill headline: Inter Bold 700, ~46–54 px
- body: Inter SemiBold 600, ~38–46 px

---

## B. `pill_story`

Use for major story beats that are not necessarily numbered.

Structure:

```text
HEADLINE / KEY MOMENT
BODY 1: context
BODY 2: consequence / realization
```

Example:

```text
i'd build the perfect week

every sunday i'd map out runs, lifts, swims like a puzzle

by tuesday something always came up and i'd just skip everything
```

Another:

```text
then i'd blame my job or meetings

i genuinely thought my schedule was the problem not the plan

i never considered that the plan should work around my actual life
```

Visual treatment:

- headline inside white rounded pill
- body blocks below in white
- body text smaller than pill headline
- keep strong vertical breathing room

The white pill means:

> This is the sentence the viewer should remember from this slide.

It does not mean the slide must be a numbered list item.

---

## C. `outlined_story`

Use for raw, creator-native confession or lifestyle statements.

Structure:

```text
MAIN STATEMENT
OPTIONAL SUPPORTING STATEMENT
```

Examples:

```text
i made cooking

easier than ordering
```

```text
fridge-ify shows recipes

for what's expiring
```

```text
i actually use leftovers

instead of ordering out
```

Visual treatment:

- white text
- thick black outline
- no white pill
- centered
- main block may be slightly larger than support

Recommended 1080×1920 defaults:

- main: Inter Bold 700, ~54–64 px
- support: Inter SemiBold 600, ~42–50 px
- black stroke: roughly 5–7 px

Use this when the message is simple enough that a three-part explanation would feel excessive.

---

## D. `minimal_statement`

Use to create rhythm between denser slides.

Use one or two short blocks only.

Examples:

- `1. Lift heavy`
- `4. Never skip cardio`
- `i made cooking / easier than ordering`
- `fridge-ify shows recipes / for what's expiring`

Ideal total copy: roughly **3–12 words**.

The image should carry most of the meaning.

---

## E. `educational_method`

Use when teaching a concrete method.

Structure:

```text
ACTION
OPTIONAL EXAMPLE / INSTRUCTION
WHY IT WORKS
```

Example:

```text
1. Use your non-dominant hand for the first hour

(Brush your teeth, open doors, drink water...)

This frustrates your brain and forces intentional focus
```

Another:

```text
2. Write down what you don't want to do today

(Then do the hardest one first)

Call out your own avoidance and attack the biggest one before 10am
```

This mode may contain more words than other slides, but the three conceptual blocks must remain visibly separated.

---

## F. `routine_explanation`

Use for fitness or exercise-specific routines.

Hook example:

`4 exercises i do for lifted glutes`

Body structure:

```text
EXERCISE NAME
WHY: what the exercise targets / why it is included
CUE: one actionable technique instruction
```

Example:

```text
Dumbbell Step Up

Why:
Unilateral work shapes and lifts the glutes while fixing imbalances.

Cue:
Lightly tap the back foot — don't push off it. Drive through the front heel.
```

The visual should show the exact exercise.

---

## G. `cta`

CTA is a separate slide role, not a normal body slide.

Possible contents:

- app name
- short value proposition
- website
- app-store badge
- QR code
- product screenshot
- download prompt

Do not place ordinary story copy over a designed CTA card. Reserve dedicated CTA safe zones.

---

# 5. Content formats

## Personal Shift Listicle

One of the primary UGCpilot formats.

Hook:

`5 shifts that made me [OUTCOME]`

Examples:

- `5 shifts that made me learn a new skill (fast):`
- `5 shifts that made me finally stick to the gym`
- `5 shifts that made content creation way easier`

Body grammar:

```text
CHANGE
OLD FRICTION
NEW BEHAVIOR
```

Example:

```text
1. i stopped waiting for motivation

honestly i used to think i needed to feel inspired first

now i just show up for 10 minutes daily
```

The items should form a small transformation arc rather than being five unrelated tips.

A useful progression is:

1. start without motivation
2. make starting easier
3. make the behavior enjoyable
4. remove perfectionism or destructive friction
5. notice progress

---

## Story / Confession

Use when the slideshow is a personal realization rather than a listicle.

Typical flow:

```text
cover
→ outlined confession
→ pill story
→ pill story
→ minimal beat
→ product-assisted moment
→ result
```

This format should feel like a sequence of realizations, not a list of tips.

---

## Quick Tips

Use when each slide is understandable from a very short statement.

Hook:

`5 ways to make quick progress in the gym`

Body slides:

- `1. Lift heavy`
- `2. Make this shake`
- `3. Stay consistent`
- `4. Never skip cardio`
- `5. Remember how you felt that day`

One action = one slide.

---

## Educational Method

Use when each item needs an action, example, and reason.

Typical slide count is lower because each slide carries more information.

---

## Fitness Routine

Hook examples:

- `4 exercises i do for lifted glutes`
- `5 exercises i use for wider shoulders`
- `3 movements that finally grew my upper chest`

Specificity is important. Avoid generic hooks such as `Best gym exercises`.

---

## Product-Assisted Slideshow

The product should normally appear as the mechanism that helped one part of the creator's transformation.

Do not default to `5 reasons to use Product X`.

Preferred example:

```text
3. i stopped deciding what to work on

i'd waste the first 30 minutes figuring out what mattered

todaywise started picking my priorities so i could just begin
```

Another:

```text
3. i gamified the whole thing

duolingo turned learning spanish into something i actually looked forward to daily
```

The slideshow remains about the user's problem and transformation, not the product itself.

### Product placement limit

For a normal 5–7 slide organic slideshow:

- default product-heavy slides: **1**
- maximum product-heavy slides: **2**, unless the user specifically asks for product-focused content

Do not put the product on every slide.

---

# 6. Slide count

Do not force every format to use the same number of slides.

Use the amount the format naturally needs.

Recommended ranges:

- Personal Shift: cover + 4–6 shifts → usually 5–7 total
- Quick Tips: cover + 4–7 tips → usually 5–8 total
- Educational Method: cover + 3–5 methods → usually 4–6 total
- Workout Routine: cover + 3–6 exercises → usually 4–7 total
- Story / Confession: usually 5–8 total
- Product-Assisted: use the natural count of the parent format
- CTA: optional final slide

Never add filler slides just to hit a fixed number.

---

# 7. Text density

Use three density levels.

## Low density

Roughly 2–8 words.

Examples:

- `1. Lift heavy`
- `Never skip cardio`

Use when the visual already explains the point.

## Medium density

Usually 15–30 words total across headline + supporting blocks.

Default for Personal Shift and narrative slides.

## Higher educational density

Usually 20–40 words total.

Use for action + example + why.

Do not use high-density text on every slide.

---

# 8. Copy style

Default tone:

- conversational
- first person when appropriate
- simple
- direct
- slightly imperfect
- creator-native
- lowercase is acceptable and often preferred
- not polished-corporate

Useful phrases:

- `honestly`
- `i used to`
- `now i`
- `i stopped`
- `i started`
- `i quit`
- `i kept`
- `i'd`
- `tbh`
- `literally`
- `finally`
- `turns out`
- `i wish i was joking`
- `no excuses`

Avoid corporate phrasing.

Avoid:

`Implement a structured prioritization framework to optimize productivity.`

Prefer:

`i stopped trying to do everything at once`

---

# 9. Font system

Use one consistent font family:

`Inter`

Recommended weights:

- Hook: Inter Bold 700
- Slide headline: Inter Bold 700
- Body: Inter SemiBold 600
- Secondary: Inter Medium 500

Do not let the model invent arbitrary fonts per slide.

---

# 10. White pill system

Use white pills for important body-slide headlines.

Examples:

- `1. i stopped saying yes to everything`
- `i'd build the perfect week`
- `every sport felt equally important all the time`
- `then i'd blame my job or meetings`

Renderer guidance for 1080×1920:

- font: Inter Bold 700
- text: black
- background: white
- border radius: ~10–16 px
- horizontal padding: ~22–28 px
- vertical padding: ~10–15 px
- max width: roughly 68–76% of canvas
- prefer 1–2 lines; maximum 3

The pill should look like a native social caption, not a UI button.

---

# 11. Text-block spacing

Do not make separate blocks visually merge into one paragraph.

For three-part slides:

```text
[WHITE PILL]

[breathing room]

BODY 1

[larger breathing room]

BODY 2
```

Use roughly 50–90 px of vertical separation depending on line count and composition.

---

# 12. Text positioning

Default safe structure:

- top 0–12%: breathing room
- ~12–22%: headline / pill
- ~25–38%: body 1
- ~40–54%: body 2
- remaining area: visual

These are defaults, not hard constraints.

Move text to avoid covering:

- faces
- hands
- product screens
- exercise demonstrations
- important objects

The renderer should prioritize composition and readability.

---

# 13. Visual style

Default aesthetic:

- creator-native
- phone-shot
- documentary
- casual
- lifestyle
- imperfect
- realistic

Prefer:

- selfies
- POV shots
- desk photos
- laptop/work scenes
- library scenes
- gym mirror shots
- exercise POV
- food close-ups
- cooking scenes
- notebooks
- casual study photos
- outdoor runs
- everyday environments

Avoid making every image look like:

- a studio photoshoot
- a stock campaign
- a polished agency ad
- a presentation illustration

The intended feeling is:

> someone documented their actual life and added readable text on top.

---

# 14. Visual matching

Generate or retrieve visuals from the **individual slide action**, not only from the overall category.

Examples:

- `Lift heavy` → show heavy training
- `Make this shake` → show the actual shake
- `Never skip cardio` → show cardio
- `Dumbbell Romanian Deadlift` → show that exact movement
- `i started blocking focus time` → show a realistic focused-work scene
- `i made cooking easier than ordering` → show actual cooking

Category-specific strictness:

- fitness: very literal
- food: very literal
- exercise demos: exact movement
- productivity: contextual can work
- learning: same study/learning world may be enough
- story/confession: mood and lifestyle context may matter more than literal illustration

---

# 15. Carousel rhythm

Do not make every slide equally dense.

Good rhythm:

```text
Cover
→ medium-density story
→ medium-density story
→ minimal beat
→ medium-density story
→ product moment
→ result / CTA
```

This prevents the slideshow from feeling mechanically templated.

---

# 16. Line-break rules

Break lines by meaning, not by arbitrary width.

Good:

```text
5 ways i finally
stopped missing
deadlines while
working from home:
```

Avoid awkward semantic splitting.

The renderer may reflow for space, but should preserve meaningful phrase chunks whenever possible.

---

# 17. Content and visual validation

Before rendering each slide, validate:

1. Does the text belong to this slideshow topic?
2. Does the text belong to this product?
3. Does the image match the slide's idea?
4. Does the product reference belong to the correct product?
5. Does the presentation mode match the text structure?

If any answer is no, regenerate or repair the offending element.

Never allow cross-product mistakes such as a food-app slide containing sports-training copy.

---

# 18. Output schema

Generate **semantic slide data**, not one generic `text` field.

Use fields such as:

- `role`
- `presentation_mode`
- `hook`
- `subline`
- `headline`
- `body_1`
- `body_2`
- `example`
- `why`
- `cue`
- `visual_intent`
- `product_reference`

Example:

```json
{
  "format": "personal_shift",
  "slides": [
    {
      "role": "cover",
      "presentation_mode": "cover",
      "hook": "5 shifts that made me learn a new skill (fast):",
      "subline": null,
      "visual_intent": "casual student studying on the floor surrounded by notes"
    },
    {
      "role": "body",
      "presentation_mode": "numbered_shift",
      "headline": "1. i stopped waiting for motivation",
      "body_1": "honestly i used to think i needed to feel inspired first",
      "body_2": "now i just show up for 10 minutes daily",
      "visual_intent": "student at laptop with notebook in casual home study setup"
    }
  ]
}
```

Never collapse a three-block slide into:

```json
{"text":"...one long paragraph..."}
```

The renderer should control typography and layout from semantic roles.

---

# 19. Renderer responsibility

The model generates semantic content and visual intent.

The renderer controls:

- font
- font size
- weight
- stroke
- pill
- padding
- line height
- position
- safe area
- text wrapping
- contrast
- background treatment

Do not let the language model invent arbitrary numeric typography settings on every slide unless the user explicitly requests manual layout control.

---

# 20. Default decision logic

When choosing a presentation mode:

- first slide → `cover`
- numbered personal behavior change → `numbered_shift`
- major story moment → `pill_story`
- simple raw statement → `outlined_story`
- under ~10 words and visually obvious → consider `minimal_statement`
- action + example + reason → `educational_method`
- exercise name + why + cue → `routine_explanation`
- download / visit / buy / scan → `cta`

Always choose the simplest mode that communicates the slide clearly.

---

# 21. Quality gate

Before returning a slideshow, confirm all of the following:

- cover contains one main hook
- cover is not a paragraph
- hook is the strongest typography
- every body slide communicates one main idea
- body copy is broken into logical blocks
- no unnecessary long paragraphs
- white pills contain only the strongest slide sentence
- body text is smaller than headline text
- product placement feels native
- product does not dominate unrelated slides
- visuals correspond to individual slide content
- important subjects are not unnecessarily covered by text
- typography hierarchy is consistent
- Inter is used throughout unless the user explicitly requests another font
- CTA is treated separately
- slide count suits the content format instead of following one universal count
- density varies enough to keep the carousel visually alive
- copy sounds like a creator, not a corporate marketing team

---

# 22. Most important principle

Do not design the slideshow like a presentation deck.

Design it like native social content.

The ideal result should feel like:

> A creator took photos from their actual life and added simple, readable text on top.

Not:

> A marketing team built a branded Canva deck.
