# Explore workflow grid - October 11, 2026

Explore now follows the user's hand-drawn two-row desktop layout:

| Left | Centre | Right |
| --- | --- | --- |
| Talking Head + Demo | Hook video | Wall of text |
| Slideshows | Build AI influencer | Quick start |

The workflow dots, horizontal scrolling, scroll-position state, and resize
listener are removed. The four workflows, AI influencer card, and Quick start
section share one grid. Containers at least 840 CSS pixels wide use three
columns; containers from 560 to 839 use two; smaller containers use one.

The AI influencer card shares the workflows' 16:9 preview, title placement,
description treatment, and link indicator. Its existing video and poster remain.
Quick start contains only AI Studio, Video generation, Image generation, and
Audio generation. Library, Trending content, and Schedule a post are removed
from this block. Four icon-and-label links fill a roomier 2-by-2 area matching
the neighboring 16:9 previews. Its heading and description sit below the buttons
with the same spacing and typography as the other workflow captions. Each link's
accessible name retains its description and destination context.

## Verification

- TypeScript (`npx tsc --noEmit --incremental false`) and ESLint passed.
- All eight existing Explore navigation UI tests passed, covering live links,
  preview query parameters, loading feedback, and production preview isolation.
- The updated Quick start destination test passed for the four retained tools,
  including Audio generation and development preview query parameters.
- Browser layout checks passed at 1536x864, 1366x768, 1024x768, 768x1024,
  390x844, and 320x740: six aligned grid entries, equal card widths, 16:9
  previews, no workflow dots, and no horizontal overflow. An expanded sidebar
  at 1366x768 retained three columns during the initial grid verification.
- The four-button refinement was verified at those six viewport sizes: a
  2-by-2 layout, no clipped button content or horizontal overflow, captions
  below the buttons, and desktop caption alignment with both neighboring cards.
- Keyboard focus visits the five creation cards in visual reading order.
- Reduced motion pauses all decorative workflow videos and shows the AI
  influencer poster.
- Clicking Slideshows and Build AI influencer opened their existing
  development preview destinations.

This is a local presentation change. It has not been pushed or deployed.
Production acceptance for authenticated/hosted flows remains separate; this
change introduces no generation, account, or publishing mutations.

![Explore desktop grid](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/explore-quick-start-refined-1366.png)
