# SEO measurement setup and acceptance

Prepared 9 October 2026. Status: setup dependencies identified, not a completed
analytics deployment. The public production SEO check passed 20 checks across
13 pages. That check does not establish Google indexing or acquisition results.

## Access and evidence found

- Ubersuggest OAuth is connected on the free plan. Its provider estimates are
  distinct from first-party Search Console and Analytics data.
- Treg's registered team-tool inventory returned no connected tools. No
  Search Console or GA4 property was retrieved through that connector.
- The signed-in browser account opened Search Console's welcome page and
  “Add a website” flow. No verified property was accessible in that account.
  This does not establish that the domain has no property in another account.
  No property, verification token, or DNS record was created.
- A targeted application search found no GA4 tag/event integration or
  `sign_up` instrumentation. This is source evidence; other external tag
  configuration is not ruled out by that search alone.
- No verified Search Console indexing, impression, click, ranking, organic
  signup, or field-performance baseline has been obtained yet.

## Search Console acceptance

Use the `getugcpilot.com` domain property if available. If absent, ownership
verification needs the domain owner's DNS access. Record verification separately
from sitemap acceptance; neither implies all pages are indexed.

1. Retrieve the property's existing access and verification state.
2. Confirm `https://getugcpilot.com/sitemap.xml` is submitted and accepted.
3. Inspect `/guides/saas-content-marketing`: record index status, selected
   canonical, last crawl, and any reported reason for exclusion.
4. Export a 28-day completed-period baseline with a page filter and the
   available query, country, and device dimensions.
5. Preserve dates, filters, clicks, impressions, CTR, and average position.
   Record unavailable or privacy-limited data explicitly.

Account access and DNS verification remain external dependencies. No account
or DNS changes were performed during this work.

Pending input: which account owns the verified property, and whether a GA4
measurement ID already exists. Account passwords and tokens are not needed
in a chat message. Once the correct account is available, obtain the baseline
before evaluating the content revision.

## Analytics instrumentation task

Required inputs: the intended analytics property/measurement ID, its existing
tag configuration, and the product's definition of a completed new signup.
Do not add a duplicate tag or invent an ID to make the task appear complete.

The implementation should collect, where applicable:

- Public organic landing visits, with landing page and acquisition channel.
- A meaningful guide-to-product visit distinct from an account signup.
- `sign_up` once when a new account actually completes signup, not on button
  clicks, returning login, or authentication retries.
- A later successful saved output in the chosen workflow as an activation
  signal, if the product team adopts that definition.

Preserve acquisition attribution across Google OAuth, email verification, and
route changes where applicable. Do not put emails, raw form input, customer
content, or authentication tokens in analytics events.

Acceptance must exercise a new account, a returning login, and a retry/redirect
case on production. Verify event counts and parameters in the reporting tool,
and use an Organic Search acquisition filter for the organic-signup report.
Organic Social is a separate channel. A historical baseline cannot be rebuilt
from events that were never collected.

No auth code, tracking code, environment values, or database schema was changed
as part of this SEO article update.

## Reporting definition

Report both useful education and qualified discovery. Relevant queries and
reader feedback can help assess whether an article answers the right task;
product evaluation is an additional outcome when the article offers that next
step. An increase in impressions or a coincident signup does not establish
that the article caused business growth.

Primary references: [Search Console Performance](https://support.google.com/webmasters/answer/7576553?hl=en),
[URL Inspection](https://support.google.com/webmasters/answer/9012289?hl=en),
and [GA4 recommended events](https://support.google.com/analytics/answer/9267735?hl=en).
