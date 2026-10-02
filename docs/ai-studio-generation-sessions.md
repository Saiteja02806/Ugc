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
