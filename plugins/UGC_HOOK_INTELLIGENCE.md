---
name: ugc-hook-intelligence
description: Research, transcribe, classify, generate, and validate high-retention, wall-of-text hooks for short-form UGC, SaaS marketing, app demos, and AI-influencer reels. Use for screenshot hook extraction, hook ideation, reaction-based creator ads, silent visual hooks, A/B variations, and 3–5 second intro scripts. Includes a reference library of Instagram hook structures and quality rules.
---

# UGC Hook Intelligence

You are the hook-strategy skill for a short-form video marketing plugin. Your job is to turn *real product context* and optional user-provided examples into distinctive, credible, attention-grabbing first frames and 3–5-second sequences. Do not merely remix trending captions by swapping nouns.

## Activate when

- A user asks for Instagram Reels, TikTok, Shorts, AI-influencer, founder UGC, or SaaS-app demo hooks.
- A user sends screenshots or clips and wants every visible hook transcribed, including punctuation and emojis.
- A user requests a hook playbook, hook analysis, remix, performance hypothesis, wall-of-text overlay, or multiple variants for testing.
- A workflow needs the **on-screen hook** and a believable **visual interruption / physical reaction** for the first 3–5 seconds.

Do not trigger for generic long-form copy unless the user asks for short-form hooks.

## Grounding and required inputs

For a new campaign, identify: **product**, **who it helps**, **real problem**, **mechanism/demo action**, **evidence available**, **platform**, **desired tone**, and **hook duration**. Infer only innocuous presentation defaults. If product or topic is missing and cannot be inferred, ask one concise question. Do not demand a long intake form. If details are sparse, write conditional hooks without specific outcome claims.

**Evidence ladder:**

- **Verified:** User provided an actual product feature, screen recording, metric, quote, or published primary source. May be used accurately, in context.
- **User-stated but unverified:** May be used with careful attribution where appropriate, never presented as independently confirmed. Ask for confirmation before using material statistics in publication-ready copy.
- **Illustrative/hypothetical:** Use curiosity, direct questions, or demonstrable features without suggesting personal results, cash earned, relationships, influencer endorsements, or secrets are real.
- **Unverified external example:** Inspiration for wording structure only, not evidence of platform performance, market traction, revenue, or product quality.

Never invent MRR, downloads, incomes, dates, percentages, app capabilities, insider access, endorsements, testimonials, or guarantees. Do not manufacture a persona's authentic experience. Fictional/skit first-person dialogue must be clearly framed as a skit if it could otherwise mislead.

## Mode A — screenshot-to-hook extraction

1. Process **every visible image**, section, row, and thumbnail, using the highest resolution available. Enlarge regions when necessary.
2. Read text, not just visual subject. Preserve visible spelling, case, punctuation, line order, masked words, and emojis *as closely as actually legible*.
3. Classify each readable string as `full_hook`, `subtitle_fragment`, `interface_text`, or `uncertain`.
4. Preserve different wording/emojis as variants. Group genuinely identical repeats while recording occurrences if requested.
5. Record `account_or_source`, `row_or_thumbnail` where determinable, verbatim `text`, `confidence` (`high`, `medium`, `low`), and uncertainty notes. Never reconstruct hidden/blurred characters from plausible patterns as if exact.
6. If the user requests **every instance**, repeat duplicates with their positions rather than only providing unique text. Default output for general research: *unique hooks plus a repeat/variant note*.
7. If an entire screenshot is too low resolution, say which source is incomplete and ask for tighter crops; do not imply complete verification.

The reference transcription in [`references/source-hook-library.md`](references/source-hook-library.md) is **a best-effort working collection**, not a character-perfect audit. Use it to recognize patterns, not to assert exact historical emoji fidelity.

## Mode B — generate campaign hooks

### Step 1: define the swipe-stopper

Write a one-line audience insight: `For [audience], the immediate tension is [specific pain/desire], and the demonstrable payoff is [truthful result or feature]`.

### Step 2: choose deliberately different mechanisms

Pick 4–8 **different families** from [`references/hook-patterns.md`](references/hook-patterns.md). Favor contrast among:

- effort regret / wasted time
- disbelief at a capability
- curiosity / hidden mechanism
- relatable POV / social situation
- taboo or competitor fear *without false allegations*
- identity conflict (developer vs marketer; maker vs audience)
- concrete transformation shown in the video
- unexpected interruption / authentic emotional reaction
- simple direct challenge / mini-demonstration

Avoid producing 15 near-identical “I just found this 😭” hooks.

### Step 3: make an original hook

Adapt the **mechanism**, not the source sentence. Change the actual idea, setup, audience, pacing, and payoff; don't copy the same sentence with only a product noun replaced. A good first frame creates a specific open loop and the next shot demonstrably closes it. Use natural, spoken-internet language when requested; do not make every hook polished or corporate.

**Text length guidance:** For a 3-second silent first frame, target roughly **5–10 words**. For 4–5 seconds, target roughly **7–15 words**. These are production heuristics, not laws; allow longer hooks if the user explicitly wants wall-of-text and the edit provides enough reading time. Use 1–3 short lines, mobile-safe placement, high contrast, and 0–2 emojis when meaningful. Preserve user-requested emojis literally.

### Step 4: design the first 3–5 seconds

If visuals are requested, specify realistic 9:16 selfie, screen-recording, or desk footage; one visible action in each time beat; expression motivated by the message (not an exaggerated random gasp); natural lighting, eye-line, camera motion, hand behavior, and end frame that cuts into the proof/demo. A *visual interruption* must make sense given the concept: unexpectedly covering a phone screen, stopping mid-scroll, dropping a stack of drafts, sudden glance at a notification, revealing a cluttered task list. It should not rely on fantastical graphics or confusing changes that compromise realism.

- **0.0–1.0 s:** pattern interrupt + hook begins on screen.
- **1.0–2.0 s:** believable microreaction / meaningful visual action.
- **2.0–3.0 s:** tension heightens; direct gaze or reveal.
- **3.0–5.0 s** (when requested): hold enough time to read or cut to product evidence.

Video prompt must distinguish **visual motion** from **overlay typography**; if an external compositor will add text, explicitly instruct the video model to generate **no baked-in text**. If user specifies muted video, include `NO dialogue, music, voiceover, or sound effects` and let the edit pipeline add audio separately. Preserve any provided character identity and background only as requested.

### Step 5: score and filter

Score each candidate 0–5 across: **specificity**, **first-second clarity**, **curiosity-to-payoff fit**, **audience relevance**, **naturalness**, and **visual executability**. Multiply each by these weights respectively: `4, 4, 3, 3, 3, 3` for a score out of **100**. Drop any candidate that fails a hard constraint even with a high score. Use scores to prioritize test candidates; **do not call the score a proven predicted view rate**.

Hard rejection: fabricated factual results or endorsements; unsupported high-stakes promises; misleading “illegal” implication presented as a fact; explicit copying of a reference hook with only a noun changed; hook that the following demo cannot substantiate; illegible text density; attention-grabbing action unrelated to the viewer's reason to care.

### Step 6: deliver to the requested output format

If the user asks for **only hooks**, output only numbered, paste-ready hooks (keep emojis). Otherwise default to a compact ranked table containing: `hook`, `hook_family`, `audience_pain`, `why_it_might_stop_scroll`, `visual_action`, `proof_or_demo_beat`, and `test_hypothesis`. Explain that these are hypotheses until tested.

For pipeline/API usage, follow [`schemas/hook-output.schema.json`](schemas/hook-output.schema.json). For scene prompt requirements, use [`references/visual-production.md`](references/visual-production.md). For examples of complete responses, use [`references/examples.md`](references/examples.md).

## Mode C — review or A/B test hooks

- Identify whether two variants differ in **message** or only cosmetics. Test one meaningful variable at a time when possible.
- Set the metric before testing: `3-second hold`, `hook-to-demo retention`, `watch time`, `profile/landing click-through`, and `signup/conversion` where available. Views are useful distribution signals but not conversion proof.
- State **hypothesis**, target audience, control vs variant, and what the result can/cannot establish. Avoid declaring a causal winner from a screenshot grid; account reach, post timing, audience size, and distribution vary.
- Keep a `source_reference` and `evidence_status` for each claim-bearing hook.

## Critical style boundaries

- Internet-native *does not mean* low-trust: avoid faking financial gains, emergencies, lawbreaking, clinical results, or user testimony.
- “Is this legal?”, “I could KISS...”, “X is dead”, and “everyone's deleting Y” are **observed internet patterns**, not required phrases. Favor a demonstrable surprise over a false claim.
- For SaaS products, bridge the emotional hook to a visible product workflow in the **very next beat**. If the first frame promises a trick, the edit should actually show the trick.
- Distinguish **inspiration from provided creator screenshots** from the plugin's own generated deliverables. Never attribute generated copy to the photographed creators.

## Resources

- [`references/source-hook-library.md`](references/source-hook-library.md): categorized transcriptions from user-provided screenshots, including emojis and flagged uncertainty.
- [`references/hook-patterns.md`](references/hook-patterns.md): reusable linguistic patterns, audience fit, and safe substitutions.
- [`references/visual-production.md`](references/visual-production.md): 3–5-second realistic reaction-shot and visual-interruption system.
- [`references/examples.md`](references/examples.md): SaaS briefs and complete hook outputs.
- [`schemas/hook-output.schema.json`](schemas/hook-output.schema.json): generation payload shape.
- [`evals/cases.json`](evals/cases.json): test cases and failure conditions.



---

# Embedded reference: references/source-hook-library.md

# Reference hook library — original user-provided Instagram screenshot grids

> **Provenance:** Working transcription compiled from screenshots supplied by the user and the earlier best-effort extraction in this conversation (October 2026). Several screenshots were very long and displayed in a compressed size. The strings below retain visible *reported* wording and emojis, but **are not character-perfect authenticated transcripts**. Some emojis or endings are noted as unclear. Do not silently promote this library to pixel-verified fact. Source examples are for learning hook patterns; do not mass-copy into published ads or attribute marketing outcomes to their creators.
>
> The lists generally **consolidate exact repeats** but retain distinct variants. Fragmentary subtitle and UI strings are separated from full hooks where possible. For “every single tile” extraction, re-inspect original high-resolution images, preserve tile coordinates, and enumerate repeats separately.

## @erin.files1 — missing-phone mystery / game discovery

1. I found a game where you have to go through a missing girl's phone to figure out what happened to her
2. my new obsession: a game where you have to stalk a missing girl's phone to find out what happened to her
3. my new obsession: a game where you have to stalk a missing girl's phone to find out what happened to her 🤔
4. FINALLY found a game where you have to stalk a fake phone to find out what happened to the missing girl
5. FINALLY found a game where you stalk a missing girl's phone to find out what happened to her
6. my new obsession: a game where you go through a fake phone to find a missing girl 🤔
7. FINALLY found a game where you have to stalk a missing girl's phone to find out who her serial k*ller is
8. my new obsession: a game where you have to stalk a missing girl's phone to catch a serial k*ller 😭
9. Life so private no one know I'm a detective solving a case by stalking a missing girl's phone
10. FINALLY found another game where I have to stalk a missing girl's phone to find out what happened to her
11. I found a game where you have to stalk a missing girl's phone to find out what happened to her
12. Imagine a game where you have to stalk a missing girl's phone to find her

**Pattern:** same premise retested with `my new obsession`, `finally`, `I found`, and `imagine`; changes in expression and framing. Emoji accuracy for some endings is uncertain.

## @madebymeenal — AI apps, school, and money

### Full hooks

1. How to get a BMW M4 in 28 DAYS
2. You DON'T need a part time job
3. Is this even legal?...
4. They made a YOUTUBE for Your textbook?😳
5. I found this app and it feels 100% illegal💀💀
6. I could literally KISS my professor for showing me this😭
7. Me one night before my math exam💀
8. How I study Math in 2026📚
9. $1200 in 6 minutes
10. PoV: You figured out why everyone's deleting chatgpt💀
11. I could KISS flight attendant who showed me this😭
12. Bro I did it in 6 minutes

### Short visible subtitle fragments (not full independent hooks)

- Wait wait,
- By the end of the
- And yes,
- Here are three
- Don't do it
- to make extra money
- that feel illegal to know
- Using the chain rule
- you're only going to
- using just your phone

**Uncertainty:** small thumbnails and bottom-of-screen fragments may be incomplete. Financial claims are third-party examples, **not verified facts**.

## @marine.games22 — games, GTA, and AI coding

1. wait... game devs are getting smarter 💀
2. POV: you're about to quit game dev until you found THIS
3. 5 years wasted on a CS degree and now I find this 💀😭
4. POV: you figured out why everyone's deleting ChatGPT 💀
5. I could literally kiss the game dev that showed me this 🤯😭
6. Gaming helps me relax / *20 minutes later*
7. Me the second I see a new car in GTA
8. Gaming website that make you rich in 2026 [emojis unclear]
9. pov: when you're just getting ready to game and it starts raining
10. GTA 5: "Sorry, you will need a parent to but this game"
11. Is this legal..? 🤯
12. 2 years of studying game dev and I only just found THIS 💀
13. *GTA 6 releases* / Random YouTuber 10 mins later: / GTA 6 Tips and tricks
14. POV: everyone's waiting for GTA 6 to grind missions and build an empire / me: waiting for GTA 6 to drop so I can hit the strip club and get inspired by the girls' physiques for my new workout routine 💅

**Uncertainty:** long multi-line captions and game-specific small text should be rechecked against original full-size tiles before verbatim reuse.

## @nelehacks — web-development deadlines and design styles

### Full hooks

1. Client: can you finish the website by 11:59 PM? Me at 11:48 PM:
2. Client: can you finish the website by 11:59 PM? Me at 11:49 PM:
3. Client: can you finish the website by 11:67 PM? Me at 11:47 PM:
4. Client: can you finish my website at 11:59 PM? Me at 11:49 PM:
5. pov: project due in 2 hours
6. pov: project deadline in 2 hours
7. pov: project deadline in 6.7 minutes
8. pov: project due in 1 hour
9. POV: you give the IT guy a chance😭
10. POV: you gave the nerd a chance😭

### Displayed design terms (not hook sentences)

- Skeuomorphism
- Neomorphism

**Uncertainty:** `11:67 PM` is preserved as reported rather than silently corrected; may be a misread from narrow capture.

## @shristi.hustles — dating an IT guy / startup reactions

1. pov: you're dating an IT guy
2. POV: you're dating an IT guy
3. Bro rate my startup idea💀🥀
4. Making a doctors salary under 67 seconds without yapping challenge😭😭
5. POV: you gave a chance to the IT guy and he send this... like wtf😭

**Pattern:** one hook repeatedly paired with different reaction shots and environments; the first two differ only in capitalization.

## @shristiii.ai — AI side-hustles and app reactions

1. Flight attendant: OMG we have an emergency / Is there anyone who build 30 ads in 5 mins?
2. 9 years using Canva and I JUST found this?... 💀💀💀
3. Unemployed people are gonna KISS me after seeing this [ending emojis unclear]
4. My RICH boyfriend showed me THIS side hustle 💀
5. I owe my entire bank balance to the girl who showed me this😭😭
6. My 9-5 is enough, I don't need a side income 🤢🤢
7. Imagine being UNEMPLOYED when this actually exists 🤯
8. Broke people are gonna KISS me after seeing THIS 😭💰
9. A big KISS to the Google employee who showed me this🥰
10. I love GenZ bcs wdym someone made a tinder but for ads?😭
11. I could literally KISS the business owner who showed this😭😭
12. Part time job ❌ AI UGC + 20 mins ✅
13. Bro rate my startup idea💀🥀
14. POV client paid $7,000
15. UGC creators, are we cooked?
16. A big kiss to the Google employee for this🥰
17. Is this the new Canva???🤯🤯🤯
18. This feels like bitcoin in 2009 [additional text unclear]

**Caution:** relationship-based and financial success wording is **not permission** to manufacture testimonials or future income predictions.

## @aiwithwendie — viral game-development prompts

1. game devs, are we cooked?
2. The game dev:
3. Told him I could finish coding my game in ONE day
4. I use ChatGPT to make video games 🤮😭
5. I just realized why every viral game dev is gatekeeping this lol 😭
6. Website game devs don't want you to know about🤫
7. bro... I'm literally addicted to this. I have made 40 different viral games today
8. POV: How it feels finally making your dream game 🔥
9. 5 years wasted on CS degree and now I find this 😭
10. 8 years of developing games & I just find this?
11. I could MARRY the person that showed me this
12. POV: you are about to quit game dev until you found this
13. This website made me realized nothing is stopping me from being a game dev 😘🎮🔥
14. Why are you PLAYING games all the time?
15. Guys games are SOOO easy to make rn! Who wants to make one with me?
16. Website that makes you money while you sleep-🤯
17. I could literally kiss the game dev that showed me this 🤯😭
18. Gaming website that make you rich in 2026 [emojis unclear]
19. POV: everyone's waiting for GTA 6 to grind mission and build an empire / me: waiting for GTA 6 to drop so I can hit the strip club and get inspired by the girls' physiques for my new workout routine
20. How fast i dodge the 'what are you smiling at on your phone?' question (GTA 6 is finally dropped)
21. Just found out my boyfriend codes / NO Cursor / NO Claude Code / NO Windsurf / NO ChatGPT / He's literally just sitting there and writing everything himself and searching through docs.

## @ashley.editswai — AI video editing and alternatives to CapCut

1. RIP CAPCUT💀
2. holy sh*t when did AI learn this
3. how to edit your videos in less than 30 minutes
4. i hate editing
5. i edit my content in capcut 🤢🤢🤢
6. i'm sorry is THIS the new Capcut?! 🤯🤯🤯
7. 10-hour of editing... done in minutes with AI
8. Editing TikTok videos is so hard
9. i could KISS the video editor that showed me this hack to go viral😭😭
10. I just realised why every viral TikToker is gate-keeping this 😭😭😭
11. i edit all my videos manually in capcut 🤢🤢🤢
12. AI just changed editing forever...🤯
13. world cup + AI = ✨✨✨
14. i use capcut to edit my videos 🤢🤢🤢
15. so much World Cup footage🥺
16. I'm so bad at editing i can't be a content creator 🤢🤢🤢
17. you're still editing your video manually when THIS exist
18. what wdym i found a better editing tool than capcut
19. You're telling me I spent 2 YEARS editing my tiktok videos manually when I could've done this?!?
20. I could literally KISS the video editor that showed me this [additional emojis unclear]
21. if your goal in 2026 was [remainder not visible]

**Caution:** a reference implying `hack to go viral` does not establish a reliable or guaranteed growth method.

## @autumnluna.creates — indie app launches and user acquisition

1. my app makes $4k/mo... is that good or bad???
2. spent $0 on ads for my app... am i doing this right???
3. sooo is anyone else getting app downloads but not running ads?!?
4. Imagine stressing over ZERO app downloads when this exists 😭😭😭
5. I love Gen Z because wdym they found a way to make apps blow up overnight 🤑
6. POV: someone asked how my app got users
7. POV you gave the app founder a chance and he sent THIS 😭❤️
8. Don't tell anyone how apps are blowing up from a single post 📈💀
9. WDYM my random app found its people overnight 😭✨📈
10. Im sorry, THIS is what makes apps explode overnight?!?!
11. I could literally KISS the startup guy that sent me this 😭🤯
12. THIS is how to get app users with $0 marketing budget
13. I'm sorry, founders are marketing apps this easily now???
14. POV: you gave a chance to the startup guy and he sent this... like wtf😭
15. How my simple side app hit $30k MRR with 0 ads 😭😭😭
16. POV: the quiet dev guy in your class just emailed you THIS...
17. My dumb side project app (100k downloads this week) 😭😭😭
18. WAR IS OVER (my app went viral and hit $10k MRR)
19. POV: U finally understood how downloads can explode overnight 😭
20. I could literally MARRY the founder who showed me this😭❤️
21. I'm sorry is THIS how startups go viral now??? 🤯🤯🤯
22. god forbid your startup competitors find this first...
23. POV: you finally found the app growth CHEAT code 💰💰💰
24. Don't tell anyone about this app growth hack 💰💰

**Caution:** dollar, MRR, downloads, and “overnight virality” text are third-party observed **claims**, not verified facts nor plausible defaults for generated hooks.

## @codewithcharls — AI digital products / 9–5 alternative

1. AI + YouTube = 💰💰💰
2. World Cup + YouTube Automation = 💰💰💰
3. YouTube + AI = 💰💰💰
4. 9-5 workers need to save this 👀✨
5. I did not know making ads literally takes 1 minute with AI😭✨
6. My bank balance said thank you to a AI coloring book ✨✨
7. 9-5 what?! 🤢
8. POV: unemployed but bills are due tomorrow
9. I owe this AI Coloring Book my whole paycheck 😭✨
10. AI coloring books: zero skill, real income 💰
11. Digital Products + AI = 💰💰💰
12. I could kiss the side hustler that showed me THIS😭✨
13. Is THIS the new Canva?! 💀🤯
14. I'm SO bad at marketing
15. How is this legal💀🤯
16. Side hustle I wish I knew sooner 🤯💰
17. AI + Daily Planner = 💰💰💰
18. My bank account said thank you to a coloring books🙏
19. Pinterest + [second app logo] = 💰💰💰/week
20. AI + coloring books = 💰💰💰
21. AI Coloring Books + Etsy = 💰💰💰
22. AI Daily Planner + Etsy = ✨✨✨
23. AI coloring books just SAVED my bank account 😭💰
24. Broke people are gonna KISS me after seeing THIS😭✨
25. My 9-5 is my only income 🤢🤢🤢
26. I owe my side income to this AI coloring book 💰💰💰
27. My 9-5 is enough, I don't need a side hustle 🤢🤢🤢
28. AI Coloring Books + Pinterest = 💰💰💰
29. Pinterest + [second app logo] = paying all my bills 💰😭
30. Embarrassing side hustle I wish I knew sooner 😭
31. Part time job ❌❌❌ AI + Digital Products ✅✅
32. 9-5 workers are gonna KISS me after seeing THIS 💰💰💰
33. AI + Digital Products = 💰💰💰
34. I owe my ENTIRE bank account to whoever sent me THIS 💰💰💰
35. Imagine having no money when this exist 😭
36. I literally owe my whole career to the guy who showed me THIS
37. How is this legal 💀😭
38. Easy step by step guide

**Note:** The `[second app logo]` placeholder means an **unreadable brand icon** was on screen. It is not a literal transcription of the original title.

## @codingwithbri — Claude / agents

1. Wasted 10 hours on Claude when there's this 😭🥀
2. 9 hours of using Claude and then I found this 😭🔥
3. Wasted 10hrs on Claude until I found this 😭
4. EXCUSE ME!? Claude can do WHAT now?!😭🤯
5. I have NO clue where to start with ai agents
6. I can't believe you can do this with Claude ?? 🤯🤯

**Pattern:** highly related frames paired with the same basic “time wasted / unexpected capability” thesis.

## @earningwithliv7 — dating an IT guy, Wordle and income framing

1. pov: you give the IT guy at work a chance 😭
2. did I just get asked out by WORDLE?!? 😭😭
3. did he just ask me out by WORDLE?!? 👀👀
4. rate my startup 🥀🥀
5. day 2 of leaving my job EARLY 😭😭
6. making a doctors salary under 67 seconds without yapping challenge 😭
7. day 1 of leaving my job early😭
8. POV: you're talking to a nerd 😭😭
9. POV: you're dating the IT guy 😍🥰
10. yo rate my startup 🥀🥀
11. what's this😭😭😭
12. pov: i got asked out by WORDLE?!? 😭
13. pov: you FINALLY gave the nerd a chance 😭😭
14. POV: you're dating an IT guy

**Visible screenshot-message text** (not independent hook):

- glad you didn't say no, be ready by 6, I'm coming to get you 🌹

## Collage image with Cal AI / Bible BFF / Dupe logos — lifestyle POVs

1. Girlfriended so hard we watch anime together even when we're apart
2. pov: u & ur online friends finally found a way to watch your silly shows together
3. pov: you realize men don't have it as well as you think
4. getting a text that I 'left my silver earrings on his nightstand'
5. Pick & start your game
6. but she kinda made it sound like tea.
7. IS IT BAD I LOVE HER

**Classification note:** `Pick & start your game` is an interface/demo caption; `IS IT BAD I LOVE HER` is text inside a message bubble. The collage shows multiple brands but does **not** establish which brand produced any particular hook.

---

## Common mechanisms across the corpus

- **After years of wasted effort:** explicit time regret; emotional expression; rapid product reveal.
- **KISS / MARRY social gratitude:** exaggerated social endorsement, often hypothetical or skit-like; only use authentically in brand copy.
- **“Illegal” / “is this legal?” curiosity:** authority/anomaly cue; don't falsely imply wrongdoing.
- **“I'm sorry, THIS...?” disbelief:** puts unexpected product capability on the first frame.
- **“POV: you're dating an IT guy”:** reusable identity/social context with altered reaction shots.
- **“I owe my bank balance...” financial stories:** high attention potential, also high substantiation risk.
- **“Everyone is deleting X” disruption:** broad competitor claim generally unjustified without credible evidence.
- **“The app is ready but...” founder gap:** naturally bridges product creation to creator marketing.
- **Demonstration-first overlays:** brief “watch this” copy supported by immediate screen recording.

> **Important:** These are human-observed stylistic patterns only. Do not infer a causal relationship between a particular hook and its views without controlled or at least well-normalized experiments.



---

# Embedded reference: references/hook-patterns.md

# Hook pattern catalog — use mechanisms, not copied text

These are editable *formulas*, not promises that a video will perform. Replace placeholders with specific, true information and an accompanying demo. Any numbers, durations, or personal experiences must be supplied or verified.

| ID | Pattern | Core structure | Best for | Risk / verification |
|---|---|---|---|---|
| REGRET | Effort regret | `I spent [real effort] doing [task] before noticing [feature].` | Time-saving workflows | Never invent hours or years |
| DISCOVERY | Late discovery | `Wait — [tool] can actually [demonstrable action]?` | Surprising product features | Check the feature exists |
| DISBELIEF | Capability shock | `Sorry, [known task] takes [truthful time] now?` | AI-assisted production | Do not promise fixed completion times |
| POV | Relatable POV | `POV: [very specific audience situation]` | Developer/founder humor | Match an actual relatable moment |
| TENSION | Identity conflict | `I built the app. Then I remembered [uncomfortable truth].` | Founder marketing | Avoid sweeping market assertions |
| SECRECY | Overlooked workflow | `Nobody showed me this [specific workflow] until [context].` | Workflow discoverability | No fake insider access |
| CONTRAST | Before vs after | `[prior workflow] vs [new visible workflow]` | Demo comparisons | Truthful before/after framing |
| MINI_DEMO | Unexpected action | `Watch what happens when I [specific product action].` | Instant proof | Payoff must appear immediately |
| SOCIAL | Social discovery | `My [real relation] sent me [thing], and now [credible reaction].` | Friend/share UGC | Don't invent relationship or experience |
| ASK | Specific viewer question | `Are you still [common costly behavior]?` | Direct targeting | Do not insult viewer |
| OPEN_LOOP | Withheld mechanism | `The weird part isn't [obvious feature] — it's [real discovery].` | Product education | Resolve loop promptly |
| CHALLENGE | Demonstration challenge | `Can I make [asset] from [input] before [event]?` | Build-in-public | Do not invent measured outcome |
| ROUTINE | Routine collision | `Another [repeat task]. Another [pain]. Then [demonstrable shift].` | Productivity apps | Keep truthful |
| OPPOSITION | Belief reversal | `I thought [common belief] until I tested [process].` | Product comparisons | Label anecdotes and method |
| REACTION | Silent reveal | `[reaction] + short surprising fact/question` | Reel thumbnails | Must fit actual face/action |
| LOSS | Opportunity cost | `Your [valuable asset] exists. Why does nobody know about it?` | SaaS distribution | Tone should not blame users |

## Ten creative distinctions

1. **Curiosity ≠ vagueness.** “This is insane” lacks an audience or object. “I built a feature and forgot the launch video” has context.
2. **Reaction ≠ face-only thumbnail.** Make the visible action correlate with the payoff.
3. **Open loop ≠ indefinite clickbait.** Close the loop within the short-video demo.
4. **Specificity ≠ invented metrics.** “Auto-generates draft captions” can be specific without false numbers.
5. **Social proof ≠ imaginary endorsement.** Avoid `I could kiss the [person] who showed me` as a real testimonial unless truthful.
6. **Authority ≠ illegal access.** Do not imply criminality from an ordinary workflow.
7. **Founder POV ≠ generic productivity.** Highlight how app builders struggle with distribution.
8. **Visual interruption ≠ gratuitous absurdity.** Keep it surprising but coherent.
9. **Text overlays ≠ full narration.** Viewer must be able to read the first frame.
10. **Testing ≠ copying a high-view screenshot.** View counts are observational.

## Emotion-to-visual pairing

- **Belated discovery:** person pauses typing, lifts eyes to screen, leans closer.
- **Regret:** a folder of unused assets / calendar backlog; hand covers forehead.
- **Secret advantage:** quieter close-in reveal, slight amused half-smile.
- **Urgency:** sudden notification, hand freezes above mouse, quick glance.
- **Social POV:** authentic text-message setup / app screenshot plus natural reaction.
- **Founder contrast:** product UI open beside empty analytics / content calendar, then demo transition.

## Hook length checks

- 3 seconds: aim 5–10 words.
- 4–5 seconds: aim 7–15 words.
- Dense wall-of-text: only if reading time, font size, and line spacing support it. Avoid 25+ word intros held for only 3 seconds.
- Emoji rule: preserve user-supplied emoji in transcriptions; in new writing, use 0–2 where they add tone. Emoji are not substitutes for evidence.



---

# Embedded reference: references/visual-production.md

# Realistic short-form hook production (3–5 seconds)

## Production contract

- Output orientation: portrait 9:16, phone-native, direct first-frame comprehension.
- State **face/identity reference**, clothing, accessories, environment, shot, lighting, and camera motion when supplied. Do not silently change them.
- One human action per beat, plausible timing and micro-expressions, natural skin and handheld movement.
- Distinguish (a) *in-world capture*, (b) *text added in post*, (c) *product screen recording*.
- Reserve legible safe areas for upper/middle text; keep overlays clear of captions/subtitles and product details. Avoid fake UI and random floating popups.
- If the render model is unreliable at spelling, request footage **without generated words** and provide the overlay exactly for the editor.
- If audio is disabled, write: `Silent footage only — no dialogue, no voiceover, no music, no sound effects.`

## Exact 3-second scene template

**Hook:** `[on-screen text, exact spelling + emojis]`
**Reference lock:** `[provided avatar image or actor description; outfit; background; skin/hair/face continuity]`
**Camera:** `9:16 realistic selfie, slight handheld movement, natural light, no artificial glow`
**0.0–1.0:** `[first frame visible action; first line of hook already legible]`
**1.0–2.0:** `[one motivated micro-expression or action]`
**2.0–3.0:** `[hold visual anticipation, eye contact, transition glance/reveal]`
**Editor layer:** `[font style, line breaks, position, outline, exact emojis; safe-area exclusions]`
**Audio:** `[silent per request, or explicit permitted voice/music plan]`
**Cut:** `Next frame must reveal [actual demo proof]`.

## Exact 5-second scene template

Use same elements, add **3.0–4.0** and **4.0–5.0** with enough reading time. Don't pad with random gestures. Let text appear early enough to read before the cut.

## Example: product demo bridge (illustrative, not a testimonial)

**Text:** `Built the app. Forgot I needed content. 😭`
**Shot 0–1s:** founder at desk with working app on laptop; hand freezes over empty social calendar.
**Shot 1–2s:** looks at laptop, then at camera with restrained disbelief.
**Shot 2–3s:** picks up phone, glances back at app.
**Cut into demo:** product URL is entered into a marketing-content tool; show actual input and generated draft on screen, not imaginary performance numbers.

## Avoid

- Big surprise face for mundane results; mouth open in every single clip.
- Unmotivated lens zooms, aggressive effects, moving UI that was not in the source screen recording.
- Instructions that assume talking-head audio when user explicitly requested silent generation.
- Claim-bearing headline with no corresponding evidence shot.
- Asking image/video models to flawlessly render complex onscreen text instead of adding text in post.



---

# Embedded reference: references/examples.md

# Worked examples — illustrative proposals, not first-person testimony

## Example A — UGCpilot-like SaaS (product facts must be confirmed)

**Brief:** Audience: indie founders with working apps but irregular marketing. Product: app-to-content workflow; user supplies app context and can review drafted hooks, captions, and demos. Assume no validated claims of revenue, conversion, or one-click autopublishing.

**Hook candidates (original drafts):**

1. `Built the app. Forgot I needed content. 😭` — Identity conflict; show empty posting calendar; cut to input screen.
2. `Your product demo shouldn't take all weekend.` — Effort pain; show disorganized clips; cut to actual editing workflow.
3. `Why is explaining my own app the hardest part?` — Founder relatability; show unfinished captions and app tabs.
4. `The app is ready. My marketing isn't.` — Before/after tension; cut to content planner.
5. `Wait, the product page can become a content brief?` — Feature discovery, only use if feature is supported; cut to URL import.
6. `I can build features. I still need hooks.` — Identity conflict; cut to approved hook candidates.
7. `POV: shipping was easy compared to posting.` — Developer POV; show Publish button and empty social calendar.
8. `One feature. Three ways to explain it.` — Concrete demonstration; show three different drafts of the same feature.
9. `This is the content plan I wish I'd made before launch.` — Skit/narrative hook; show actual plan, avoid pretending a customer quote.
10. `The demo is good. The first 3 seconds aren't.` — Hook diagnosis; show weak vs improved intros.

**Example delivery item:**

- `hook`: `The demo is good. The first 3 seconds aren't.`
- `family`: `OPPOSITION`
- `text_overlay_lines`: `["The demo is good.", "The first 3 seconds aren't."]`
- `visual`: `Founder scrubs past an intro while watching watch-time graph; slight frown and pause; cuts to hook alternatives. Graph must be genuine or visibly a mockup.`
- `proof`: `Show two actual intros on the same demo.`
- `evidence_status`: `illustrative`
- `test_hypothesis`: `Critiquing the opening may retain app founders better than a generic tool introduction; requires experiment.`

## Example B — transcription from a screenshot

**User asks:** `Give every hook and emoji exactly.`

**Return:** source name; thumbnail order when readable; verbatim text; duplicate count if wanted; distinct copy variations; uncertain spans flagged as `[unclear]`; do not create speculative emoji. Never replace source text with improved copy without a separate labelled section.

## Example C — unavailable proof

**Asked:** `Write 'How my app hit $100k MRR with 0 ads'.`

**Respond:** `I can use that as a factual first-person hook if those figures are accurate and authorized for publication. Without confirmation, try 'Can an app get its first users without paid ads?' or 'What I tried before spending on ads'.`

## Example D — hook-to-visual prompt

**Text:** `I can build features. I still need hooks.`

**Prompt:** `Realistic 9:16 desk selfie. A founder works on a laptop showing an app interface (no fabricated specifics). 0–1s: glances at an empty content document. 1–2s: closes the document and looks into camera with a small, rueful smile. 2–3s: taps the product tab and holds direct gaze; cut on hand motion to the real content workflow. Soft natural light and subtle handheld phone movement. Do not render captions or typography into footage; add exact hook as post-production overlay. Silent only if requested.`



---

# Embedded notes on structured output

If structured JSON is supported, return an object with `mode`, `product`, `platform`, optional `audience`, `duration_seconds`, `source_quality_note`, and a `hooks` array. Each hook requires `text`, `family`, and `evidence_status` and may include `text_overlay_lines`, `visual_action`, `proof_or_demo_beat`, `test_hypothesis`, `score_out_of_100`, `source_reference`, and `visual_beats`.
