# Bundled third-party software

MOCKUPBENCH runs these dependencies locally; it does not contact their upstream services at runtime.

- **Three.js 0.180.0** and addons, MIT. Copyright three.js authors. License: `vendor/THREE-LICENSE.txt`. Exact published source distribution: https://www.npmjs.com/package/three/v/0.180.0 ; upstream https://github.com/mrdoob/three/tree/r180 . The GLTFLoader relative BufferGeometryUtils import is adjusted for the flat vendor folder.
- **Manifold 3.5.4**, Apache-2.0. License: `vendor/MANIFOLD-LICENSE.txt`. JS/WASM source release: https://www.npmjs.com/package/manifold-3d/v/3.5.4 ; upstream https://github.com/elalish/manifold . Bundled JS/WASM files are unmodified.
- **occt-import-js 0.0.23**, MIT wrapper, bundling **Open CASCADE Technology** under its LGPL-2.1 license with additional exception. Read `vendor/license.occt-import-js.txt` and `vendor/license.occt.txt`. Published distribution and build/source files: https://www.npmjs.com/package/occt-import-js/v/0.0.23 ; upstream https://github.com/kovacsv/occt-import-js . Bundled JS/WASM files are unmodified, separately loaded and replaceable. Open CASCADE source: https://github.com/Open-Cascade-SAS/OCCT . See the package build configuration for its exact OCCT revision. The application does not restrict modifying or replacing these components or debugging such modifications.
- **Helvetiker, Optimer, Droid Sans Mono** font data from Three.js r180 example fonts. Original glyph data is combined into the local `vendor/fonts.js` module. Notices: `vendor/FONT-LICENSE`, `vendor/FONT-README.txt` and `vendor/MANIFOLD-LICENSE.txt` (Apache-2.0 text for Droid). Upstream glyph data and embedded copyright metadata: https://github.com/mrdoob/three/tree/r180/examples/fonts .

Development-only dependencies fake-indexeddb and LinkeDOM are recorded in package-lock.json and are not included in the static server ZIP.

## InterfaceBench catalog

All 267 component definitions are imported from Mike Parks / Green Shoe Garage’s **INTERFACEBENCH v1.6.0-rc.1** server package. The complete original catalog data, including source notes, nominal opening geometry, terminal labels and provenance, is in the readable `interface-catalog.js` module. Its supplied GNU GPL v3 license is included as `INTERFACEBENCH-LICENSE.txt`. `components.js` adapts these definitions into illustrative 3D bodies; it does not turn generic assumptions into verified dimensions. The source repository includes `scripts/import-interface-catalog.mjs` for regenerating this data from the original extracted server package.

## MP4 presentation encoder

**h264-mp4-encoder 1.0.12** is bundled as `vendor/h264-mp4-encoder.web.js`, an unmodified web distribution with embedded WASM. MIT wrapper, copyright Trevor Sundberg. License: `vendor/H264-MP4-ENCODER-LICENSE.txt`. Exact published package: https://www.npmjs.com/package/h264-mp4-encoder/v/1.0.12 ; source and build instructions: https://github.com/TrevorSundberg/h264-mp4-encoder . The optional developer source map is not distributed.

The embedded binary includes **minih264** under its public-domain / CC0 dedication (`vendor/MINIH264-LICENSE.txt`) and **libmp4v2** under Mozilla Public License 1.1 (`vendor/LIBMP4V2-LICENSE.txt`). Exact corresponding source revisions used by the package:

- https://github.com/TrevorSundberg/minih264/tree/25f441086ac8f2eef1c883476c095f9397843ac8
- https://github.com/TrevorSundberg/libmp4v2/tree/d49b4466ed76fc23b59e31a5f7f10f34b30ad7c4

These covered sources are available at the links above under their respective terms. No changes were made to the distributed encoder or its embedded binary. The application's separate worker adapter is `mp4-worker.js`. Users may replace the encoder bundle with a compatible build; the application imposes no restriction on modifying these libraries or debugging such modifications. All video encoding happens locally.

## Engineering drawing font

**DejaVu Sans 2.37**, unmodified TrueType font in `vendor/drawing-font.ttf`. Copyright Bitstream, with DejaVu changes in the public domain, distributed under the Bitstream Vera/DejaVu terms in `vendor/DRAWING-FONT-LICENSE.txt`. Source: https://dejavu-fonts.github.io/ . `vendor/drawing-font.js` contains derived glyph IDs, advances and font metrics used for consistent PDF/SVG text positioning. PDFs embed the font locally; no font service is contacted.
