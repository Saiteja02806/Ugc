# Hook Remix text overview correction

The Hook Demo panel now says **Remix text**, keeps one **Generate remix** action,
and removes the introductory sentence and the explanatory paragraph under
**Schedule video**. Manual text entry and reference editing remain available.
The duplicate inner Remix text label is removed.

Generation readiness no longer defaults to Available. The overview reports its
actual loading, preview, missing-context/text, ready or unavailable state. The
reference-text API checks the rollout flag and both provider/storage credential
configuration before enabling the action. Source text remains readable when
generation is unavailable.

The existing generation path takes the current text and optional instructions
from the browser, loads the signed-in account's saved business context on the
server, saves an immutable request receipt before the provider call, and returns
a draft for review. Applying that draft changes the selected clip's text. The
backend does not trust business facts supplied by the browser.

## Production activation

Read-only Vercel checks verified project `ugc`
(`prj_mVOxt7AUko5egMAESaxjGyC60Kvu`, team
`team_ECnoFm5XPu3r2f0qWjLs6Lrk`). The production website resolved to ready
deployment `dpl_CUXcYhNf8ykvHiG8pxzVLRxnYsYX`. Project metadata includes
production OpenAI and Supabase credentials, with no
`EXPLORE_TEXT_REMIX_ENABLED` or `OPENAI_TEXT_REMIX_MODEL` setting.

The next approved website release needs `EXPLORE_TEXT_REMIX_ENABLED=true`,
working `explore_text_remixes`/`explore_claim_text_remix` receipt storage, and a
provider-supported remix model. `OPENAI_TEXT_REMIX_MODEL` can be set explicitly;
otherwise the existing application default is used. Environment-variable changes
require a new deployment to reach the active website runtime.

The connected MCP service reports disabled remix and an unconfigured provider,
with saved business context ready. That service has a separate deployment;
these provider findings do not describe the website's project configuration.
The live Hook page still displays the old heading and helper paragraphs.

No production configuration was changed, deployment triggered, or real AI
generation submitted in this task.

## Validation

- 35 focused component/API/source tests pass, including provider/storage
  readiness, loading/disabled states, source editing, instructions, the server's
  business-context payload, reviewed application and duplicate prevention.
- The existing `scripts/remix-text.browser.cjs` suite passes for Hook, Wall of
  Text and Slideshow, including receipt recovery, styles/audio, account changes
  and missing context. Its isolated Edge browser required execution outside
  the filesystem sandbox after the initial browser launch failed.
- Web TypeScript, scoped ESLint and diff whitespace checks pass.

Production generation and output quality still need authenticated acceptance
after configuration and deployment. Local provider fixtures do not establish
successful live provider calls.
