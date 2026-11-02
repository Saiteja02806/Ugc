# Slideshow UI clarity plan

Keep Generation stable: reference summary, instructions, +, Face Swap, Improve instructions, model, whole-slideshow quote, Generate image.

Face Swap opens a bounded 320px portrait chooser anchored to the existing icon. Saved faces, uploaded portraits and Upload live here. The main composer has no permanent face-library panel. The reference strip owns one selected-slide count and Clear. Closing or Escape returns to Generation with face/marks remembered.

Acceptance: zero selections generates normally; marked slides alone receive face; generation source set and quote must not change merely from opening Face Swap; late uploads cannot change another account; outside/Escape/reopen preserves selection and focus; no footer clipping on mobile.

Unresolved implementation issues found by the requested review agent: current marked references join the generation set; multiple versions multiply swaps/credit. These differ from the user's stated unchanged-generation and per-slide cost contract and require correction before release. Picker error/retry and late-upload ownership need behavioral tests. Do not call the feature complete based on source-mapping tests.
