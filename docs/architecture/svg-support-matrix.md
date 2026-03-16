# SVG Feature Support Matrix

**Phase 0 deliverable.** This document defines the support tier for each SVG element, attribute category, filter primitive, and CSS feature. It drives editability level assignment at import time.

Support tiers:
- **Full** — Fully editable in visual mode and inspector. Round-trip safe.
- **Partial** — Mostly editable; some properties or behaviors may not survive round-trip without minor loss.
- **Preserved-raw** — Recognized but not visually editable. Stored as raw XML. Source mode only.
- **Out-of-scope** — Not rendered or editable; preserved verbatim in the serialized output.

---

## Structural and Container Elements

| Element | Support | Notes |
|---|---|---|
| `<svg>` | Full | viewBox, width, height, preserveAspectRatio all editable |
| `<g>` | Full | transform, presentation attributes, nested groups |
| `<defs>` | Full (structural) | Children edited via resource editors; order preserved on export |
| `<symbol>` | Partial | viewBox and presentation editable; instance rendering via Phase 11 |
| `<use>` | Partial | href/xlink:href, x, y, width, height; full workflow via Phase 11 |
| `<a>` | Preserved-raw | href preserved; click behavior not implemented |
| `<switch>` | Preserved-raw | Children preserved verbatim; no requiredFeatures evaluation |
| `<foreignObject>` | Preserved-raw | Content preserved as raw XML; not rendered |

---

## Shape Elements

| Element | Support | Notes |
|---|---|---|
| `<rect>` | Full | x, y, width, height, rx, ry, presentation attributes |
| `<circle>` | Full | cx, cy, r, presentation attributes |
| `<ellipse>` | Full | cx, cy, rx, ry, presentation attributes |
| `<line>` | Full | x1, y1, x2, y2, presentation attributes |
| `<polyline>` | Full | points, presentation attributes |
| `<polygon>` | Full | points, presentation attributes |
| `<path>` | Full | d (all path commands), presentation attributes; anchor editing via Phase 14 |

---

## Text Elements

| Element | Support | Notes |
|---|---|---|
| `<text>` | Partial | x, y, font properties, basic tspan children; full support via Phase 13 |
| `<tspan>` | Partial | x, y, dx, dy, baseline-shift; full support via Phase 13 |
| `<textPath>` | Preserved-raw | href preserved; rendering best-effort; full support via Phase 13 |

---

## Image and Embedded Content

| Element | Support | Notes |
|---|---|---|
| `<image>` | Partial | href/xlink:href, x, y, width, height, preserveAspectRatio; embedded data URIs preserved |

---

## Resource / Defs Elements

| Element | Support | Notes |
|---|---|---|
| `<linearGradient>` | Full | All stop and gradient attributes; editor via Phase 10 |
| `<radialGradient>` | Full | All stop and gradient attributes; editor via Phase 10 |
| `<pattern>` | Partial | Basic attributes preserved; full editor via Phase 10 |
| `<clipPath>` | Partial | clipPathUnits, children; full editor via Phase 12 |
| `<mask>` | Partial | maskUnits, maskContentUnits, children; full editor via Phase 12 |
| `<marker>` | Partial | markerWidth, markerHeight, orient, children; full editor via Phase 12 |
| `<filter>` | Partial | x, y, width, height preserved; primitive support varies (see below) |
| `<style>` | Partial | Preserved verbatim; parsed for cascade; editor via Phase 15 |
| `<stop>` | Full | offset, stop-color, stop-opacity |

---

## Filter Primitives

| Primitive | Support | Notes |
|---|---|---|
| `feBlend` | Preserved-raw | Rendered natively by browser; not editable in inspector |
| `feColorMatrix` | Preserved-raw | Rendered natively; type and values preserved |
| `feComposite` | Preserved-raw | Rendered natively; attributes preserved |
| `feConvolveMatrix` | Preserved-raw | Rendered natively; attributes preserved |
| `feDiffuseLighting` | Preserved-raw | Rendered natively; children preserved |
| `feDisplacementMap` | Preserved-raw | Rendered natively; attributes preserved |
| `feDropShadow` | Preserved-raw | Rendered natively; attributes preserved |
| `feFlood` | Preserved-raw | Rendered natively; flood-color, flood-opacity preserved |
| `feGaussianBlur` | Partial | stdDeviation editable in inspector; other attributes preserved-raw |
| `feImage` | Preserved-raw | href preserved; rendered natively |
| `feMerge` | Preserved-raw | Children preserved verbatim |
| `feMorphology` | Preserved-raw | Rendered natively; attributes preserved |
| `feOffset` | Preserved-raw | dx, dy preserved; rendered natively |
| `feSpecularLighting` | Preserved-raw | Rendered natively; children preserved |
| `feTile` | Preserved-raw | Rendered natively; attributes preserved |
| `feTurbulence` | Preserved-raw | Rendered natively; type, baseFrequency, numOctaves preserved |

---

## Presentation Attributes (on all applicable elements)

| Attribute Group | Support | Notes |
|---|---|---|
| Fill: `fill`, `fill-opacity`, `fill-rule` | Full | Color picker and opacity slider in inspector |
| Stroke: `stroke`, `stroke-width`, `stroke-opacity`, `stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`, `stroke-dasharray`, `stroke-dashoffset` | Full | Full stroke panel in inspector |
| Transforms: `transform` | Full | Matrix, translate, scale, rotate, skew; decomposition editable |
| Opacity: `opacity` | Full | Slider in inspector |
| Visibility: `display`, `visibility` | Full | Toggle in layers panel and inspector |
| Color: `color`, `color-interpolation`, `color-rendering` | Partial | color editable; interpolation/rendering preserved |
| Font: `font-family`, `font-size`, `font-style`, `font-weight`, `font-variant`, `font-stretch`, `line-height`, `letter-spacing`, `word-spacing`, `text-decoration`, `text-anchor`, `dominant-baseline` | Partial | Basic font properties in inspector; full support via Phase 13 |
| Gradient/paint: `stop-color`, `stop-opacity` | Full | Via gradient editor |
| Clip/mask: `clip-path`, `mask` | Partial | Reference preserved; editor via Phase 12 |
| Filter: `filter` | Partial | Reference preserved; filter editor via Phase 10/16 |
| Marker: `marker-start`, `marker-mid`, `marker-end` | Partial | Reference preserved; marker editor via Phase 12 |
| Shape rendering: `shape-rendering`, `image-rendering`, `text-rendering` | Preserved-raw | Preserved on element; not editable in UI |
| Pointer: `pointer-events` | Preserved-raw | Preserved; not editable in inspector |
| Overflow: `overflow`, `clip` | Preserved-raw | Preserved; not editable in inspector |
| Cursor: `cursor` | Preserved-raw | Preserved verbatim |
| Accessibility: `aria-*`, `role`, `tabindex` | Preserved-raw | Preserved; inspectable via Phase 8 advanced panel |

---

## Animation Elements

| Element | Support | Notes |
|---|---|---|
| `<animate>` | Out-of-scope | Preserved verbatim; not rendered or editable |
| `<animateTransform>` | Out-of-scope | Preserved verbatim |
| `<animateMotion>` | Out-of-scope | Preserved verbatim |
| `<set>` | Out-of-scope | Preserved verbatim |
| `<mpath>` | Out-of-scope | Preserved verbatim |
| `<discard>` | Out-of-scope | Preserved verbatim |

---

## Metadata and Descriptive Elements

| Element | Support | Notes |
|---|---|---|
| `<title>` | Full | Editable in document metadata panel |
| `<desc>` | Full | Editable in document metadata panel |
| `<metadata>` | Preserved-raw | Preserved verbatim; not editable |

---

## CSS Features (within `<style>` blocks)

| Feature | Support | Notes |
|---|---|---|
| Element selectors (`rect`, `path`, etc.) | Partial | Parsed via `css-tree` (Phase 2+); applied at import for computed styles |
| Class selectors (`.foo`) | Partial | Preserved; class attributes tracked on elements |
| ID selectors (`#foo`) | Partial | Preserved; cross-referenced with ID registry |
| Attribute selectors (`[fill="red"]`) | Preserved-raw | Preserved in style block; not resolved to elements at import |
| Pseudo-class selectors (`:hover`, `:focus`) | Preserved-raw | Preserved; not evaluated in editor |
| Descendant/child combinators | Partial | Preserved; partial resolution during cascade computation |
| `@media` rules | Preserved-raw | Preserved verbatim; not evaluated |
| `@keyframes` | Preserved-raw | Preserved verbatim; not evaluated |
| CSS custom properties (`--var`) | Preserved-raw | Preserved; not resolved in inspector |
| `inherit`, `currentColor` | Partial | Resolved during cascade computation in Phase 15 |
| `!important` | Preserved-raw | Preserved in style block; flagged in diagnostics |

---

## SVG Namespaces

| Namespace | Support | Notes |
|---|---|---|
| `http://www.w3.org/2000/svg` (default SVG) | Full | Core SVG namespace |
| `http://www.w3.org/1999/xlink` | Full | `xlink:href` attributes preserved and resolved |
| `http://www.w3.org/XML/1998/namespace` | Full | `xml:space`, `xml:lang` preserved |
| `http://www.w3.org/1999/xhtml` | Preserved-raw | Content inside `<foreignObject>` preserved verbatim |
| `http://www.inkscape.org/namespaces/*` | Preserved-raw | Inkscape extension attributes preserved |
| `http://sodipodi.sourceforge.net/*` | Preserved-raw | Sodipodi attributes preserved |
| `http://www.adobe.com/*` | Preserved-raw | Illustrator extension attributes preserved |
| All other custom namespaces | Preserved-raw | Unknown namespace attributes preserved verbatim |

---

## Support Tier Assignment Logic

At import time, each node's editability level is computed as follows:

1. If the element is in the Full support tier and all its attributes are in the Full or Partial attribute groups → **Level 1 (Full)**
2. If the element is in the Full support tier but has Preserved-raw attributes → **Level 2 (Partial)**
3. If the element is in the Partial support tier → **Level 2 (Partial)**
4. If the element is in the Preserved-raw tier → **Level 3 (Preserved-raw)**
5. If the element is in the Out-of-scope tier → **Level 4 (Display-only)**
6. If the element is in an unknown namespace → **Level 3 (Preserved-raw)**

This level is stored in the node's `PreservationMeta` and used by all rendering, inspector, and serialization code.
