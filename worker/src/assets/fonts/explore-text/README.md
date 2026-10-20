# Explore video text fonts

These static faces are derivatives of Google Fonts at revision
`1d0e46c7933245c8180fe83e47917961c913bbdb`, prepared with fontTools 4.67.0.
Original OFL licenses are retained next to the faces and browser assets.
`manifest.json` records original source hashes and built TTF/WOFF2 hashes.

Internal family names are unique (`UGCExplore…W400/500/700`) to distinguish
these derivatives from installed fonts. The UI shows the original family name.
Browser WOFF2 files live in `public/explore-text-fonts`; the worker reads these
TTF files directly and exports glyph outlines. No font installation is required.

To rebuild, install fonttools and brotli in a temporary preparation environment
and run `python scripts/prepare-explore-text-fonts.py` from the repository root.
This also writes the font CSS and shared advance metrics. Python is not a
runtime dependency. Do not edit generated metrics or rename faces separately.
