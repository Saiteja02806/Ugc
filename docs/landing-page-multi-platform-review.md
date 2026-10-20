# Landing page: multi-platform publishing

Reviewed 30 September 2026 against the live page at https://www.getugcpilot.com,
the attached annotated hero, and the current worktree.

## 3 October 2026 hero headline update

The selected homepage headline is now "Create. Discover. Publish." followed by
"Keep your content moving." It expresses one shared promise across the creation
workflows, business-tailored Trending content, and publishing. This supersedes
the September decision to retain the old posting-focused headline. Existing
typography and centered layout are retained. The selected treatment is plain
text: no lightning bolt, underline, outline, or orange emphasis on "moving."
Both lines inherit the same strong foreground color.

## 3 October 2026 supplied hero media and containment

- Replace only the hero showcase media with the owner's `lanidng_page` assets:
  `left_side.mp4` on the left, `middle.mp4` in the center, and
  `right_side.mp4` on the right. The clips are stored under
  `public/marketing/showcase/hero-2026-10-03/` with matching first-frame WebP
  posters. MP4 fast-start preparation preserves the encoded video/audio streams.
- Retain the existing card widths, portrait ratio, side tilts, muted looping
  playback, and center-only mobile presentation. Remove the two decorative
  layers behind the right card, which previously indicated a slideshow stack;
  the new video has one card frame.
  Badge content now describes Talking Head, UGC Video, and Hook+Demo; the
  replaced right-hand slideshow controls/count no longer apply to its video.
- Preserve the existing section overflow and negative-bottom-margin crop.
  Add isolation and an explicit inset clip to the hero section so transformed
  cards and their shadows terminate at the same full-width divider, including
  hover scaling. No rounded bottom edge should extend into the next section.
- Hidden side videos do not receive a video source below the existing 1024px
  desktop breakpoint. Resizing to desktop enables them after the existing
  750ms media delay; the center clip remains the mobile showcase.
- This is local landing-page work. The interactive daily-feed samples, original
  showcase assets used elsewhere, product workflows, and publishing are unchanged.

Validation: scoped ESLint and full TypeScript passed. Browser checks at 1440px,
1024px, and 390px confirmed the positional mapping, playback without media errors,
no horizontal overflow, and a continuous divider with no card hit targets below
it. Desktop clips reached readyState 4 and played; mobile played the center clip
with no video sources on the hidden sides. No console errors were observed.
Encoded-stream SHA-256 checks matched all three original video/audio streams
after MP4 preparation. No deployment was made.

## 8 October 2026 left hero video replacement

The left Wall of Text card now uses the supplied
`landing_page/heeo_Section/left_side.mp4`, prepared as
`public/marketing/showcase/hero-restored/left_side-v2.mp4` with a matching
first-frame WebP poster. `scripts/prepare-landing-hero-left.mjs` preserves
the complete 6.5-second, 720×1280 clip through fast-start remuxing. All 156
encoded video frames match the original, and the original source is unchanged.
The preparation manifest records source/output hashes and decode verification.
The existing card layout, muted looping playback, desktop-only side loading,
middle video and right slideshow are unchanged. This replacement is local.
Scoped ESLint and browser checks at 1440px, 1024px and 390px passed: the
replacement video/poster load, the desktop clip plays muted, the hidden mobile
side video has no source, and the center video/right slideshow remain intact.
No media/runtime errors or non-GET API calls occurred.

## Assessment

The current page has a coherent visual identity: dark surfaces, a coral CTA,
large conversational typography, and real format previews. Keep those elements.
The main communication gap was that the hero's generic Multi-Platform badge did
not name the destinations or explain the single-confirmation publishing benefit.
The detailed platform section appeared late in the page.

The annotated idea is useful. Keeping the logos and names together in the hero
badge makes the relationship clearer than floating icons without labels. On a
phone, the badge splits into a benefit line and a line of platform names.

## Implemented direction

- Hero badge: One-click publishing, followed by Instagram, TikTok, and YouTube
  logos and names. It links to the new publishing section.
- TikTok uses the complete cyan/red brand vector with its original aspect ratio,
  replacing the malformed monochrome path and blanket white-fill override in
  the landing-page mark. Its center follows the existing light/dark text theme.
  Artwork source and license are recorded in `docs/licenses/svgl.txt`.
- Hero copy: explain creation, review, account selection, and scheduling in two
  short sentences. Preserve the existing headline and handwritten accents.
- Secondary hero link: See one-click publishing.
- Immediately after the Stop spending hours crafting viral formats manually
  comparison section: One post. Three platforms. Show one reviewed video
  branching to three selected destinations, with one schedule confirmation.
- The illustration is labeled as a preview, and says supported videos and
  platform-specific format availability. It does not depict a successful real
  publication or promise every content format can go to all three services.
- Closing CTA: focus on time saved and approval control. Remove the old duplicate
  platform mockup and its unsubstantiated 2.8x View Multiplier claim.
- Header navigation contains Try UGCPilot at the top, Pricing, and the sign-in
  action. For founders and Guides are removed from desktop and mobile header
  menus. The floating header uses the compact 540px width for the shorter menu.
- Add keyboard skip navigation, visible link focus, and anchor scroll clearance.
  Use server components for the new content and reuse existing assets and icons.

Use the existing theme tokens: dark background #1f1f1f, card #292929,
coral #ff7045, strong text #f5f3f0, muted text #b9b5af. Retain Geist Sans for
the page and Geist Mono for the small preview label. The publishing fan-out
is the section's main visual; additional animation is unnecessary.

## Public-launch decision and boundary

The user explicitly confirmed that YouTube and TikTok are launching publicly,
so the marketing UI has no Beta labels. Both shared access helpers now allow
every verified signed-in user. On 9 October 2026, the owner confirmed TikTok
approval and requested restoring its visibility across the product; the shared
UI switch is enabled locally. Deployment and checking production publishing
with real authorized accounts remain separate acceptance work.

This illustration uses a video. Carousel/Slideshow publishing support and the
Carousel generation, review, and scheduling contracts are unchanged. In
particular, it does not imply YouTube supports an image carousel.

## Further ideas

1. Add a short real screen recording: select all three accounts, review settings,
   and confirm the schedule. Let a visitor see exactly what one click means.
2. Add a real customer quote or verified publishing receipt near this section
   when available. Use measured results instead of invented reach multipliers.
3. Test an outcome-first headline such as Create once. Post to all three. against
   the current headline. Compare completed signups, not only CTA clicks.

## Review basis

UI checks follow the current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
Local preview checks cover layout and navigation. They do not establish successful
publishing through hosted integrations; that acceptance belongs on the production
domain after deployment.

Validation: targeted ESLint passed for all five changed landing-page components;
the full TypeScript check passed. Browser checks at 320px, 390px, 768px, and
1440px found no page overflow, missing images, error overlays, or console errors.
The hero anchor navigates to the publishing section. The smallest phone layout
retains all three names; its preview uses a compact source card above the three
destinations. The floating header retains whitespace-nowrap navigation labels.
After removing For founders and Guides, its compact width is restored to 540px.
