# Isolated carousel copy trial

Saved harness for the 12 October 2026 live comparison. Results and editorial limitations are in `docs/carousel-copy-comparison-audit-2026-10-12.md`.

Run from the repository root with the installed `jiti` and worker dependencies. `setup.mjs` copies the current `worker/src` and `lib/carousel` into three experiment directories, records source hashes and prepares public fixtures. It refuses to overwrite existing snapshots. `fix-experiment-backbone.mjs` makes the isolated reader-scenario normalizer consistent with its experimental format contract. Neither script modifies application runtime files.

`run.mjs --preflight` imports the snapshots and checks all experimental body-slide perspectives without requesting text. `run.mjs` then uses the existing text provider and public inputs. It reads only the configured text-provider key, excludes credentials from saved traces, and restricts requests to the text completion endpoint. It does not access the database, generate images, create customer jobs or publish. Fresh runs refuse to overwrite a saved result. Do not run a fresh live trial merely to reproduce a report; it incurs new provider usage.

`run.mjs --resume` preserves completed comparisons and can replay exact saved completions for unfinished work. It records planning failures rather than aborting independent variants. A resume raises the transport ceiling to 220 requests; it does not increase per-plan repair allowances. The recorded trial needed 89 main requests. The earlier setup interruption and unknown in-flight usage are disclosed in the report and retained in `setup-aborted-results.json`.

`analyze.mjs` is offline and rejects provider access. It produces the metric, sample and provider-evidence documents from the completed experiment result. Review statements are AI-agent judgments, not human-panel results.

The original working files and snapshots remain in `.tmp/carousel-quality-experiment-2026-10-12`. The saved manifest captures the exact original runtime-file hashes, while `fixtures.json` preserves the public input facts and reused briefs. For a later independent run, choose a new output directory consistently across the scripts; keep the recorded results intact. This is an exploratory interrupted pilot, not a production benchmark or automatic website-extraction test.
