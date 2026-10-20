# Higgsfield Seedance integration retired

New video generations use [Runway Seedance 2.5](runway-seedance-setup.md).
The Higgsfield SDK and paid generation example have been removed. No new
Higgsfield requests can be submitted. Historical provider records and a
GET-only recovery adapter remain to avoid losing or rebilling older requests.

Do not rewrite the already-applied Higgsfield provider migration or delete
legacy provider rows. The worker's legacy credential is retained only for
recovering requests that were accepted before the switch.
