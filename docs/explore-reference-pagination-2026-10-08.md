# Explore reference rows — release follow-up

- The previous fixed batch of 12 left unfinished rows in five-column layouts
  (12, 24, 36). The gallery now measures its actual CSS grid columns and rounds
  each batch up to complete rows (15, 30, 45 in a five-column grid).
- Resizing fills the new row without hiding previously revealed references.
  Changing category filters restarts pagination. Only the last catalogue batch
  can be shorter when there are no more matching references.
- Wall of text cards no longer show category/number captions. Reference IDs,
  accessible preview names, filtering and selection remain available. Hook and
  slideshow card captions retain their existing presentation.
- Verified two successive Show more actions in the five-column browser layout,
  plus a mobile layout without horizontal overflow. Offline component checks
  cover one through seven columns, catalogue exhaustion, resizing, filtering
  and unchanged video-source/generation integration (23 checks passed).
- TypeScript and targeted ESLint passed. No paid generation was run. These
  changes are included in the complete Explore follow-up release; production
  deployment is verified separately against the exact merged commit.
