# Landing page: multi-platform publishing

Reviewed 30 September 2026 against the live page at https://www.getugcpilot.com,
the attached annotated hero, and the current worktree.

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
so the marketing UI has no Beta labels. This is a landing-page implementation;
the existing verified-email beta allowlists in `lib/social/tiktok-beta-access.ts`
and `lib/social/youtube-beta-access.ts` still restrict actual publishing access.
Opening those gates and checking production publishing with real authorized
accounts remain separate public-launch work.

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
