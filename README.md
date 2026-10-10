# MOCKUPBENCH v1.6.0-rc.1

A Green Shoe Garage Field Instrument for creating client-facing product mockups from electronics, COTS hardware, custom PCBs, wood and metal. Enclosures support up to **36 × 36 × 36 inches (914.4 mm per axis)**.

**Add parts → Customize surfaces → Assemble → Review → Present / export**

The v1.0 foundations, v1.1 motion/harness/catalog/sizing batch, v1.2 MP4 presentations, v1.2.1 UI cleanup, v1.3 surface placement, v1.4 engineering drawing packages, v1.5 applied-feature editing/enclosure styles, and v1.6 three-axis controls/relative snapping are implemented. This is a **release candidate**: the established browser-validation gate remains open. See Verification below.

## Run or deploy

The server ZIP is a drop-in static application: extract all contents into your server directory so `index.html` is at its root. Preserve the `vendor/` directory and both WASM files. There is no production build, account, database server or API key requirement.

From the source repository, upload **the contents of `dist/`** to a static host. Example deployment path: `https://mbparks.com/mockupbench/`. Serve `.js` as JavaScript, `.wasm` as `application/wasm`, and `.svg` as `image/svg+xml`. Use the trailing-slash URL. HTTPS or localhost is needed for the offline service worker. ES modules require HTTP/HTTPS; double-clicking `index.html` with `file://` is not supported.

For local use: `python3 -m http.server 8000 --directory dist`, then visit `http://localhost:8000/`. In the extracted server ZIP, omit `--directory dist`.

Deploy the whole folder atomically where possible. Close all old app tabs and reopen after upgrading; the new service worker activates when the previous version is no longer in use. Export project JSON before upgrades. This version reads schema 1/2/3/4/5 projects and writes schema 5. Schema 4 enclosure styles are preserved; files without closure settings open with the original lift-off enclosure. Older releases reject schema 5 rather than silently discarding component placement references. Export a backup before upgrading.

## A first project

1. Open **Explore an example** to see a controller assembly with a display opening, control hole, engraved lid text and cable route. Or start with an empty project.
2. Drag a catalog component onto an enclosure or another component, or click a card then click a flat face. For other sources choose **Add → Custom part**, or use **Add → Supplier parts**. Confirm illustrative template sizes against actual parts.
3. Select a component to reveal its three-axis handles. Press **G** to move or **R** to rotate. Use **3D transform** for exact coordinates or **Snap to a face…** for mounting-face alignment and offsets. Position and dimension fields accept units and fractions.
4. Select an enclosure panel and use **Cutouts & text** or **Decal**. Choose the host face, exact dimensions, offsets and depth. Preview, then Apply.
5. Use Assembly checkboxes to select components, then **Assemble → Create subassembly**. Save a part or assembly to the **Reusable library** for later projects.
6. Use **Inspect → Measure & align**, **Assemble → Wiring & power**, and **Inspect → Views & variants** as needed. Review fit observations and record evidence.
7. Export JSON for editable backup; PNG, GLB, MP4 or the printable review for clients; engineering drawing PDF/SVG packages for dimensioned reviews; BOM CSV for sourcing; selected STL or planar SVG/DXF for downstream CAD/CAM.

New Project clears the working project, but not your reusable library. Undo and a recovery checkpoint retain the previous work.

## Three-axis move, rotate and snapping

Selecting an unlocked, independently positioned part activates its move/rotate handles. Drag an X/Y/Z arrow for one axis, a plane square for two axes, or the center for free movement. Press **G** for Move and **R** for Rotate; drag a colored ring to rotate about that axis. **Handle axes** switches between world and part axes. Orbit works by dragging away from the handles; the Orbit toolbar button hides them until the next selection.

- **Snap nearby:** moving handles align nominal centers, envelope edges and touching faces of nearby visible parts or enclosure panels. A green target outline, dashed guide and live coordinate readout identify the snap. Only dragged axes change. For rotated shapes these are envelope alignments in the active axes; use **Snap to a face…** for exact face-to-face orientation.
- **Snap increments & gap:** set the move increment, rotation increment and contact gap. A step of 0 is free movement. Hold **Alt** to bypass both increment and nearby snapping temporarily. These preferences are remembered locally.
- **Exact edits:** visible world-center X/Y/Z and rotation fields remain in **3D transform**. Positions accept mm, inches and fractions. Rotation fields use degrees. Exact entries are not rounded to snap increments.
- **Undo and cancel:** a handle drag previews coordinates without changing the saved project. Releasing commits one undoable, autosaved edit; Escape or a cancelled pointer restores the starting pose. Selection stops temporary joint playback. Locked and joint-driven parts use their lock/joint controls, and exploded views must return to 0% for editing.

## Direct surface placement

- **Drag and release:** drag a card from Parts library onto a visible flat enclosure or component face. The translucent part aligns to that surface and commits on release. Escape, dragging away, or an invalid drop leaves the project unchanged.
- **Click / tap / keyboard:** click a library card, then a face; or choose an enclosure/component face in the Mounting surface menu and press Place part. This includes inner/outer faces and all panel edges. Choose the Open/Closed view before starting; the surface menu also reaches hidden faces. Scroll zoom and right-drag pan remain available. Multi-touch navigation does not place a part.
- **Precision:** Across U and Along V are center offsets in the face's coordinate system, shown by the +U / +V guides. Gap is measured from the selected part face: positive lifts it, negative recesses it. Choose bottom/top/front/back/left/right as the part face against the target, and set an exact in-plane turn. Inputs accept mixed units and fractions, including negative offsets.
- **Snapping:** 0.1, 1 or 5 mm grids plus nearby face center/edge snaps; Alt temporarily bypasses snapping. Numeric entries are never rounded to the grid. Select Free for unsnapped pointer placement. Overhangs are highlighted, not silently clamped.
- **Adjust later:** Surface position stays with a placed part. Use its fields or nudge buttons, Center, Flush, or Slide on surface. Sliding holds the normal/gap constant while moving in the face plane. **Snap to another face…** starts a new alignment; **Snap to a face…** is also available on freely positioned parts. Arrow keys nudge a preview with focus on the viewport or placement action buttons; Shift multiplies by 10, Alt by 0.1; R turns 90°, Enter applies, Escape cancels.
- **History and persistence:** each placement/slide is one undoable action, and its surface reference survives autosave and project JSON. Reusable subassemblies remap references between their members and discard references outside the saved assembly. Deleting a target clears the reference while retaining the placed part’s coordinates. Offsets are calculated from the actual transform, so resizing or world translation cannot leave stale numbers. An off-axis world rotation hides the surface fields until the part is realigned. Locked or joint-driven parts must be unlocked or moved through their joint controls.
- **Scope:** flat enclosure surfaces and nominal component envelopes; cutout walls and raised lettering are not selectable mounting planes. References are positioning aids, not live mates: moving/resizing a target or changing its saved joint pose does not carry the placed component with it. Use a joint for linked motion. Face placement stops motion preview and returns exploded/section views to an assembled view. Placement also works with the enclosure disabled when another visible physical component provides a target. When WebGL is unavailable or no target exists, catalog clicks retain the basic base-center record workflow. Snapping does not run collision physics or create a persistent mate.

## Workspace and accessibility

- **Add:** component catalog, custom parts, STL/STEP/GLB import, supplier references and reusable libraries.
- **Surface:** cutouts, pockets, raised/recessed lettering and decals.
- **Assemble:** reusable groups, joints/motion, wiring, harnesses and power estimates.
- **Inspect:** measurements/alignment, saved views/variants and part/surface exports.
- **Export:** client images, MP4 presentations, PDF/print reviews and GLB first; manufacturing/sourcing formats next; editable JSON backup at the bottom.

The menu beside the project title contains **units**, **Easy/Advanced controls** and **light/dark/high-contrast themes**. Autosave remains visible, including on narrow screens. Recovery is in the Project menu. Search supports names, categories and tags; **Clear filters** resets search, category and source together.

Drag either desktop panel divider to resize it. A focused divider accepts Left/Right arrow keys; Home or double-click restores the default width. Widths and desktop panel visibility are saved locally. On phones, parts and inspector open one at a time as drawers; use the close button, tap the shaded area, or press Escape. On tablets the catalog stays docked and the inspector opens as a drawer.

**Focus view** gives the model the available workspace without changing the saved panel layout. Press Escape or Exit focus to return. The **D** shortcut reveals the inspector and focuses Width (or enclosure Width). Exact dimension fields accept mixed units and fractions. Enter applies the value and returns focus to the field. Optional resize settings and project records remain in collapsible sections; inspector and assembly disclosure states survive edits during the session.

Parts/Assembly tabs use Left/Right, Home and End. Tool menus support Up/Down and Escape; closing a task dialog returns focus to the originating control or its menu heading. Active tools, view states and panels have accessible state attributes. Reduced-motion preferences disable interface transitions; the movie preview only plays on request.

## Implemented batches

| Batch | Implemented capability |
| --- | --- |
| 0.2 — real components | Local STL, STEP and GLB import; supplier catalog search and records; mounting/connector reference points; scalable imported geometry |
| 0.3 — precision and reuse | Nested assemblies; rigid numeric group transforms; multi-selection; alignment, spacing and edge offsets; vertex/surface-point measurements and planar area; versioned reusable templates with explicit updates or independent copies |
| 0.4 — custom geometry | Polygon-outline custom panels; rectangular, round, rounded, slot, polygon and SVG cutouts; through cuts, pockets, repeated patterns; mounting-point projection onto enclosure panels |
| 0.5 — surface detail | Embedded PNG/JPEG/WebP/SVG decals; placement, sizing, rotation and opacity; actual raised/recessed text geometry with three bundled fonts, size, spacing and alignment |
| 0.6 — system layout | Attached cable endpoints, world-space routing points and slack estimates; AC/DC/signal cable labels; component power zones; duty-cycle load and battery-runtime estimates; assembly sequence |
| 0.7 — review and fabrication | Oriented-envelope fit observations and intentional-fit acknowledgments; nominal SVG/DXF profiles; selected-solid STL; richer supplier BOM; surface-aware baselines |
| 0.8 — client presentation | Saved camera views, section display, part labels, textured GLB export, saved design variants and comparison |
| 0.9 — recovery and hardening | Schema migration, bounded undo, five recovery checkpoints, portable project/library JSON, input validation, bundled offline dependencies, automated geometry and editor checks |
| 1.0 foundations | Geometry, suppliers, surfaces, assemblies, recovery and exports |
| 1.1 motion and wiring | Seven joint types, gear/rack coupling, playback and saved poses; reusable multi-branch harnesses with conductor/pin records and cut lists |
| 1.1 catalog and sizing | All 267 InterfaceBench definitions, 20 additional motion components, source/category filters, nominal cutout transfer, mixed-unit dimensions and proportional anchored resizing |
| 1.2 cinematic MP4 | Closed assembly → transparent 360° → exploded 360° → reassembly and studio finish; timeline preview, local H.264 encoding, 720p/1080p and supersampled quality |
| 1.2.1 UI cleanup | Four task menus, grouped exports, quieter header, larger size fields, improved theme contrast, desktop panel resizing/preferences, mobile drawers, keyboard navigation and remembered disclosures |
| 1.3 surface placement | Library drag/drop, translucent preview, all flat enclosure faces, selectable part mounting face, grid/center/edge snapping, exact U/V/gap/turn, plane sliding and keyboard/tap alternatives |
| 1.4 engineering drawings | Isometric and six orthographic views, dimensioned components/surfaces, PDF/SVG packages and numeric registers |
| 1.5 editable details and enclosures | Search/edit existing surface features with draft previews; configurable screw, slide, hinge and snap closure geometry |
| 1.6 transforms and relative snapping | Automatic XYZ move/rotate handles, world/part axes, nearby center/edge/contact snaps, exact component-to-component face placement, live readouts and single-drag undo |
| Release gate | Packaged as **1.6.0-rc.1**; real-browser/WebGL/offline/print acceptance remains pending |

## Suppliers and model import

**McMaster-Carr, DigiKey and Mouser** each have a catalog search action. Save the manufacturer, manufacturer part number, supplier part number, product URL, datasheet and entered price on the component. Download available CAD from the supplier or manufacturer and import it locally. Use a dimensioned placeholder when no model is available.

This release does not scrape catalogs, impersonate a supplier API, automatically download gated CAD, synchronize live pricing/stock, or place orders. Direct authenticated supplier integrations remain a later milestone. Supplier availability and download permissions vary by product and account.

- **STL:** ASCII or binary; choose source units explicitly (mm or inches). No color data.
- **STEP/STP:** converted locally by the bundled Open CASCADE WASM reader. Choose a tessellation detail. Retains assembly hierarchy and available mesh colors. Imported parts are meshes; STEP parametric history is not editable and STEP export is not included.
- **GLB:** self-contained, uncompressed glTF 2.0. Converts meters/Y-up into the application's mm/Z-up. Retains per-mesh diffuse color; source textures, animations and skin deformation are not imported. External resources are rejected. Draco, Meshopt and KTX codecs are not bundled.
- Meshes are normalized internally; changing dimensions scales them independently on each axis. Real supplier dimensions still need confirmation.

## Surfaces and fabrication

Features belong to a host part or enclosure panel and remain attached through movement, rotation, duplication and reusable-assembly insertion. Coordinates are relative to the selected face center, **viewed from outside**. X is across the face; Y is up that face. The top face uses world X/Y before part rotation.

Solid edits support panels/blocks, cylinders, brackets and closed imported meshes. Open or non-manifold imported meshes can still be displayed and decorated, but cannot receive solid edits. Editing a custom outline or resizing a host may invalidate an existing feature: inspect the geometry message and fit review. Export blocks when geometry generation has failed.

Cutouts have editable dimensions, depth, position, rotation and optional rectangular patterns. SVG profiles must contain self-contained filled paths/basic shapes; convert text/strokes to outlines before importing. Custom polygon coordinates define a shape that scales to the width/height fields. Pocket/deboss depth must be less than the selected face's host thickness. Text uses bundled glyph outlines; unsupported characters produce a message.

Decals are flat projections, not wraps around curved surfaces. Artwork is rasterized to embedded PNG at a maximum 2048-pixel dimension, preserving transparency. This keeps project files portable and prevents external image dependencies. Actual lettering belongs in Emboss/Deboss when physical geometry is required.

Mounting-hole projection copies component reference points onto a chosen enclosure panel. It is a **one-time pattern**, not a live mounting constraint. Moving the source component later does not move those holes; review or regenerate them.

SVG and DXF exports are supported for rectangular panel faces and top/bottom faces of polygon-outline panels. They are nominal 1:1 mm profiles with separate through-cut, pocket, emboss and deboss operations. DXF uses millimeter units and closed lightweight polylines. They are not toolpaths: no kerf, cutter-radius, bend, joint or tolerance compensation is applied. Use STL for other solid shapes.

## Editing applied surface features

Choose **Surface → Edit applied features** to search all existing cutouts, pockets, decals and lettering, including hidden features. Filter by host part or panel, then select **Edit**. Applied features also appear first in the selected host's inspector. Double-click a decal in the 3D view to edit it directly; double-click a host to browse its features.

Edit the host/face, name, size, position and rotation. Cutouts can switch between through-cuts and pockets and change profile, depth or pattern. Text retains editable content, font, size, spacing, alignment and raised/recessed operation. Decals retain editable artwork, dimensions and opacity. Replace artwork using the file control. The face preview highlights the current draft; **Preview in 3D** is temporary. **Save changes** preserves the feature's identity and solid-operation order; **Cancel** restores the saved model. Copy, Show/Hide, Delete and Undo remain available.

## Enclosure styles

Select **Enclosure** above the inspector, then choose **Lid / closure**. Use **Adjust closure dimensions** for exact mm, inch or fractional values. The closure is generated as real geometry and stays editable with the box dimensions.

| Style | Modeled details |
| --- | --- |
| Lift-off lid | Original six-panel enclosure and removable lid |
| Internal screw posts | Four internal posts, pilot bores, lid clearance holes and head recesses |
| External screw tabs | Four matching pairs of projecting tabs with screw clearance holes |
| Sliding lid | Inset lid, side-wall grooves and lowered front wall; opens toward the front |
| Pin-hinged lid | Alternating back-edge knuckles, leaves and a pin; opens 110° around the pin |
| Snap-fit lid | Four cantilever clips with ramped catches and receiving side-wall windows |

Open view moves sliding/hinged lids and removes lift-off lids. Transparent and exploded views reveal closure details. Opening is a display state; use explicit joints for saved motion of attached parts/subassemblies. During surface placement, an open sliding/hinged enclosure switches to Transparent so the lid and placement coordinates agree at the saved pose.

Panel IDs and applied features survive style changes. Feature coordinates stay at their original face-relative values; inspect them and placed components after changing panel geometry. Sliding lids reduce usable inside height by one additional wall thickness. Box dimensions exclude projecting hardware; actual export extents include it. Screw-post and clip intrusion is not evaluated by the conservative component-envelope fit check.

Generated details carry into STL, GLB, MP4 and engineering drawings. Drawing packages include closure parameters and local geometry dimensions. SVG/DXF profile export blocks panels with 3D closure operations to avoid omitting geometry; decal artwork export remains available. Loose screws, threads and head styles are not modeled. The hinge pin is a separate solid carried with the lid's export group. Snap elasticity, material strength, assembly forces and manufacturing tolerances require separate design verification.

## Assemblies, wires and power

Assembly groups can nest. Moving/rotating a group applies a rigid transform to its parts and descendants. A locked member prevents group movement. Individual Move/Rotate handles operate on parts; group transforms use the inspector's exact fields.

Saving to the reusable library stores component geometry, host features, reference points, internal cable routes and harness metadata, and joints/couplings whose parent and child both belong to the saved assembly. Joints attached to the world or an external body stay project-specific. Linked instances update only through **Update from library**. Updating replaces local instance edits; Undo can recover them. Independent copies do not update. Export/import library JSON to move templates to another browser.

Cable endpoints can attach to part centers or reference points. Intermediate route coordinates are world-space points. Internal assembly routes move with the assembly. A route between different assemblies keeps its world-space waypoints. Cable cut length is the polyline centerline at the saved joint pose × (1 + slack percentage / 100), plus additional service length in mm; the tube is illustrative and has no minimum bend-radius or connector-fitting model.

Average load = sum of entered watts × duty cycle. Available output energy = entered battery Wh × usable fraction × overall conversion efficiency. Estimated runtime = available output Wh ÷ average watts. Unknown electrical loads are shown separately; runtime is based only on entered loads. The AC/battery settings and zones are recorded assumptions, not circuit simulation or safety certification.

## Joints and motion

Open **Joints & motion** in the creation toolbar or inspector. **Add rack-and-pinion example** inserts a working two-body mechanism without replacing the current project.

| Joint | Degrees of freedom |
| --- | --- |
| Fixed | Child follows its parent with no relative movement |
| Revolute / hinge | One angle about the chosen axis and pivot |
| Slider | One distance along the chosen axis |
| Screw | One angle; travel = angle / 360 × signed lead |
| Cylindrical | Independent axial rotation and translation |
| Ball | Three Euler XYZ angles in the parent frame about the pivot |
| Planar | Two in-plane translations plus rotation about the plane normal |

Select a parent part/subassembly/panel or World and a moving body. Enter the pivot and axis in world mm; the app stores them in the parent frame. The placed geometry defines the zero pose. Motion limits are explicit for each degree of freedom. One joint drives each body; split a linkage into separate nonoverlapping groups. Cycles, duplicate drivers and missing bodies are rejected. Manual positioning of a driven body is blocked; use its joint controls. A larger group containing an entirely internal mechanism can still move as a unit.

**Link gears / rack** connects a rotary driver to another rotary joint or a slider. External gear ratio is −driver teeth / follower teeth. Rack travel is driver degrees / 360 × π × pitch diameter × signed ratio, plus offset. Coupled followers are controlled through the driver. Playback stops if a follower would exceed its limits.

Click a joint to open the viewport controls. Drag a slider or type a value, Play/Pause a four-second limit sweep, then **Keep pose** to save. **Reset preview** returns to the saved pose. PNG and GLB include the current preview; STL and fit observations use the saved pose. Exploded views include saved motion positions. This is kinematic preview, without forces, collision solving, gear contact/backlash, or cable strain simulation.

## Custom and reusable harnesses

Open **Wiring & power → Custom & reusable harnesses**. Create a named harness, add branches or assign existing routes, then use **Conductors** to set labels, colors, gauge/area, signal, connectors and from/to pins. Each branch has a diameter, AC/DC/signal zone, sleeve (none/braid/loom/ribbon), percent slack and extra service length. Edit route points and start/end part/reference-point attachments with the branch name button.

**Save reusable** preserves all branches, conductor records, routing offsets and named attachment roles in IndexedDB and the project's harness library. **Insert** maps each role to a new component/reference point or leaves it unattached at an entered origin. Review intermediate waypoints after remapping; they retain their saved offsets. Ungrouping a harness retains its routes. Project JSON carries included templates to another browser.

**Export cut list CSV** writes one row per conductor, with routing length, allowances, sleeve, connector and pin labels. The length uses the saved pose, not an unsaved animation frame; it is an installation estimate. Up to 64 conductors per route are retained in records/exports; at most 16 colored conductors are drawn for performance. Braid/loom/ribbon are illustrative appearances rather than modeled braid/weave geometry.

## Component library

The catalog contains **320 entries**: the original 33 components, **all 267 definitions from INTERFACEBENCH v1.6.0-rc.1**, and 20 additional motion components. Source/category filters and text search include category and tags. InterfaceBench covers buttons, switches/selectors, knobs/encoders, faders/joysticks, indicators/sound, displays/meters, audio/coax, data/multipin, power/protection, sensors, cable routing, mounting, ventilation and board carriers.

InterfaceBench source front/rear outlines, nominal openings, terminal labels, provenance, notes and drawing references are bundled unchanged in `interface-catalog.js`. The 3D adapter makes illustrative front/rear bodies; terminal points are layout placeholders, not verified pin coordinates. The original dimensions and planning assumptions remain authoritative for that template. Resizing the 3D body does not rewrite the source definition. **Add nominal cutout pattern** transfers the original openings to an enclosure face as independently editable surface features.

Motion components include spur gears, pinions, racks, linear rails/carriages, electric/pneumatic actuators, solenoids, lead screws/nuts, pulleys, couplings, pillow bearings, hinges, clevises, links, springs, servo horns, handwheels and a stepper with shaft. Tooth/turn counts and bore ratios are editable where available. Gear teeth are a visual approximation, not a manufacturing involute. Specialized catalog models do not receive boolean edits directly; use a custom solid or a closed imported mesh for such fabrication edits.

## MP4 product presentations

Choose **Export → MP4 presentation**, or **Views & variants → MP4 presentation**. Scrub the timeline or select a chapter to inspect the sequence. Preview is paused initially. Press **Render MP4**, then **Download MP4** when the result is ready. The completed clip can also be played in the dialog. Download before closing the dialog; the movie is not stored in IndexedDB or project JSON.

The default 40-second presentation follows this sequence. Changing duration scales each chapter proportionally:

| Time | Presentation |
| --- | --- |
| 0–3 s | Fully assembled, with all enabled enclosure panels closed |
| 3–6 s | Smooth transition to a transparent enclosure |
| 6–16 s | One complete 360° orbit with the interior visible |
| 16–20 s | Parts separate into an exploded arrangement; enclosure panels become opaque |
| 20–30 s | One complete 360° orbit around the exploded assembly |
| 30–34 s | Parts return to their original placed positions |
| 34–40 s | Opaque, assembled studio finish with a small camera move and final hold |

**Controls:** 20–60 seconds, 1280 × 720 or 1920 × 1080, 24 or 30 fps, Standard or High quality, warm/white/charcoal backgrounds, exploded spacing, reveal opacity and camera elevation. Options are saved in the project. High quality renders at twice the output width and height, downsamples the image, and uses finer shadows. Preview runs at 960 × 540 to reduce load.

The presentation uses a separate scene and starts from the **placed/zero assembly**, independent of the editor camera, saved joint pose, open lid, section plane or workspace explosion. Hidden physical components are included by default; turn this off in Composition. Keep-out volumes and editor annotations are omitted. Surface cutouts, emboss/deboss text, decals and component colors are retained. Harnesses appear in assembled views and hide during the explosion; the movie does not simulate cable deformation. The enclosure must be enabled to appear; custom manually placed lids must already be in their intended closed positions.

Studio lighting, soft shadow maps, reflection cards, physically based materials, wood grain and antialiasing improve realism. This is rasterized rendering, not a ray-traced image generator. Geometry and artwork quality determine the result: supplier CAD generally gives more detail than illustrative catalog envelopes, and imported GLB source textures remain unsupported.

A bundled software H.264 encoder runs in a dedicated worker and creates a **silent MP4** locally. Frames follow the deterministic timeline rather than recording real-time playback, so slower rendering does not drop movie frames. No encoding server, native codec API, API key or cross-origin isolation is required. Keep the tab open during rendering; background tabs can take longer. Cancel or closing the dialog stops encoding and frees resources. If GPU or memory limits are reached, try 720p / Standard quality. The current project and editor view are preserved.

## Coordinates and precision

Internal geometry is millimeters. Display-unit changes do not rescale the product.

Select an object and type directly in the prominent **Size** fields. Examples: `50 mm`, `2 in`, `1/4 in`, `1 1/2 in`, `2.5 cm`, or a number in the current unit. Press **D** to focus Width. Enter or leaving a field applies one undoable change. ± buttons step 1 mm or 0.1 inch. **Keep proportions** scales all axes. Resize anchors are center, bottom face or minimum/maximum XYZ corners in the object's local frame. Joint-driven objects use the center anchor. Reference points scale proportionally; cutouts, text, decals and existing cable attachment coordinates retain their entered physical dimensions. Enclosure dimensions and thickness also accept unit expressions.

- X = width/right; Y = depth/back; Z = height/up. Front is negative Y.
- The enclosure's footprint center is X/Y zero; its outside bottom is Z zero.
- Part position is the component envelope center. Rotation uses Euler XYZ degrees.
- Face/edge alignment uses rotated bounding envelopes. Measurements snap to the nearest hit-triangle vertex or selected surface point; exact coordinates can also be entered.
- Area is available for coplanar points entered in boundary order. Do not use self-intersecting boundaries.
- Explode and section clipping affect presentation only. Return Explode to zero before transforms or measurements. Section views are uncapped visual cuts and are not fabrication edits.

## Storage, privacy and recovery

Projects, reusable templates and recovery checkpoints use local IndexedDB. Visual preferences and the legacy small-part catalog use localStorage. No project data, imported CAD or decals are sent to a server. Runtime libraries and fonts are bundled; no telemetry, analytics or CDN dependency is included. Supplier search opens an external catalog with the query you enter.

Autosave has a visible state indicator. The five newest checkpoints are retained before project replacement, periodically while saving edits, and on demand. Undo/redo retains up to 30 actions for the current session. A checkpoint is still browser-local: **export JSON for durable backups**. Clearing site data removes local projects and libraries. Hosted and self-hosted copies have separate origins and storage.

Limits: 500 components, 500,000 imported triangles per project, 40 MB per model, 120 MB per project/library import, 500 surface features, up to 100 instances per feature pattern, 250 assembly groups, 250 cable routes, 100 harnesses, 50 reusable harness templates, 64 conductors per route, 250 joints/couplings, 30 reusable assembly templates, 10 variants and 30 saved views. Actual capacity depends on browser memory and storage. Variant/library snapshots embed geometry and can substantially increase JSON size.

Offline use requires the first successful full cache on HTTPS or localhost. All conversion and geometry libraries, including the STEP and solid WASM engines, are listed in the offline cache. Supplier websites still require connectivity. If caching/storage is denied or fails, the app reports it; keep a JSON backup.

## Outputs

| Output | Contents and boundary |
| --- | --- |
| Project JSON | Editable parts, imported triangles, embedded decals, features, assemblies, joints/couplings, harnesses/conductors/templates, wires, views, variants, included templates, evidence and baseline |
| Library JSON | Reusable part/assembly templates and their saved geometry |
| MP4 | Deterministic product presentation with two 360° orbits, 720p/1080p, 24/30 fps, 20–60 seconds, H.264 video without audio |
| PNG | Current view and explosion, without grid, handles or measurement overlays |
| Printable review | View, brief, enclosure, BOM, observations, assumptions/evidence, power entries, surface features, cables and assembly steps; print to PDF |
| Harness CSV | Conductor cut list at the saved joint pose, connector/pin mapping, gauge/color, sleeve and length allowances |
| BOM CSV | Grouped physical components, including hidden parts; manufacturer/supplier references, costs, loads and zones. Different machining or supplier records remain separate. Enclosure panels, service volumes, labor, tax and shipping are excluded. |
| Assembly STL | Full enabled enclosure and all physical parts at the saved joint pose, including hidden parts. Cuts and text are baked into geometry; decals, colors and cables are omitted. Components remain separate and may overlap. |
| Selected STL | Chosen component or panel with its solid edits, in mm at its saved joint pose |
| GLB | Visible current assembly, materials, decals, and un-exploded cable routes. Uses standard meters/Y-up. Section clipping and annotation sprites are omitted. |
| SVG/DXF | Nominal planar profiles by operation; SVG artwork option embeds decals at physical size |

## Review limits

Built-in component sizes are illustrative. Use measured or supplier dimensions and retain references. Fit observations use oriented bounding envelopes at the saved joint pose, including hidden components; they exclude unsaved playback previews. They do not subtract openings or inspect concave triangle collisions. A panel-mounted component can legitimately overlap a panel envelope. Intentional-fit acknowledgment retains the observation rather than asserting physical clearance.

This is a product mockup and layout instrument. It does not provide face/edge mating, force-based motion or structural/thermal simulation, electrical protection design, battery charging design, compliance certification, sheet-metal unfolding, woodworking joinery or machining toolpaths. Baselines and variants support comparison, not a client approval/signature system.

## Engineering drawing packages

Choose **Export → Engineering drawings**. Set the drawing number/revision, paper, units and precision, then **Generate drawing package**. Preview individual sheets and download either the complete PDF or a ZIP containing that PDF, each sheet as SVG, `dimensions.json`, and printing notes. No print dialog, account or external service is required to create the PDF. Drawing preferences save with project JSON; download files themselves are temporary until saved.

The default package includes:

- A shaded 3D isometric assembly view with overall X/Y/Z dimensions.
- Separate **top, bottom, left, right, front and back** views, overall extents, component center coordinates and projected sizes. Solid edges are visible; optional dashed edges are hidden. Crowded location callouts continue on additional sheets.
- Individual component and enclosure-panel sheets with local top/front/right and isometric views, nominal body dimensions, saved assembly positions, rotations and available mounting references.
- Surface layouts for cutouts, decal boundaries and embossed/debossed text. Face-center U/V datums, positions, widths/heights, turn angles, through/pocket depth, corner radii, text size, pattern counts/pitches and custom contour vertices are recorded. Crowded surfaces repeat with additional labeled callouts.
- Registers of body sizes, placements, mechanical parameters, reference points, custom outlines, wiring route diameters/segments/coordinates/slack/cut lengths, saved joint values, assumptions and evidence. Long entries continue across sheets without truncating their data.

Paper options are landscape Tabloid/ANSI B, A3, Letter and A4. Use project units, mm or inches, 0–4 decimals, automatic fit or a standard explicit scale. A fixed scale that cannot fit produces a clear error. Isometric views auto-fit; title blocks state actual scales. Nonzero dimensions smaller than the selected precision retain three significant digits. The numeric JSON register always stores model dimensions in millimeters without display rounding. Print at **100%**, with printer scaling disabled, on the selected paper.

Drawings use the **saved joint pose**, independently of camera, open-lid display, section planes, explosion and unsaved motion playback. Enabled enclosure panels and hidden physical parts are included by default; clearance volumes are excluded. Wire dimensions follow saved attachment positions. Surface feature visibility is respected. Drawing setup and generation do not alter model geometry.

These are **nominal model drawings**. Placeholder/COTS geometry remains illustrative; unsupported source dimensions, tolerances, fits, threads, welds, finishes and manufacturing processes are not inferred. Part reference points provide coordinates, not unknown hole diameters. Decals show placement boundaries, not image pixels. Isometric shading is a raster with vector edges; the six orthographic views, dimension lines and text are vector. Hidden-line classification uses a finite-resolution depth buffer, so review very small or intersecting geometry against the source model. This release does not add GD&T or a fabrication approval workflow.

PDF font data and all geometry code are bundled for offline use. Export requires browser `CompressionStream` support. Generating large detailed models can take longer and consume more memory; progress and cancellation are provided between geometry/sheet operations. The dialog revokes temporary download URLs when settings change or it closes, so save downloads before closing.

## Verification and release gate

**102 automated tests pass** in Node with the actual bundled Three.js, Manifold and STEP kernels, plus LinkeDOM and fake-indexeddb for DOM/storage behavior. Coverage includes:

- Legacy and new project validation, JSON round trips, persistence and five-checkpoint retention.
- Applied-feature editing across cutouts/pockets, emboss/deboss and decals: identity/order preservation, temporary previews, cancellation, hidden-feature search, invalid-profile errors and saved artwork.
- All six enclosure styles at two sizes: manifold validity, pairwise panel interference, opening-axis clearance, saved parameters, real app autosave/undo, mesh-cache updates, fit height, STL/movie/drawing geometry and planar-export guards.
- Exact panel/component envelopes, rotations, overlaps, accepted observations and CSV escaping.
- All-face cuts, pockets, text volume, polygons/SVG holes/patterns and actual cut geometry in STL.
- Nested group rotation, attached routes, template insertion/revision update and attachment preservation.
- STEP conversion of a generated known-size box and GLB export/import scale, orientation and color.
- Fabrication units/layers, BOM machining separation, and feature-aware baselines.
- Editor creation forms, grouping/reuse, supplier references, app startup fallback, project replacement and undo.
- Joint chains and all seven types, transformed panels/groups, gear/rack ratios, limits, cycle rejection and motion-aware STL export.
- Live pose transforms reuse component geometry and update colored harness routing.
- Harness branch/connector/conductor round trips, reusable attachment-role remapping, assembly-contained motion/harness reuse, cut-length calculation and CSV formula escaping.
- Complete 267-entry InterfaceBench coverage, source patterns and terminal labels.
- Mixed-unit/fraction dimension parsing, linked sizing, rotated resize anchors and actual editor controls.
- All 36 enclosure surfaces × six component mounting faces, rotated panel poses, real mesh hit testing, cutout-wall rejection, signed offsets, snapping/overhang, placement reference JSON round trips, native drag event/drop/cancel, tap/picker/keyboard paths, plane-slide drafts and single-action history with a substituted scene.
- Real bundled TransformControls pointer/plane/ring math, automatic attachment, world/local axes, increment and nearby snapping, Alt override, preview isolation, one-commit release, cancellation and selection guards.
- All six rotated component target faces × six mounting faces, actual component raycasts, self-exclusion, exact relative offsets, unavailable-target rejection, reusable reference remapping, deletion cleanup and schema 5 round trips.
- Transform preferences, live inspector/readout behavior and exact mixed-unit position edits with app undo.
- Desktop width/visibility preferences, keyboard and pointer divider controls, focus-view restoration, exclusive phone drawers, tablet catalog preservation, keyboard menu/tab navigation, dialog focus return, disclosure retention and all nine export routes.
- Engineering drawing orientations, exact extents and locations, rotated saved poses, hidden-edge classification and curved-body silhouettes, real feature geometry, patterns, profiles, reference coordinates and wire cut lengths.
- Drawing unit conversion, small dimensions, fixed-scale validation, cancellation, crowded surface and long-table pagination on A4, and preview/download/settings/error-retry flows with a DOM substitute.
- Generated PDFs and ZIPs parsed independently with PyMuPDF, Python ZIP CRC checks and XML parsing: physical page sizes, Unicode text, embedded isometric images, PDF/SVG sheet count and exact dimension data.
- Movie chapter continuity, complete orbits, first/last closed states, original project preservation, real solid feature geometry, option migration, bounded frame requests, cancellation and cleanup.
- MP4 dialog settings, scrubbing, export/download flow, supersampling dimensions, failures and retry with a substituted renderer/encoder.
- The actual bundled web/WASM encoder in a Node worker-scope simulation: FFprobe verifies 720p/24 fps and 1080p/30 fps H.264/yuv420p files; FFmpeg decodes and checks first/last frame colors. These are synthetic codec fixtures, not visually verified product renders.

Module syntax and local asset/cache paths are checked. Service-worker installation coverage, same-origin boundaries and navigation fallback are tested with a simulated cache/network. The DOM tests do **not** run WebGL or a real browser.

The established browser acceptance gate remains: real-browser surface-feature/closure controls, rendering and XYZ handles/snapping feedback, native drag/drop ghost feedback, touch placement and plane sliding, responsive layouts, keyboard/focus/theme paths, decal decoding/export, native file dialogs, real IndexedDB reload, offline reload, cinematic lighting/camera framing/decal visibility, real-browser MP4 rendering/playback/download/cancellation, drawing preview and native downloads, and printed report layout at the deployed route. These checks could not run because the approved browser QA facility was unavailable. The Sites skill requires skipping browser QA in that situation. Generated engineering PDFs and software-rendered open/closed enclosure geometry have been visually inspected; browser UI and WebGL visual verification remain pending. This package therefore remains **v1.6.0-rc.1**.

## Next milestones

1. Complete the browser acceptance pass; fix observed issues; promote the tested state to v1.6.0.
2. Curved-surface decals, ray-traced client rendering and imported source textures.
3. Parametric STEP export, persistent face/edge mating, collision/clearance evaluation across motion and live mounting associations.
4. Wood joinery, sheet-metal bends, material/tolerance and cutter compensation.
5. Credentialed supplier catalog/pricing integrations and procurement exports.

## Development and licenses

`dist/` is deployable without compiling. `tests/` is development-only. With Node, Python/PyMuPDF and FFmpeg/FFprobe installed, run `npm ci`, then `npm test`. Production does not need Node or npm.

Bundled dependencies: Three.js 0.180.0 (MIT), Manifold 3.5.4 (Apache-2.0), occt-import-js 0.0.23 and its Open CASCADE distribution (see bundled notices), Three.js example fonts with their bundled licenses, DejaVu Sans 2.37 (Bitstream Vera/DejaVu terms), and h264-mp4-encoder 1.0.12 (MIT wrapper, minih264 public domain/CC0 and libmp4v2 MPL-1.1). License text is in `vendor/` in the server ZIP and `dist/vendor/` in the source repository. Open-source source references and redistribution information are in `THIRD-PARTY.md`.

InterfaceBench catalog data is carried from Mike Parks’s INTERFACEBENCH v1.6.0-rc.1 server package with its GPLv3 license in `INTERFACEBENCH-LICENSE.txt`. The imported module is human-readable source data; the adapter and regeneration script are supplied in this repository. See `THIRD-PARTY.md`.
