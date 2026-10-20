# AI Studio video references and daily results

Seedance 2.5 now runs through Runway's `seedance2_5` model with
`referenceAudio` inputs. Image + audio uses the text-to-video reference route;
video + audio uses video-to-video reference mode. Google Omni is unchanged.

Official references:
- https://docs.dev.runwayml.com/api/
- [Runway setup and recovery](runway-seedance-setup.md)

UGC Pilot's upload control accepts file selection, paste, and drop. Seedance
allows a combined maximum of 30 attached reference files in the application,
including at most one edit video. Audio references are MP3 or WAV, up to 25 MB
and 30 seconds per uploaded file. Generation accepts at most 10 audio files,
with verified audio + video duration totaling less than 30 seconds. Audio records have their
own `audio` media collection and no image dimensions. Generation verifies that
each audio record is ready and owned by the signed-in user before reserving credits.
Omni and Explore Recreate remain image-only in this application.

The main video feed shows results from the user's current local calendar day.
At midnight or after returning to a suspended tab on a new day, the feed resets.
History retains earlier results; selecting one displays it until the user
returns to today or starts another generation. Generated video storage and
Creative Assets visibility are unchanged.

Verification:
```powershell
node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test lib/ai-studio/audio-generation-api.test.mjs
node --experimental-strip-types --test lib/ai-studio/reference-files.test.ts lib/ai-studio/video-history.test.ts
npm --prefix worker run test:seedance
```
These checks use mocks and request construction, with no paid generation.
Deploy the media collection migration and the AI generation worker together
with the frontend/API release. Runway credentials remain in the worker's
server-side Secret Manager environment; Higgsfield is legacy recovery only.
