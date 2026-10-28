# Wall automatic Remix: behavior and layout notes

Follow-up: original-resolution retained MP4s have now been recovered and all six hashes verified. Two local renderer placement trials are recorded in `wall-layout-pilot-2026-10-28.md`. The original thumbnail-only limitations below describe the initial review, not the final available evidence. No automatic Wall text behavior has been activated.

28October2026. Review only: no automaticWalltextimplementation,paidcall,deploymentorlayoutchange.

## Current behavior confirmed in code

VideoGenerationStudioPanel exposes automaticHookText only for workflowFormat=hook. prepareAutomaticHookText rejects any enabled request whose format is not hook. Worker automaticHookEdit produces format hook. Therefore Wall does not automatically generate/adapt/place business-specific text alongside video generation. Wall editor has manual Remix via applyVideoTextRemix; fullDurationWallText makes its overlays cover the selected Wall clip. Initial Wall Remix uses a generic width .84,y .18,fontSize36 with the configured default font unless an existing overlay supplies style. It does not infer the source's position/width/font. Existingstylesarepreserved. This explains why manuallyRemixedWalltextcanstillneedpositioning.

## Inspected material and limits

Viewed retained first source frames for all6Investing/Money references at180x320 and previously the first64decodedthumbnailtiles fromeachsource. These are extracted source frames, not newly generatedvideos. The oldsourceMP4paths are unavailablelocally. This does not constitute fullplayback/layoutmeasurement oftheentireWallcatalogue. No source-fontfamilyisconfirmedfromthesestills. Estimatebelowisvisibletextink,notactualCSSboxwidthorfontpointsize. Antialiasing/downscalinglimitspixelprecision. Runtimecanwrapdifferentremixedwordsdifferently.

| Source | Approximate visible lines | Approximate text top (% height) | Approximate visible ink width | Approximate equal visible side gaps |
|---|---:|---:|---:|---:|
| wall-money-01 | 7 | 63% | 80% | 10% |
| wall-money-02 | 7 | 41% | 55–60% | 20–23% |
| wall-money-03 | 4 | 54% | 60–65% | 18–20% |
| wall-money-04 | 8 | 47% | 55–60% | 20–23% |
| wall-money-05 | 4 | 58% | 55–60% | 20–23% |
| wall-money-06 | 10 | 53% | 50–60% | 20–25% |

All6usecenteredwhitecopywithdarkedge/shadowandnotextbox intheseviewedframes. Positionvariesconsiderably;someoverlapsface/lowerfaceintheactualsource. Do not automatically relocatealltextabovefaceandcallitmatching. Viewport-safe/platformcontrolsneedseparatereview. Renderedglyphheightappearsroughly6–9pixelsat180x320;thatdoesNOTestablishfontSize36–54at1080becauseglyphmetricsandstrokevary. Needhigherresolutionframesandactualfontmeasurementtochoosea defensiblefontsize.

## Safe implementation design after measurement

1. PreserveWallfullselectedduration;noHookautocutorshortHookcopylengthrule.4–10linesisuserguidance,notpermissiontotruncatecopyorforcethesamenumberoflinesforeveryreference.
2. Storeoneversioned,sourcehash-boundlayoutprofileperreviewedreference:normalizedblockanchor,width,safeinsets,fontfamily/weight,outline,lineheightandmeasuredsizeatcanonicalresolution. Don'ttreatinkwidthastextcontainerwidth.
3. ReuseWallbusiness-specificRemixcopyrules. Freeze source/businessprofile/prompt/layoutversion in job beforeproviderwork;recoveruncertaincallsusingthesamerequestidentity.
4. InitializeeditableWalloverlayonlyfornewuntoucheddrafts. Preserveexistingcopy,blanklines,font,position,width,trimandexplicitlyemptydrafts. Keeptextoffgenerativepixels.
5. Fitoutputusingactualfontrendererandcanvasdimensionswithinreferenceprofile,keepingreadableboundsandintendedparagraphs. Nevertruncatewordstofit. FlagoverflowforreviewratherthansilentlyapplyingHookshrink/growth.
6. Beforeautomaticactivation,compareatleastone4lineandone8–10linereferenceagainstactualpreview/exportatdesktop/mobile. Confirmallcopyisvisibleandeditablethroughoutclipandunchangedonreopen. Noautomaticpaidtestauthorizedbythese notes.

Needed before setting exact defaults: original-resolution source frames (or recoverable canonical sourceassets),fontcomparison/measurementandapprovedreference-specificplacement. Sixprofilesareinitialscope;otherWallcategoriesneedtheir ownrepresentatives ratherthanassumingtheysame.

Codeevidence: components/video/video-generation-workspace.tsx; lib/explore/automatic-hook-text-plan.ts; worker/src/lib/automatic-hook-text.ts; lib/explore/remix-text-edit.ts; lib/explore/wall-text-editor.ts. Sourceframes .tmp/wall-money-review-2026-10-26/wall-money-01..06/f00001.jpg. No newapplicationtestsneeded for this read-onlynote;nohostedbehaviorverified.
