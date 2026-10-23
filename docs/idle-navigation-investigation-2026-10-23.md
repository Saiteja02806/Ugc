# Navigation after 22–30 minutes idle

The reported symptom is a slow first sidebar navigation after leaving the
application unused, including Trending and other destinations. A simulated
clock tests recovery logic but cannot reproduce a real browser's suspension,
memory pressure, network recovery or production backend latency.

## Reproduced shared failure

`lib/firebase/server-auth.ts` makes a Firebase `accounts:lookup` request before
protected application APIs can proceed. The in-flight coalescer shares overlapping
checks for the same token in one server instance. The upstream fetch and response
body previously had no deadline. A stalled lookup therefore held all of those
checks, including later callers joining the pending promise, indefinitely.

Fault-injection tests reproduced both stalled headers and stalled JSON bodies.
Both tests failed before the correction. A separate test also showed upstream
429/5xx responses being misreported as invalid credentials.

The local correction bounds the shared lookup and body to ten seconds, aborts
transport, releases the shared promise on failure, and returns temporary
unavailability (503) for transport failures, throttling and upstream outages.
It adds no automatic lookup retry and no completed authentication cache.
Invalid credentials still fail with 401; unverified users still fail with 403.
This bounds failure recovery; it does not speed up a healthy upstream request.

## Other findings, not established incident causes

- The QueryClient's default freshness is 30 minutes; inactive retention is one
  hour. Becoming stale permits a refresh; it does not erase data or itself block
  the JavaScript thread. Extending these values alone is not a justified fix.
- Trending's same-account, same-local-date memory cache does not expire at 30
  minutes. Its browser token acquisition previously preceded the feed's
  20-second network deadline; the continuation below now bounds the whole read.
- Billing reads previously had no deadline; AI Studio access cancellation did
  not bound token acquisition. The continuation below corrects those recovery
  gaps. They are not measured causes of the reported sidebar latency.
- A failed background business-profile gate recheck can replace the shared
  workspace with an error view. This explains disruption after a failed check,
  but does not establish a CPU freeze or a slow navigation by itself.
- Prior local fixes pause hidden polling and release media resources. Their
  presence in the working copy does not establish production performance.

## Verification and limits

- 15 focused authentication, refresh-queue and visibility checks pass, including
  the new failed-before/passed-after cases.
- The existing actual-component browser fixture passed Demo, Creative Assets,
  saved Hook and Edit library cases: simulated 30-minute hidden interval, no
  hidden reads, one coalesced resume read, no overlapping polls, retained cards
  and draft text, explicit retry, and cancellation on departure.
- Production navigation to `https://www.getugcpilot.com/explore` redirects this
  browser to `https://getugcpilot.com/sign-in`. No authenticated 30-minute trace
  was captured. No deployment, account mutation or generation was performed.

The specific production cause remains unconfirmed. The decisive trace must
compare the same sidebar click before and after a real idle interval: input
delay/long tasks and heap/decoder counts; route document/RSC timing; token wait;
and authenticated API timing including the Firebase lookup. This separates
browser work from navigation transport and backend waits. Do not label all lag
resolved based on the isolated tests or the deadline correction.

## Continuation: browser authentication waits

Trending, billing and AI Studio access now bound token acquisition, response
headers and JSON parsing together to 20 seconds per attempt. Each request binds
the expected account and checks cancellation after token acquisition, so a late
token cannot start a fetch after navigation, cancellation or timeout. Query reads
consume their cancellation signals. Cache keys, freshness, retention and existing
retry policies are unchanged. Trending recognizes a typed deadline error under
its existing retry schedule; the transport helper adds no retries or mutations.

25 focused tests pass, covering stalled tokens/headers/bodies, late token
resolution, account changes, a successful subsequent read, server lookup
recovery and existing job/refresh lifecycles. Scoped lint and full application
TypeScript checks pass. The broader
32-test run passed 30 and exposed two unrelated assertions: homepage server
cookies (removed by pre-existing homepage work) and Trending progress-copy source
spelling (also absent in HEAD). Those unrelated files/expectations were not changed.
No new authenticated production or real 30-minute browser trace is claimed.
