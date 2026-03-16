# SVG Editor — Comprehensive Feature Requirements

A complete answer to the question: *what does an SVG editor need to be truly capable?*

This document covers every necessary and quality-of-life feature across rendering, editing, structure, workflow, and output. Features are marked as **[CORE]** (necessary for basic correctness), **[STANDARD]** (expected in any competent editor), or **[QOL]** (quality of life / power-user).

---

## Table of Contents

1. [Canvas & Viewport](#1-canvas--viewport)
2. [Rendering Fidelity](#2-rendering-fidelity)
3. [Document Structure & The Defs System](#3-document-structure--the-defs-system)
4. [Layers & Z-Order](#4-layers--z-order)
5. [Element Selection & Inspection](#5-element-selection--inspection)
6. [Shape Editing](#6-shape-editing)
7. [Path Editing](#7-path-editing)
8. [Text Editing](#8-text-editing)
9. [Transforms](#9-transforms)
10. [Fill & Stroke](#10-fill--stroke)
11. [Gradients](#11-gradients)
12. [Filters & Effects](#12-filters--effects)
13. [Clipping & Masking](#13-clipping--masking)
14. [Groups & Nesting](#14-groups--nesting)
15. [Symbols & Use Instances](#15-symbols--use-instances)
16. [Markers & Arrowheads](#16-markers--arrowheads)
17. [Patterns](#17-patterns)
18. [Animations (SMIL & CSS)](#18-animations-smil--css)
19. [Coordinate System Tools](#19-coordinate-system-tools)
20. [Snapping & Alignment](#20-snapping--alignment)
21. [Code View & Direct Editing](#21-code-view--direct-editing)
22. [Import & Export](#22-import--export)
23. [History & Version Control](#23-history--version-control)
24. [Accessibility & Metadata](#24-accessibility--metadata)
25. [Performance & Large File Handling](#25-performance--large-file-handling)
26. [Collaboration](#26-collaboration)
27. [Extensibility & Scripting](#27-extensibility--scripting)
28. [Mobile & Touch Support](#28-mobile--touch-support)

---

## 1. Canvas & Viewport

### Coordinate Space
- **[CORE]** Correctly interpret and render any `viewBox` value, including negative origin coordinates (e.g. `viewBox="-500 -500 1000 1000"`)
- **[CORE]** Display a ruler/grid that reflects the SVG coordinate space, not screen pixels
- **[CORE]** Show the origin `(0,0)` as a reference point on the canvas, even when it is not the top-left corner
- **[CORE]** Handle `preserveAspectRatio` — all variants (`xMinYMin`, `xMidYMid`, `none`, etc.) with `meet` and `slice`
- **[CORE]** Handle `width` and `height` as percentages, absolute units (px, pt, mm, cm, in), or absent
- **[STANDARD]** Display cursor coordinates in SVG user units (not screen pixels) in real time
- **[STANDARD]** Show a crosshair or marker at the SVG origin
- **[QOL]** Toggle between screen-pixel coordinates and SVG user-unit coordinates in the status bar
- **[QOL]** Display a secondary ruler overlay tied to a selected element's local coordinate space

### Zoom & Pan
- **[CORE]** Smooth zoom in/out with scroll wheel, pinch, or keyboard shortcuts
- **[CORE]** Pan by middle-click drag, spacebar drag, or two-finger scroll
- **[STANDARD]** Zoom to fit the full document in view
- **[STANDARD]** Zoom to selection
- **[STANDARD]** Zoom to a specific percentage or user-unit width
- **[STANDARD]** Zoom to the actual rendered pixel size (1:1 screen pixels)
- **[QOL]** Minimap / overview panel showing the full document with a viewport indicator
- **[QOL]** Named view positions (bookmark a zoom/pan state)
- **[QOL]** Zoom around the cursor rather than the canvas center
- **[QOL]** Infinite canvas mode that expands as content is added outside the viewBox

### Canvas Settings
- **[CORE]** Edit the `viewBox` directly (x, y, width, height fields)
- **[CORE]** Edit document `width` and `height` with unit selector
- **[STANDARD]** Resize canvas with options: resize only, resize and scale content, resize and reposition content
- **[STANDARD]** Toggle canvas background color (for editor UI only, not the SVG itself)
- **[QOL]** Checkerboard background option to visualize transparency
- **[QOL]** Canvas border / shadow to distinguish the SVG boundary from the editor workspace

---

## 2. Rendering Fidelity

### Correctness
- **[CORE]** Render all SVG 1.1 elements correctly: `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`, `text`, `image`, `use`, `g`, `symbol`, `defs`, `clipPath`, `mask`, `filter`, `pattern`, `marker`, `linearGradient`, `radialGradient`, `stop`, `animate`, `animateTransform`, etc.
- **[CORE]** Render `stroke-dasharray` with any number of values — not just a simple dash/gap pair
- **[CORE]** Render `stroke-dashoffset` correctly with animated or static values
- **[CORE]** Render `stroke-linecap` (`butt`, `round`, `square`) and `stroke-linejoin` (`miter`, `round`, `bevel`) correctly, including `stroke-miterlimit`
- **[CORE]** Render `fill-rule` (`nonzero` and `evenodd`) correctly for complex self-intersecting paths
- **[CORE]** Render all paint servers as stroke or fill: solid colors, `url(#gradient)`, `url(#pattern)`, `none`, `currentColor`
- **[CORE]** Render `opacity`, `fill-opacity`, and `stroke-opacity` independently and stacked
- **[CORE]** Render nested group opacity correctly (multiplicative stacking)
- **[CORE]** Render SVG filter primitives: `feGaussianBlur`, `feColorMatrix`, `feComposite`, `feBlend`, `feMorphology`, `feOffset`, `feTurbulence`, `feDisplacementMap`, `feFlood`, `feImage`, `feMerge`, `feConvolveMatrix`, `feComponentTransfer`, `feDiffuseLighting`, `feSpecularLighting`, `fePointLight`, `feSpotLight`, `feDistantLight`
- **[CORE]** Correctly inflate bounding boxes for elements with `filter` applied (glow, shadow, blur all extend beyond geometry bounds)
- **[CORE]** Render `clip-path` and `mask` correctly including soft masks
- **[CORE]** Respect paint order (`paint-order` property: `fill`, `stroke`, `markers`)

### Color
- **[CORE]** Render all CSS color formats: hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, named colors
- **[STANDARD]** Render `currentColor` relative to its inherited context
- **[QOL]** Show a color profile selector (sRGB vs display-P3 for screens)
- **[QOL]** Gamut warning indicator for colors that will shift on non-P3 displays or in print

---

## 3. Document Structure & The Defs System

### Defs Panel
- **[CORE]** Parse and list all elements within `<defs>`: gradients, filters, symbols, clipPaths, masks, patterns, markers, and raw reusable shapes
- **[CORE]** Show a live thumbnail/preview for each def item
- **[CORE]** Show usage count for each def — how many elements reference it
- **[CORE]** Allow renaming def IDs — with automatic update of all `href`, `url()`, and `id` references throughout the document
- **[STANDARD]** Allow deleting a def, with a warning if it is currently referenced
- **[STANDARD]** Allow duplicating a def to create a new independent variant
- **[STANDARD]** Allow creating new defs (new gradient, new filter, new symbol) from the panel
- **[QOL]** "Find all uses" — highlight every element in the layer tree that references a given def
- **[QOL]** "Extract to defs" — take an inline shape and convert it to a reusable def + `<use>` instance
- **[QOL]** Unused def cleanup — identify and optionally remove defs that are not referenced anywhere
- **[QOL]** Orphaned reference warning — flag `url(#id)` or `href="#id"` values that point to non-existent IDs

### ID Management
- **[CORE]** Every element can have an `id` assigned or edited
- **[STANDARD]** Warn on duplicate `id` values (which are invalid in SVG/HTML)
- **[STANDARD]** Auto-generate unique IDs when creating elements
- **[QOL]** Global find-and-replace for IDs
- **[QOL]** ID audit view — list all IDs in the document with their element type and usage

---

## 4. Layers & Z-Order

### Layer Panel
- **[CORE]** Show all elements as an ordered list reflecting document render order (bottom to top)
- **[CORE]** Show nested structure — groups collapsed/expanded with indentation
- **[CORE]** Show element type icon and a brief label (tag name + id or class if present)
- **[CORE]** Show visibility toggle per element/group (adds `display:none` or `visibility:hidden`)
- **[CORE]** Show lock toggle per element/group (prevents selection and editing on canvas)
- **[STANDARD]** Show opacity slider per layer row
- **[STANDARD]** Drag-to-reorder within the layer panel, updating document order
- **[STANDARD]** Multi-select in the layer panel
- **[STANDARD]** Right-click context menu on layer items: duplicate, delete, group, ungroup, move to top/bottom
- **[QOL]** Color-coded layer labels (user-assigned)
- **[QOL]** Layer search/filter by name, tag, or class
- **[QOL]** Collapse all / expand all
- **[QOL]** "Solo" mode — hide everything except selected layers
- **[QOL]** Flatten group — inline a group's children into its parent level

### Z-Order Controls
- **[CORE]** Bring to front / send to back
- **[CORE]** Bring forward / send backward (one step)
- **[STANDARD]** Move to a specific position in the stack by number
- **[QOL]** Move to just above / just below a target element

---

## 5. Element Selection & Inspection

### Selection Mechanics
- **[CORE]** Click to select a single element
- **[CORE]** Click on overlapping elements cycles through the stack at that point
- **[CORE]** Rubber-band (drag) selection — selects all elements whose bounding box intersects or is contained within the drag rect
- **[CORE]** Shift-click to add/remove from selection
- **[CORE]** Ctrl/Cmd+A to select all
- **[STANDARD]** Select all of the same type (e.g. all `<circle>` elements)
- **[STANDARD]** Select all with the same fill, stroke, or filter
- **[STANDARD]** Click-through locked layers to reach elements beneath
- **[QOL]** "Select same" menu: same fill color, same stroke color, same stroke width, same opacity, same class, same tag type
- **[QOL]** Invert selection
- **[QOL]** Selection history (re-select previous selection)
- **[QOL]** Tab key to cycle through all elements in document order

### Bounding Box & Handles
- **[CORE]** Show bounding box with resize handles (8-point: 4 corners + 4 edges)
- **[CORE]** Show rotation handle above the bounding box
- **[CORE]** Bounding box must account for stroke width (visual bounds, not geometric bounds)
- **[CORE]** Bounding box must account for filter region overflow (a glowing element's visual bounds are larger than its geometry)
- **[STANDARD]** Show center point handle for moving
- **[STANDARD]** Constrain resize proportionally with Shift key
- **[STANDARD]** Resize from center with Alt/Option key
- **[QOL]** Show individual handles for each segment type (scale-x only, scale-y only)
- **[QOL]** Toggle between geometric bounds and visual bounds for the bounding box display

### Properties Inspector
- **[CORE]** Show all attributes of the selected element with editable fields
- **[CORE]** Show computed/inherited styles separate from explicitly set attributes
- **[CORE]** Show the element's position (x, y or cx, cy) in SVG coordinates
- **[CORE]** Show the element's size (width/height or r/rx/ry) in SVG units
- **[STANDARD]** Show the element's bounding box (x, y, w, h) regardless of element type
- **[STANDARD]** Show full transform chain including inherited transforms from parent groups
- **[STANDARD]** Show the local coordinate system origin after transforms are applied
- **[QOL]** Show both the SVG attribute values and the computed CSS property values side-by-side
- **[QOL]** One-click to jump to the element in the code view
- **[QOL]** One-click to jump to the element's referenced def (for `<use>` instances)

---

## 6. Shape Editing

### Primitives
- **[CORE]** `<rect>`: edit x, y, width, height, rx, ry (corner radius)
- **[CORE]** `<circle>`: edit cx, cy, r
- **[CORE]** `<ellipse>`: edit cx, cy, rx, ry
- **[CORE]** `<line>`: edit x1, y1, x2, y2
- **[CORE]** `<polyline>` / `<polygon>`: drag individual vertices, add vertices, delete vertices
- **[STANDARD]** For `<polygon>` and `<polyline>`, right-click a vertex to delete it
- **[STANDARD]** For `<polygon>` and `<polyline>`, click a segment edge to insert a new vertex
- **[QOL]** Smart shape detection — recognize when a polygon approximates a regular shape (equilateral triangle, square, regular hexagon) and offer a parametric editor (center, radius, rotation)
- **[QOL]** Convert any primitive to a `<path>` for full vertex control

### Shape Creation Tools
- **[CORE]** Rectangle tool with live size display while drawing
- **[CORE]** Circle/Ellipse tool
- **[CORE]** Line tool
- **[CORE]** Polygon/polyline tool (click to place vertices, double-click to end)
- **[STANDARD]** Regular polygon tool (set number of sides, radius, rotation)
- **[STANDARD]** Star tool (inner radius, outer radius, point count, rotation)
- **[QOL]** Spiral tool
- **[QOL]** Grid/array tool (create a rectangular or radial distribution of shapes)

---

## 7. Path Editing

### Node Editing
- **[CORE]** Parse and display all path commands: `M`, `L`, `H`, `V`, `C`, `S`, `Q`, `T`, `A`, `Z` (and lowercase relative versions)
- **[CORE]** Show each anchor point as a draggable handle
- **[CORE]** Show bezier control handles on selected cubic (`C`, `S`) and quadratic (`Q`, `T`) nodes
- **[CORE]** Dragging a control handle updates the path in real time
- **[CORE]** Distinguish node types visually: corner node (cusp), smooth node (symmetric handles), symmetric node, auto-smooth node
- **[CORE]** Double-click a segment to add a new node
- **[CORE]** Select a node and press Delete to remove it (with segment healing)
- **[STANDARD]** Convert node type: corner ↔ smooth ↔ symmetric
- **[STANDARD]** Break handles apart (make asymmetric) or join them (make symmetric) with a modifier key
- **[STANDARD]** Select multiple nodes and move them together
- **[STANDARD]** Rubber-band node selection
- **[STANDARD]** Tab to cycle through nodes within a path
- **[QOL]** Show path direction with an arrow overlay (important for `fill-rule` and clip operations)
- **[QOL]** Reverse path direction
- **[QOL]** Normalize path — convert all commands to absolute, expand shorthand (`S`→`C`, `T`→`Q`)
- **[QOL]** Simplify path — reduce node count while preserving visual shape within a tolerance
- **[QOL]** Add nodes to all segments (equidistant)
- **[QOL]** Extend/retract path end by a specified length

### Arc Editing (`A` command)
- **[CORE]** Edit arc parameters: `rx`, `ry`, `x-rotation`, `large-arc-flag`, `sweep-flag`, end point
- **[STANDARD]** Visual handles for arc radius adjustment
- **[STANDARD]** Toggle `large-arc` and `sweep` flags with on-canvas controls
- **[QOL]** Recognize the "near-full-circle arc trick" (endpoint offset by ~0.1) and offer a true circle conversion

### Boolean Operations
- **[STANDARD]** Union — merge two shapes into one path
- **[STANDARD]** Subtract — cut one shape out of another
- **[STANDARD]** Intersect — keep only the overlapping region
- **[STANDARD]** Exclude (XOR) — keep non-overlapping regions only
- **[STANDARD]** Divide — split shapes at intersection points
- **[QOL]** Crop — trim paths to the bounds of a shape
- **[QOL]** Outline stroke — convert a stroked path to a filled shape

### Path Drawing
- **[CORE]** Pen tool: click to place corner nodes, click-drag to place smooth bezier nodes
- **[CORE]** Close a path with click on start node or keyboard shortcut
- **[STANDARD]** Pencil/freehand tool with auto-smoothing
- **[STANDARD]** Continue/extend an existing open path
- **[STANDARD]** Join two open paths (endpoint to endpoint)
- **[QOL]** Knife tool — slice a path along a drawn line
- **[QOL]** Scissors tool — break a path at a clicked node

---

## 8. Text Editing

### Basic Text
- **[CORE]** Create `<text>` elements with a click-to-place or click-drag workflow
- **[CORE]** Edit text content inline on the canvas
- **[CORE]** Edit x, y position
- **[CORE]** Edit `font-family`, `font-size`, `font-weight`, `font-style`, `text-anchor`, `dominant-baseline`
- **[CORE]** Edit `fill` (text color) and `stroke`
- **[STANDARD]** Multi-line text using `<tspan>` elements or `white-space: pre`
- **[STANDARD]** Font picker with web-safe fonts, system fonts, and optionally Google Fonts
- **[STANDARD]** Text alignment: left, center, right (mapped to `text-anchor`)

### Advanced Text
- **[STANDARD]** `<textPath>` support — flow text along any path
- **[STANDARD]** Edit `letter-spacing`, `word-spacing`, `text-decoration`
- **[STANDARD]** `<tspan>` editor — independently style runs of characters within a text block
- **[STANDARD]** Convert text to path (irreversible, but allows full node editing)
- **[QOL]** Vertical text support (`writing-mode: vertical-rl`)
- **[QOL]** Live text preview with actual font rendering (not placeholder rectangles)
- **[QOL]** Embed a font as a `<style>` + `@font-face` in the SVG for portability
- **[QOL]** Kerning controls

---

## 9. Transforms

### Transform Editor
- **[CORE]** Edit translate (x, y) with numeric fields
- **[CORE]** Edit scale (x, y) with optional proportion lock
- **[CORE]** Edit rotate (angle, and optionally origin cx/cy)
- **[CORE]** Edit skewX and skewY
- **[CORE]** Show the full composed transform matrix (`matrix(a b c d e f)`)
- **[STANDARD]** Apply transforms relative to element center, bounding box corner, or arbitrary point
- **[STANDARD]** Set a custom transform origin interactively on the canvas
- **[STANDARD]** Show cumulative / world-space transform (the composed matrix of all parent transforms + this element's own)
- **[STANDARD]** Decompose a `matrix()` transform back into translate/rotate/scale/skew for human-readable editing
- **[QOL]** Apply transform — bake the transform into the element's coordinates and reset the transform attribute to identity (destructive but useful for cleanup)
- **[QOL]** Flatten transform stack — collapse nested group transforms into a single element-level transform
- **[QOL]** Distribute transforms (apply the same transform to multiple selected elements simultaneously vs. wrapping them in a group)

### On-Canvas Transform Tools
- **[CORE]** Move tool (arrow) — drag selected elements
- **[CORE]** Rotate by dragging the rotation handle
- **[STANDARD]** Free transform mode — move, scale, and rotate in one mode with modifier keys
- **[STANDARD]** Rotate by typing an exact angle in a status bar field while the rotation handle is active
- **[QOL]** Rotate/scale around a remote point (click elsewhere to set pivot, then rotate)
- **[QOL]** Repeat last transform (apply same delta again)
- **[QOL]** Transform again to N copies

---

## 10. Fill & Stroke

### Fill Editor
- **[CORE]** Set fill to: none, solid color, linear gradient, radial gradient, pattern
- **[CORE]** Color picker with hex input, RGB sliders, HSL sliders, opacity slider
- **[CORE]** Eyedropper tool to sample any color on the canvas
- **[STANDARD]** Swatch library (document swatches, global palette, recent colors)
- **[STANDARD]** `currentColor` option
- **[QOL]** HSB/HSV mode in color picker
- **[QOL]** OKLCH / LCH color space picker
- **[QOL]** Named color input (CSS named colors)
- **[QOL]** Hex-8 (RRGGBBAA) support

### Stroke Editor
- **[CORE]** Set stroke paint (same options as fill)
- **[CORE]** Set stroke-width with unit display
- **[CORE]** Set stroke-linecap: `butt`, `round`, `square`
- **[CORE]** Set stroke-linejoin: `miter`, `round`, `bevel`
- **[CORE]** Set stroke-miterlimit
- **[CORE]** Set stroke-dasharray: add/remove/reorder dash and gap values, live preview
- **[CORE]** Set stroke-dashoffset with a slider and numeric field
- **[STANDARD]** Dasharray preset library (dotted, dashed, dot-dash, etc.)
- **[STANDARD]** "Align stroke to inside/center/outside" (SVG only supports center, but inside/outside can be emulated with clip-path)
- **[QOL]** Visual dasharray editor — draw the dash pattern interactively as a bar
- **[QOL]** Stroke width input in multiple units (px, pt, % of viewBox)

---

## 11. Gradients

### Gradient Editor
- **[CORE]** Edit stops: add, delete, move stop positions (0%–100%)
- **[CORE]** Edit stop color and stop opacity independently
- **[CORE]** Edit linear gradient endpoints (x1, y1, x2, y2) with on-canvas handles
- **[CORE]** Edit radial gradient center (cx, cy), focal point (fx, fy), and radius (r) with on-canvas handles
- **[CORE]** Choose `gradientUnits`: `userSpaceOnUse` vs `objectBoundingBox`
- **[STANDARD]** `gradientTransform` — rotate, scale, or skew the gradient independently of the shape
- **[STANDARD]** `spreadMethod`: pad, reflect, repeat — with live preview
- **[STANDARD]** Gradient swatch library — save and reuse gradients across elements
- **[STANDARD]** Apply a gradient from the defs panel to any selected element with one click
- **[QOL]** On-canvas gradient editor handles visible directly on the shape (not just in a side panel)
- **[QOL]** Gradient reverse button
- **[QOL]** Gradient presets library
- **[QOL]** Mesh gradient support (SVG 2.0)
- **[QOL]** "Make gradient from colors" — select two solid-colored elements and create a gradient blending them

---

## 12. Filters & Effects

### Filter Pipeline
- **[CORE]** Render all standard SVG filter primitives correctly (see Rendering Fidelity section)
- **[CORE]** Show the filter `x`, `y`, `width`, `height` region and warn when it clips the effect
- **[STANDARD]** Node graph UI for building/editing filter pipelines — primitives as nodes, connections as wires between `result`/`in` attributes
- **[STANDARD]** Edit each primitive's parameters in a properties panel
- **[STANDARD]** Preview the filter effect live as parameters change
- **[STANDARD]** Preset library: drop shadow, glow, blur, emboss, noise, duotone, etc.
- **[STANDARD]** Apply/remove a filter from any element with one click
- **[QOL]** Filter region auto-expand — automatically compute the minimum filter region required to avoid clipping the effect
- **[QOL]** Duplicate a filter from defs to create a variant
- **[QOL]** Compare before/after filter effect with a toggle
- **[QOL]** "Convert filter to CSS" — generate an equivalent `filter:` CSS property where possible

### Blend Modes
- **[STANDARD]** Set `mix-blend-mode` on elements and groups (normal, multiply, screen, overlay, etc.)
- **[STANDARD]** Set `feBlend` mode in a filter pipeline
- **[QOL]** Live preview of blend mode over the elements beneath

---

## 13. Clipping & Masking

### Clip Paths
- **[CORE]** Apply a `clipPath` to any element: define the clip shape, assign the `clip-path` attribute
- **[CORE]** Edit the clip shape (it lives in `<defs>` and can be any SVG shape or path)
- **[STANDARD]** Visualize the clip region as an overlay (e.g. dimmed area that will be cut)
- **[STANDARD]** `clipPathUnits`: `userSpaceOnUse` vs `objectBoundingBox`
- **[STANDARD]** Release clip path — remove the clip and restore the full element
- **[QOL]** "Clip to shape" workflow: select a shape and the element to clip, run command
- **[QOL]** Inverse clip (clip to everything *outside* a shape)

### Masks
- **[CORE]** Apply a `<mask>` to any element — define mask content (white = visible, black = invisible)
- **[CORE]** Edit the mask content
- **[STANDARD]** Luminance mask vs. alpha mask (`mask-type` / `color-interpolation-filters`)
- **[STANDARD]** Visualize the mask as a grayscale overlay
- **[QOL]** Convert a clip-path to a mask and vice versa
- **[QOL]** Release mask and flatten to alpha channel

---

## 14. Groups & Nesting

### Group Management
- **[CORE]** Group selected elements (wraps in `<g>`)
- **[CORE]** Ungroup (moves children to parent level, removes `<g>`)
- **[CORE]** Enter a group for direct child editing (double-click group to enter, Escape to exit)
- **[CORE]** Show the current editing context (breadcrumb: document > group > subgroup)
- **[STANDARD]** Group attributes — edit `id`, `class`, `opacity`, `filter`, `transform` on the group itself
- **[STANDARD]** Flatten nested groups (collapse all nesting into one level)
- **[QOL]** Named groups — assign a label that appears in the layers panel
- **[QOL]** Group isolation mode — temporarily dim elements outside the active group

---

## 15. Symbols & Use Instances

### Symbol Management
- **[CORE]** Parse `<symbol>` elements and display them in the defs/symbols panel
- **[CORE]** Render `<use href="#id">` instances correctly, including transforms applied to the `<use>` element
- **[CORE]** Show that a `<use>` instance is a reference, not a raw shape — prevent direct node editing
- **[CORE]** Allow editing the transform, fill, stroke overrides on a `<use>` instance independently
- **[STANDARD]** "Edit Symbol" action — jump to the def, edit it, and have all instances update live
- **[STANDARD]** Convert a `<use>` to a local copy (unlink from symbol/def) for independent editing
- **[STANDARD]** Show usage count per symbol in the panel
- **[STANDARD]** Drag a symbol from the panel onto the canvas to create a new instance
- **[QOL]** Symbol library panel (document symbols + external symbol libraries)
- **[QOL]** Override fill/stroke/opacity on individual `<use>` instances via `color` + `currentColor`
- **[QOL]** Batch transform — update the transform on all instances of a symbol at once
- **[QOL]** Shadow DOM inspection (the rendered content of a `<use>` instance lives in a shadow tree)

---

## 16. Markers & Arrowheads

- **[CORE]** Apply `marker-start`, `marker-mid`, `marker-end` to stroked paths and lines
- **[CORE]** Edit marker geometry, `markerWidth`, `markerHeight`, `refX`, `refY`, `orient`
- **[STANDARD]** Preset marker library: arrowheads (filled, open, half), dots, squares, crosses
- **[STANDARD]** `markerUnits`: `strokeWidth` vs `userSpaceOnUse`
- **[STANDARD]** `orient="auto"` vs a fixed angle — with a toggle
- **[QOL]** Preview markers on the path in real-time as parameters are adjusted
- **[QOL]** Apply the same marker to multiple selected paths at once
- **[QOL]** Sync marker fill/stroke to the parent path's paint automatically

---

## 17. Patterns

- **[CORE]** Create `<pattern>` elements with an arbitrary SVG tile
- **[CORE]** Edit `patternUnits` and `patternContentUnits`
- **[CORE]** Edit tile width, height, x, y offset
- **[STANDARD]** On-canvas pattern origin dragging
- **[STANDARD]** `patternTransform` — rotate, scale, skew the repeating tile
- **[STANDARD]** Pattern preview directly on the filled shape
- **[QOL]** Pattern tile editor — double-click the fill to enter a tile editing mode
- **[QOL]** Preset pattern library (hatch, crosshatch, dots, checker, etc.)

---

## 18. Animations (SMIL & CSS)

### SMIL Animations
- **[STANDARD]** Parse and display `<animate>`, `<animateTransform>`, `<animateMotion>`, `<set>` elements
- **[STANDARD]** Timeline panel showing all animations, their duration, begin, and end
- **[STANDARD]** Scrubable playhead on the timeline
- **[STANDARD]** Play/pause/stop controls
- **[STANDARD]** Edit `attributeName`, `from`, `to`, `by`, `values`, `dur`, `repeatCount`, `begin`, `fill`
- **[QOL]** Easing editor: `calcMode="spline"` with visual bezier curve editor for `keySplines`
- **[QOL]** Onion skinning — show ghost frames at key positions
- **[QOL]** Keyframe drag on the timeline

### CSS Animations
- **[STANDARD]** Parse and display `<style>` blocks within the SVG
- **[STANDARD]** Edit CSS `@keyframes` with a timeline
- **[STANDARD]** Apply CSS classes to elements
- **[QOL]** Generate CSS animation code from SMIL definitions (for environments that disable SMIL)
- **[QOL]** Live CSS editor with syntax highlighting

---

## 19. Coordinate System Tools

### Grid
- **[CORE]** Toggleable grid overlay in SVG user units
- **[STANDARD]** Set grid spacing (x and y independently)
- **[STANDARD]** Set grid origin
- **[STANDARD]** Sub-grid (secondary finer grid)
- **[QOL]** Isometric grid
- **[QOL]** Radial/polar grid (for centered designs like the target SVG)
- **[QOL]** Custom grid color and opacity

### Guides
- **[CORE]** Drag guides from ruler onto canvas
- **[CORE]** Move and delete guides
- **[STANDARD]** Set guide position numerically
- **[STANDARD]** Lock guides
- **[STANDARD]** Clear all guides
- **[QOL]** Smart guides — dynamic guides that appear when elements align during a move
- **[QOL]** Diagonal guides at arbitrary angles
- **[QOL]** Guide groups (save and restore a set of guides)

### Rulers
- **[CORE]** Horizontal and vertical rulers in SVG user units
- **[STANDARD]** Unit selector on the ruler (px, mm, cm, in, pt)
- **[QOL]** Click ruler to place a guide
- **[QOL]** Ruler subdivisions scale with zoom level

---

## 20. Snapping & Alignment

### Snapping
- **[CORE]** Snap to grid
- **[CORE]** Snap to guides
- **[CORE]** Snap to other elements: bounding boxes, edges, center points, anchor nodes
- **[STANDARD]** Snap to path nodes
- **[STANDARD]** Snap to midpoints of segments
- **[STANDARD]** Snap to page edges and center
- **[STANDARD]** Snap indicator (visual feedback line/dot when snapping activates)
- **[STANDARD]** Snap tolerance setting (how close before snapping activates, in screen pixels)
- **[QOL]** Snap to intersection of two paths
- **[QOL]** Angle snapping during rotation (e.g., snap every 15°, 45°)
- **[QOL]** Per-element snap exclusion

### Alignment & Distribution
- **[CORE]** Align left, center, right edges horizontally
- **[CORE]** Align top, middle, bottom edges vertically
- **[STANDARD]** Distribute spacing evenly: horizontal and vertical
- **[STANDARD]** Align/distribute relative to: selection bounding box, first selected, last selected, page
- **[QOL]** Align to a specific key object (pin one element, align others to it)
- **[QOL]** Make same size: width, height, or both
- **[QOL]** Remove overlap — push elements apart until they no longer intersect

---

## 21. Code View & Direct Editing

### Code Panel
- **[CORE]** Show the full SVG source with syntax highlighting
- **[CORE]** Bidirectional sync — edits in code view immediately reflect on canvas, canvas edits update code
- **[CORE]** Line numbers
- **[STANDARD]** Fold/collapse `<defs>`, `<g>` blocks, and individual multi-line elements
- **[STANDARD]** XML auto-formatting / prettify
- **[STANDARD]** Find and replace within the code view
- **[STANDARD]** Inline validation — red underlines on invalid attribute values or unknown elements
- **[QOL]** Attribute autocomplete (suggest valid SVG attributes and values as you type)
- **[QOL]** Jump-to-element: click a layer or element on canvas to jump to its line in the code
- **[QOL]** XML breadcrumbs showing the current cursor position in the document tree
- **[QOL]** Diff view — show what changed since the last save or last clipboard copy
- **[QOL]** Code minimap (like VS Code's minimap)

### Attribute Panel
- **[CORE]** List all attributes on the selected element as editable key-value rows
- **[CORE]** Add arbitrary attributes (not just the ones the UI exposes)
- **[CORE]** Delete attributes
- **[STANDARD]** Warn on deprecated attributes (e.g. `xlink:href` vs `href`)
- **[STANDARD]** Show presentation attributes alongside their CSS property equivalent
- **[QOL]** Attribute value history — drop-down of recently used values for a given attribute

---

## 22. Import & Export

### Import
- **[CORE]** Open and parse `.svg` files from disk
- **[CORE]** Paste SVG source code directly into the editor (from clipboard)
- **[STANDARD]** Import raster images (`<image>` element) with base64 embedding or external href
- **[STANDARD]** Drag-and-drop file onto canvas
- **[STANDARD]** Import from URL (fetch external SVG)
- **[QOL]** Import from Figma / Illustrator clipboard format
- **[QOL]** Auto-cleanup on import (remove invisible/empty elements, merge redundant groups, strip tool-specific metadata)

### Export — SVG
- **[CORE]** Export clean SVG source to clipboard or file
- **[STANDARD]** Minify option (remove whitespace, shorten IDs, merge styles)
- **[STANDARD]** Pretty-print option (formatted for readability)
- **[STANDARD]** Strip editor metadata (Inkscape/Illustrator namespaces, etc.) on export
- **[STANDARD]** Inline all `url()` references as data URIs (self-contained file)
- **[QOL]** Optimize with SVGO settings panel (toggle individual optimizations)
- **[QOL]** Export only selected elements
- **[QOL]** Export each top-level group as a separate SVG file

### Export — Raster
- **[STANDARD]** Export to PNG at any resolution (specify output width/height or scale factor)
- **[STANDARD]** Export to JPEG with quality setting
- **[QOL]** Export to WebP
- **[QOL]** Export frames of an animation as a PNG sequence
- **[QOL]** Batch export (multiple sizes, multiple formats in one operation)

### Export — Other Formats
- **[QOL]** Export to PDF (preserve vectors)
- **[QOL]** Copy as CSS `background-image: url("data:image/svg+xml,...")` encoded string
- **[QOL]** Copy as React JSX (`<svg>` with camelCase attributes)
- **[QOL]** Copy as Vue template snippet
- **[QOL]** Copy as base64 data URI

---

## 23. History & Version Control

### Undo/Redo
- **[CORE]** Unlimited undo with Ctrl/Cmd+Z
- **[CORE]** Undo history panel — list of named operations (e.g. "Move circle", "Change fill color")
- **[STANDARD]** Jump to any point in history by clicking the history panel
- **[STANDARD]** Undo history persists across code-view and canvas-view edits as a unified stack
- **[QOL]** Branch history (non-linear undo tree, like Vim's undotree)
- **[QOL]** Named history snapshots (manual checkpoints)

### Saving
- **[CORE]** Auto-save to local storage or file system at regular intervals
- **[STANDARD]** Manual save to file with Ctrl/Cmd+S
- **[STANDARD]** Save a copy under a new name
- **[QOL]** Version history — timestamped snapshots of the file over time
- **[QOL]** Git integration — commit current state with a message

---

## 24. Accessibility & Metadata

### SVG Accessibility
- **[STANDARD]** Add/edit `<title>` and `<desc>` elements for screen reader support
- **[STANDARD]** Add `role`, `aria-label`, `aria-labelledby` attributes
- **[STANDARD]** Set `focusable` attribute on interactive elements
- **[QOL]** Accessibility audit panel — flag elements missing `<title>`, decorative elements lacking `aria-hidden`, etc.

### Document Metadata
- **[STANDARD]** Edit `xmlns` declarations
- **[STANDARD]** Add/edit `<metadata>` block (Dublin Core, RDF, etc.)
- **[QOL]** Author, title, description fields that write to `<metadata>` automatically

---

## 25. Performance & Large File Handling

- **[CORE]** Handle SVG files with thousands of elements without freezing
- **[STANDARD]** Virtualize the layers panel (don't render all rows in the DOM for large trees)
- **[STANDARD]** Progressive rendering — show partially loaded/parsed SVGs while the rest loads
- **[STANDARD]** Lazy filter rendering — debounce expensive filter recomputation while parameters are being dragged
- **[QOL]** Level-of-detail rendering — simplify complex paths at low zoom levels
- **[QOL]** Worker-offloaded parsing — parse large SVG files on a Web Worker, not the main thread
- **[QOL]** Memory usage indicator for very large embedded image data
- **[QOL]** Simplify for editing mode — temporarily render only a bounding box for off-screen elements

---

## 26. Collaboration

- **[QOL]** Real-time multiplayer editing (multiple cursors, live element highlighting)
- **[QOL]** Comment annotations attached to elements or canvas positions
- **[QOL]** Presence indicators showing who is currently viewing/editing which element
- **[QOL]** Share a read-only view link
- **[QOL]** Review mode — accept/reject changes made by collaborators

---

## 27. Extensibility & Scripting

- **[QOL]** Plugin / extension API for adding custom tools, panels, or export formats
- **[QOL]** Macro recorder — record a sequence of actions and replay them on other elements
- **[QOL]** Script console — run JavaScript that manipulates the SVG DOM live
- **[QOL]** Custom keyboard shortcut binding
- **[QOL]** Template library — start new documents from community or personal templates

---

## 28. Mobile & Touch Support

- **[CORE]** Touch-friendly tap targets (minimum 44×44pt) for all UI controls
- **[CORE]** Pinch-to-zoom on the canvas
- **[CORE]** Two-finger pan
- **[STANDARD]** Context menu on long-press (element properties, layer actions)
- **[STANDARD]** Touch-drag for moving elements (with sufficient drag threshold to distinguish from tap)
- **[STANDARD]** On-screen keyboard does not obstruct the canvas when editing numeric fields
- **[QOL]** Stylus pressure mapped to stroke width or opacity
- **[QOL]** Palm rejection during stylus use
- **[QOL]** Compact panel layout for small screens (collapsible, drawer-style panels)
- **[QOL]** Haptic feedback on snap events

---

*This document was authored as a reference for SVG editor implementers. The SVG used to derive the initial feature surface is a centered-viewBox occult sigil design making use of radial gradients, linear gradients, feGaussianBlur filters, `<defs>`-based reuse, `<use>` instancing, multi-value stroke-dasharray, polygon vertex geometry, quadratic bezier paths, near-full-circle arc tricks, and deeply layered groups.*

---

## 29. Keyboard Shortcuts & Input Model

### Core Navigation & Editing
- **[CORE]** Standard shortcuts: undo, redo, cut, copy, paste, duplicate, delete, select all
- **[CORE]** Arrow-key nudging with configurable step size
- **[CORE]** Modified nudging: Shift for large step, Alt/Option for fine step
- **[STANDARD]** Tool hotkeys for move, pen, node edit, text, shape tools, zoom, hand tool
- **[STANDARD]** Temporary tool switching while holding a modifier (for example Space = pan)
- **[STANDARD]** Escape cancels in-progress edits, drawing, text entry, or drag operations
- **[QOL]** Fully rebindable keyboard shortcuts
- **[QOL]** Command palette for searchable actions
- **[QOL]** Keyboard shortcut cheatsheet overlay

### Precision Entry
- **[CORE]** Numeric entry fields support math expressions (`100/2`, `24*3`, `45+10`)
- **[STANDARD]** Relative numeric edits (`+10`, `-5`, `*2`) for transform and style fields
- **[STANDARD]** Increment/decrement steppers on numeric controls
- **[QOL]** Scrubbable numeric labels (drag left/right on a field label to change values)
- **[QOL]** Per-field unit memory and conversion on commit

---

## 30. Validation, Repair & Diagnostics

### SVG Validation
- **[CORE]** Detect malformed XML and surface a clear parse error with line/column information
- **[CORE]** Detect broken references (`url(#missing)`, `href="#missing"`) and flag them in the UI
- **[STANDARD]** Warn on unsupported or partially supported features in the current editor build
- **[STANDARD]** Detect duplicate IDs, invalid attribute values, and invalid unit strings
- **[STANDARD]** Validate filter regions, mask extents, and gradient references
- **[QOL]** Validation panel with severity levels: error, warning, info
- **[QOL]** One-click repair actions for common issues

### Repair & Cleanup
- **[STANDARD]** Normalize namespace usage (`href` vs `xlink:href`) on request
- **[STANDARD]** Remove empty groups, empty paths, zero-sized shapes, and unused definitions
- **[STANDARD]** Merge adjacent compatible paths or groups where safe
- **[QOL]** "Repair imported file" action for tool-generated SVGs with messy metadata
- **[QOL]** "Explain why this looks wrong" diagnostics for clipping, transform, filter-region, and inheritance issues

---

## 31. Asset Embedding & External References

### Images, Fonts, and Linked Assets
- **[CORE]** Display whether an asset is embedded (`data:` URI) or externally linked
- **[CORE]** Relink broken external image references
- **[STANDARD]** Convert linked raster images to embedded data URIs
- **[STANDARD]** Show image intrinsic size, aspect ratio, and decoded memory footprint
- **[STANDARD]** Preserve or rewrite relative asset paths on export
- **[QOL]** Asset manager panel listing all external dependencies in the document
- **[QOL]** Bulk embed all linked assets into a self-contained SVG
- **[QOL]** Bulk extract embedded assets out to files and rewrite references

---

## 32. Implementation Readiness Checklist

A truly finished SVG editor should not merely *expose controls*. It should satisfy the following high-level acceptance criteria.

### Functional Readiness
- **[CORE]** Any valid SVG opened in the editor remains visually faithful unless the user intentionally changes it
- **[CORE]** Canvas edits, inspector edits, and code edits remain synchronized without desync or silent corruption
- **[CORE]** Save → reopen round-trips without losing structure, IDs, references, or styling
- **[CORE]** Imported defs, gradients, filters, markers, masks, clip paths, and symbols remain intact and editable
- **[STANDARD]** Most user-visible features are discoverable without reading documentation
- **[STANDARD]** Large files remain operable enough to inspect, select, and save without lockups

### UX Readiness
- **[CORE]** Selection feedback is always clear
- **[CORE]** Active editing context is always visible
- **[STANDARD]** Errors are actionable rather than cryptic
- **[STANDARD]** Precision workflows are possible without fighting the UI
- **[QOL]** Expert workflows are faster than raw code editing for common operations

### Technical Readiness
- **[CORE]** Internal document model preserves source-order, references, namespaces, and unknown attributes
- **[CORE]** Undo/redo is transaction-based and reliable across all edit surfaces
- **[STANDARD]** Expensive operations are isolated, debounced, or offloaded where possible
- **[STANDARD]** The renderer and editor share a consistent geometry model for bounds, transforms, snapping, and hit testing
- **[QOL]** Feature flags allow advanced systems to land incrementally without destabilizing the core editor

---

## 33. Recommended Build Order

This document is a full requirements map, not a minimal slice. Still, there is a sane order for implementation so the editor grows like a cathedral instead of a junk drawer.

### Phase 1 — Foundation
- Document parser and serializer
- Shared SVG scene graph / model layer
- Canvas viewport, zoom, pan, selection, bounding boxes
- Layers panel, attributes inspector, history stack
- Primitive shape creation and editing
- Fill, stroke, transforms, snapping basics
- Code view with round-trip sync

### Phase 2 — Real Editing Power
- Full path editor
- Text editor
- Defs panel and ID/reference management
- Gradients, patterns, markers
- Group editing, symbols, `<use>` workflows
- Import/export cleanup and validation tools

### Phase 3 — Advanced Visual Systems
- Filters node graph
- Clip paths and masks
- Animation timeline
- Better alignment/distribution tools
- Asset manager and external reference controls

### Phase 4 — Scale, Polish, and Reach
- Performance systems for huge files
- Mobile/touch ergonomics
- Accessibility and metadata tooling
- Collaboration hooks
- Plugin/macro/script systems
- High-end diagnostics and repair tools

---

## Final Note

A powerful SVG editor is not just a shape editor with an XML textbox bolted to the side. It is three systems fused together:

1. a **faithful SVG renderer**,
2. a **structured scene editor**, and
3. a **live source-code environment**.

If any one of those three is weak, the whole product feels brittle. If all three are strong, the editor stops feeling like a toy and starts feeling like infrastructure.
