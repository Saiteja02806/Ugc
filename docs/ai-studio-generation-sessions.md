# AI Studio generation sessions

The image and video canvases show all generations created during the current
visit, in order, with the prompt alongside each result. Submitting the next
prompt appends its progress preview below existing results and scrolls it into
view. It does not clear the current canvas or begin a new session.

Clicking a completed image opens an enlarged, uncropped preview with its full
prompt and download action. The preview uses the existing accessible Dialog
primitive for focus management, Escape and the close control.

History temporarily opens an earlier result. Back to session restores the
working canvas. New session explicitly clears the canvas and the latest local
resume pointer; saved media remains in History and Creative Assets. Sessions
are local to the mounted workspace, remain intact while switching tabs, and do
not introduce a new database grouping or change generation/billing behavior.
An explicit job URL and active-job recovery retain the existing resume flow.

Portrait image previews use a 200px maximum width, capped at 24% of viewport
height to keep the full preview and composer comfortable on laptop screens.
Image actions include Copy image; image and video prompts include Copy prompt.
Prompt copying preserves the full text and line breaks even while collapsed.
Image copying writes PNG image data to the clipboard, converting other image
formats at their original pixel dimensions. It never substitutes a copied URL
for image data. Clipboard permission, fetch, or unsupported-browser failures
show a readable error and retain Download as the fallback. Copying does not
create another generation or use generation credits.
