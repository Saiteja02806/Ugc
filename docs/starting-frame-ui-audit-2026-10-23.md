# Starting-frame UI review — supplied screenshot

Scope: the user-supplied desktop modal in its completed-results state.
Evidence: `outputs/starting-frame-ui-audit-2026-10-23/01-supplied-review-state.jpg`.
This is a screenshot review plus a current-source comparison, not a live full-flow
audit. It establishes neither runtime latency nor keyboard/mobile accessibility.

## Steps and health

1. Inspect source scene — usable: source and result can be compared. Captions and
   secondary instructions are small and visually faint at the supplied scale.
2. Choose face — needs improvement: choosing, changing and creating a person
   compete in one area; supporting-photo labels are easy to miss.
3. Configure generation — needs improvement: model, image count, unit price,
   total price and generation action form a cramped, weakly grouped cluster.
4. Review results — needs improvement: four tiny thumbnails cannot support face
   and scene comparison well; selection relies heavily on an orange outline.
5. Approve image — blocked in the captured viewport: the orange approval action
   is clipped at the modal bottom while another paid generation remains visible.

## Proposed correction

- Retain the product's dark surfaces and orange primary action.
- Give setup a readable source preview beside a compact person/settings column.
- Label model and count explicitly; use `Variations` consistently. Display total
  cost beside Generate, with unit cost as secondary text. Keep a suitable default
  model while allowing the model choice to be expanded.
- Before generation, make Generate the primary action. After completion, make
  Use selected frame primary and Generate more secondary. Keep cost visible
  whenever another paid generation can be submitted.
- Review one image at a useful size with source comparison and a thumbnail strip;
  show `Selected · 2 of 4` and a visible selected indicator. Preserve accessible
  enlarge actions. A card gallery is also workable if previews stay large and
  approval controls remain reachable.
- Put the current primary action in a persistent footer; reserve content padding
  so the footer cannot cover images or focused controls. Use one scroll region.
- Keep pending, partial failure, changed inputs and animation-review limitations
  next to the affected result/action; preserve successful outputs for retry.
- Check short desktop heights, narrow mobile, zoom, keyboard focus, labels and
  disabled reasons before calling the redesign verified.

## Current implementation comparison

The active `presentation="recreation"` already places results in a separate
gallery with one Use this button per image; it is not identical to this older
three-column screenshot. Its actions remain in the scrolling modal content.
The alternative workspace presentation has sticky actions, but that does not
establish sticky actions in the active recreation overlay. Current generation
controls already use the clearer `Variations` label and display total/unit cost.
Changes should refine the active presentation, not restore this older layout.

No product code, generation behavior or deployed UI changed during this review.
