# SVG Editor — Mobile Workflow & Design Requirements

A complete answer to the question: *what does an SVG editor need to feel truly native, efficient, and powerful on a phone or tablet?*

This document is intentionally separate from the core feature requirements spec. The first spec defines *what the editor must be able to do*. This one defines *how those powers must be exposed on mobile* so the product is not merely desktop UI squeezed into a smaller box.

The philosophy throughout is mobile-first, thumb-first, interruption-tolerant, and density-aware. Features are marked as **[CORE]** (required for correctness or baseline usability), **[STANDARD]** (expected in a competent professional mobile editor), or **[QOL]** (quality of life / power-user).

---

## Table of Contents

1. [Mobile-First Product Principles](#1-mobile-first-product-principles)
2. [App Shell & Screen Architecture](#2-app-shell--screen-architecture)
3. [Canvas Interaction Model](#3-canvas-interaction-model)
4. [Touch Targets, Reachability & Ergonomics](#4-touch-targets-reachability--ergonomics)
5. [Tool Access & Tool Switching](#5-tool-access--tool-switching)
6. [Panels, Sheets & Inspector Design](#6-panels-sheets--inspector-design)
7. [Selection UX on Touch Devices](#7-selection-ux-on-touch-devices)
8. [Transform UX on Mobile](#8-transform-ux-on-mobile)
9. [Path Editing UX on Mobile](#9-path-editing-ux-on-mobile)
10. [Text Editing UX on Mobile](#10-text-editing-ux-on-mobile)
11. [Color, Stroke & Style Workflows](#11-color-stroke--style-workflows)
12. [Layers, Structure & Defs Navigation](#12-layers-structure--defs-navigation)
13. [Gestures & Input Grammar](#13-gestures--input-grammar)
14. [Precision Controls & Numeric Entry](#14-precision-controls--numeric-entry)
15. [View Management, Navigation & Orientation Changes](#15-view-management-navigation--orientation-changes)
16. [Files, Import, Export & Sharing](#16-files-import-export--sharing)
17. [Performance, Battery & Thermal Behavior](#17-performance-battery--thermal-behavior)
18. [Offline, Recovery & Session Continuity](#18-offline-recovery--session-continuity)
19. [Collaboration, Review & Commenting](#19-collaboration-review--commenting)
20. [Accessibility & Inclusive Mobile Design](#20-accessibility--inclusive-mobile-design)
21. [Adaptive Layouts: Phones, Foldables & Tablets](#21-adaptive-layouts-phones-foldables--tablets)
22. [Safe Interactivity, Preview & Runtime Modes](#22-safe-interactivity-preview--runtime-modes)
23. [Customization & Workspace Preferences](#23-customization--workspace-preferences)
24. [Onboarding, Discoverability & Learning UX](#24-onboarding-discoverability--learning-ux)
25. [Implementation Readiness Checklist](#25-implementation-readiness-checklist)
26. [Recommended Build Order](#26-recommended-build-order)

---

## 1. Mobile-First Product Principles

### Philosophy
- **[CORE]** Every primary editing task must be completable with touch only, without assuming keyboard or mouse availability
- **[CORE]** The app must be designed for one-handed and two-handed phone use, not desktop parity as the starting assumption
- **[CORE]** The UI must prioritize edit flow continuity: users should not constantly open, close, and hunt through deep menus to perform adjacent actions
- **[CORE]** The editor must respect interruption-heavy mobile use: app switching, calls, notifications, screen rotation, and memory pressure must not destroy work
- **[STANDARD]** The product should distinguish between “quick adjustment” flows and “deep editing” flows, giving each a dedicated interaction pattern
- **[STANDARD]** Editing density should scale with user confidence: simple by default, expandable into expert controls on demand
- **[QOL]** The interface should support progressive disclosure modes such as Beginner, Standard, and Pro workspace density presets
- **[QOL]** The app should provide a “thumb-distance audit” during design implementation to identify controls repeatedly placed in hard-to-reach screen zones

### Mobile Editing Goals
- **[CORE]** Common operations must require very few taps: select, move, resize, recolor, reorder, group, duplicate, hide, delete
- **[CORE]** High-frequency actions must remain visible or reachable within one gesture from the canvas
- **[STANDARD]** The product should optimize for burst workflows: open file, make a precise change, save/export, close
- **[STANDARD]** The product should also support long-form creation sessions without UI fatigue
- **[QOL]** The app should expose a measurable “tap cost” standard for key flows and use it during product QA

---

## 2. App Shell & Screen Architecture

### Overall Shell
- **[CORE]** The app shell must dedicate the majority of screen real estate to the canvas
- **[CORE]** Persistent chrome must be minimal and justified; avoid stacking permanent top bars, bottom bars, floating bars, and side bars simultaneously on small phones
- **[CORE]** The shell must keep navigation predictable: tool access, document actions, inspector access, history, and layers must always live in consistent places
- **[STANDARD]** The shell should separate into three conceptual zones: canvas, primary controls, contextual controls
- **[STANDARD]** The shell should support hidden, collapsed, and expanded states for UI regions rather than fixed visibility only
- **[QOL]** The shell may support alternate layouts for right-handed and left-handed users

### Top-Level Regions
- **[CORE]** A compact top bar for file/document status, undo/redo, and global actions
- **[CORE]** A bottom or side primary tool launcher reachable by thumb
- **[CORE]** A contextual bottom sheet or side inspector for selected object properties
- **[CORE]** Floating in-canvas handles for direct manipulation that do not require reaching out to the inspector for every change
- **[STANDARD]** Optional secondary floating controls for zoom, snapping, or selection filtering
- **[QOL]** User-configurable “clean canvas” mode that auto-hides most chrome until touched

### Navigation Between Major Modes
- **[CORE]** Clear distinction between Edit mode, Preview mode, Code mode, and Export mode
- **[CORE]** Mode switching must preserve state and return the user to the same selection and viewport when possible
- **[STANDARD]** Long-running tasks such as export or raster trace should not trap the user in modal dead ends
- **[QOL]** Split-view or quick-toggle transitions between visual edit and code/structure views on larger devices

---

## 3. Canvas Interaction Model

### Canvas Priority
- **[CORE]** The canvas must always feel like the center of the app rather than a passive preview squeezed between controls
- **[CORE]** Touch interactions on the canvas must resolve quickly and predictably with low latency
- **[CORE]** The canvas must visually communicate current mode: select, pan, draw, path edit, text edit, preview, etc.
- **[STANDARD]** Hover-dependent desktop patterns must be replaced with tap, hold, focus, or explicit toggles
- **[QOL]** Micro-animations should confirm state changes without delaying interaction

### Interaction Layers
- **[CORE]** The app must differentiate between gestures intended for viewport navigation and gestures intended for object editing
- **[CORE]** Users must have a reliable way to temporarily switch between “navigate canvas” and “edit object” behavior
- **[STANDARD]** Accidental mode collisions, such as panning when trying to select or resizing when trying to scroll, must be aggressively minimized
- **[QOL]** Optional temporary gesture lock button to freeze selection while navigating dense areas, or freeze navigation while editing tiny details

### Screen Occlusion Management
- **[CORE]** Fingers, thumbs, and the software keyboard must not permanently obscure the active object or handles without automatic mitigation
- **[CORE]** The viewport should auto-nudge or reframe when a control sheet or keyboard would cover the current edit target
- **[STANDARD]** Magnified loupe or offset-handle assistance should appear for fine operations near the finger
- **[QOL]** User-adjustable handle offset direction for left thumb, right thumb, or stylus workflows

---

## 4. Touch Targets, Reachability & Ergonomics

### Touch Targets
- **[CORE]** All tappable controls must meet a minimum mobile touch target size suitable for fingers rather than cursors
- **[CORE]** Tiny icons must have enlarged invisible hit areas even if the visible glyph is small
- **[STANDARD]** Dense toolbars should provide expanded tap zones and generous spacing near destructive actions
- **[QOL]** The app may dynamically enlarge high-error controls based on interaction analytics or repeated missed taps

### Reachability
- **[CORE]** Primary high-frequency controls must sit in easy-reach zones on common phone sizes
- **[CORE]** Dangerous or infrequent actions can live farther away, but core edit operations cannot be buried in top-corner menus only
- **[STANDARD]** The product should support a temporary reachability shift when the user is operating one-handed
- **[QOL]** Reach map overlay for internal QA to visualize which controls are comfortable on tall screens

### Ergonomic Stress Reduction
- **[CORE]** Avoid repetitive gesture chains that require constant stretching between opposite screen edges
- **[STANDARD]** Reduce needless confirmation taps for reversible actions
- **[STANDARD]** Use haptics selectively to reduce visual checking during repeated precise operations
- **[QOL]** Adjustable haptic strength profiles for subtle, medium, and strong tactile feedback

---

## 5. Tool Access & Tool Switching

### Primary Tool Access
- **[CORE]** Selection, pen/path, shape, text, hand/pan, eyedropper, and transform access must be immediately reachable
- **[CORE]** Tool icons and labels must be distinct enough to avoid visual ambiguity on small screens
- **[STANDARD]** Long-press on a tool should reveal sibling tools in the same family, such as rectangle/ellipse/polygon or pen/node/boolean
- **[STANDARD]** Recently used tools should be surfaced for rapid switching
- **[QOL]** Customizable quick tool strip for user-pinned tools

### Contextual Tooling
- **[CORE]** When an object is selected, the app must surface the most relevant actions first instead of a generic full inspector only
- **[CORE]** Contextual actions should include duplicate, reorder, transform, style, group, isolate, and delete where appropriate
- **[STANDARD]** Tool actions should adapt by selection type: path, text, group, gradient, image, symbol, defs reference, etc.
- **[QOL]** Contextual action ranking based on actual user habits

### Tool Switching Rules
- **[CORE]** Switching tools must not unexpectedly discard an active selection or pending edit unless the action is destructive and explicit
- **[STANDARD]** Temporary tool invocation, such as holding a gesture or touch modifier, should allow quick panning or color sampling without losing the main tool
- **[QOL]** Custom gesture aliases for switching between the user’s top three tools

---

## 6. Panels, Sheets & Inspector Design

### Panel Philosophy
- **[CORE]** Mobile UI must prefer bottom sheets, segmented inspectors, popovers, and collapsible drawers over permanently open desktop sidebars
- **[CORE]** Panels must have clear compact, half, and full states where appropriate
- **[CORE]** Users must be able to inspect details without fully losing sight of the canvas
- **[STANDARD]** Panels should remember their last expansion state per mode
- **[QOL]** Smooth elastic transitions between panel states to preserve spatial understanding

### Inspector Structure
- **[CORE]** The inspector must group controls by mental model rather than raw SVG attribute order: geometry, transform, style, structure, metadata, interactivity
- **[CORE]** The first visible controls in a contextual inspector should be the ones most likely needed immediately for the current selection
- **[STANDARD]** Accordion sections should be available, but critical controls must not be hidden too aggressively
- **[STANDARD]** Each inspector group should support compact summaries when collapsed, such as “Fill: gradient, Stroke: 3 px, Opacity: 72%”
- **[QOL]** Search within the inspector for attributes, especially in advanced mode

### Sheet Behavior
- **[CORE]** Dragging a sheet must feel physically obvious and responsive
- **[CORE]** Sheet gestures must not conflict with canvas gestures without a clear grab area or behavior boundary
- **[STANDARD]** Bottom sheets should support keyboard-aware resizing when text or numeric entry begins
- **[QOL]** Snap points should be customizable or context-dependent by selection type

---

## 7. Selection UX on Touch Devices

### Basic Selection
- **[CORE]** Single tap to select must work reliably on visible elements
- **[CORE]** Repeated tap on overlapping items must expose a clear disambiguation flow instead of random cycling only
- **[CORE]** Selected state must be visually obvious even on bright or complex artwork
- **[STANDARD]** Lasso, marquee, and tap-to-add multi-select flows must all be available in touch-friendly forms
- **[QOL]** Smart “select nearest likely target” heuristics may assist when elements are extremely dense, but should be overridable

### Overlap & Dense Artwork
- **[CORE]** In crowded areas, tap-and-hold should open a target picker or stack list of nearby elements
- **[CORE]** The target picker must show thumbnails, layer names, tag types, and lock/visibility indicators where possible
- **[STANDARD]** Users should be able to scrub through nearby candidates before committing selection
- **[QOL]** Local isolation mode from the target picker for editing a single item in a dense cluster

### Multi-Selection
- **[CORE]** Multi-select must be possible without a hardware keyboard
- **[CORE]** Common mobile patterns such as “Select mode” toggles, chip-based add/remove states, or drag-lasso must be supported
- **[STANDARD]** The app should display a selection summary badge when multiple items are selected
- **[STANDARD]** Batch actions for align, distribute, group, style, duplicate, delete, and reorder must appear contextually
- **[QOL]** Save current selection as a temporary named set for repeated editing during a session

---

## 8. Transform UX on Mobile

### Direct Manipulation
- **[CORE]** Move, scale, and rotate must be possible directly on canvas with visible handles
- **[CORE]** Handles must remain grabbable on high-density screens and at low zoom levels
- **[CORE]** Users must be able to distinguish move vs resize vs rotate without guesswork
- **[STANDARD]** Handles should expand or offset when the object is too small to edit comfortably
- **[QOL]** Alternate minimalist handle mode for uncluttered editing on larger tablets

### Transform Sheets
- **[CORE]** A transform sheet must expose numeric position, size, rotation, skew, and scale values
- **[CORE]** The sheet must support locking aspect ratio and editing transform origin
- **[STANDARD]** Quick chips for flip horizontal, flip vertical, rotate 90°, center on canvas, align to selection, and reset transform
- **[QOL]** Saved transform presets for repeated object types or icon systems

### Group and Nested Transform Awareness
- **[CORE]** Users must understand whether they are editing local transforms or inherited/group transforms
- **[STANDARD]** The UI should display transform context breadcrumbs when editing nested groups
- **[QOL]** One-tap conversion between “keep as transform matrix” and “bake into geometry” where valid

---

## 9. Path Editing UX on Mobile

### Node Editing
- **[CORE]** Nodes and bezier handles must be touch-editable without absurd zoom requirements
- **[CORE]** Selected nodes must be visually distinct from unselected nodes and segment handles
- **[CORE]** Users must be able to add, delete, and convert node types on touch devices
- **[STANDARD]** Curvature controls should include contextual mini-actions for smooth, symmetric, corner, break handles, and close path
- **[QOL]** Radial menu or compact toolbar for node operations near the active path

### Fine Control Assistance
- **[CORE]** Magnifier/loupe support is required for precise node work when fingers would obscure the target
- **[CORE]** Dragging a node should display live coordinates and snapping feedback
- **[STANDARD]** Temporary axis-lock or angle-lock controls should be reachable during the drag itself
- **[STANDARD]** The app should support handle length and angle editing numerically in a sheet
- **[QOL]** AI-assisted smoothing or simplification suggestions for shaky touch-drawn paths

### Advanced Path Workflows
- **[STANDARD]** Path offset, simplify, reverse, outline stroke, join, split, and boolean actions must be accessible without desktop-style menu hunting
- **[STANDARD]** Compound path editing should preserve original components when using non-destructive mode
- **[STANDARD]** Raster trace/vectorization workflow must be mobile-usable with compact threshold/detail controls and live preview
- **[QOL]** Shape blend/interpolation workflow with preview scrubber and step count slider

---

## 10. Text Editing UX on Mobile

### Text Entry Model
- **[CORE]** Tapping text should enter an explicit text-edit state rather than ambiguously selecting/moving the object
- **[CORE]** The software keyboard must not destroy viewport context; the canvas should reframe intelligently when the keyboard appears
- **[CORE]** The app must support point text and area text editing on mobile
- **[STANDARD]** Cursor placement, selection handles, and text range selection must feel native to mobile expectations
- **[QOL]** Dedicated distraction-free text edit mode for longer copy changes

### Typography Controls
- **[CORE]** Font family, size, weight, alignment, line height, letter spacing, and fill/stroke must be quick to access
- **[STANDARD]** Variable font axes must be exposed as touch-friendly sliders with labeled ranges and reset controls
- **[STANDARD]** OpenType feature toggles should be presented as readable chips or grouped switches rather than raw CSS strings
- **[QOL]** Live font preview rows with performance-conscious virtualization

### Text-on-Path and Advanced Text
- **[STANDARD]** Text-on-path editing should include visible attachment point handles and offset controls
- **[STANDARD]** Baseline shift, vertical alignment, anchor, and path side controls should be available in compact inspector groups
- **[QOL]** Character styles and paragraph styles designed for touch reuse

---

## 11. Color, Stroke & Style Workflows

### Fast Style Editing
- **[CORE]** Fill, stroke, opacity, and stroke width must be editable in one or two interactions from a selection
- **[CORE]** The app must provide both a quick style popover and a deeper full style inspector
- **[STANDARD]** Recently used colors, swatches, and sampled colors must remain visible during a session
- **[QOL]** Sticky “last used style” memory when drawing new objects

### Color Picking
- **[CORE]** Touch-friendly color picker with hue, saturation/value or wheel, alpha, and numeric entry
- **[CORE]** Eyedropper must sample from the canvas accurately without intrusive UI lag
- **[STANDARD]** Palette management for document swatches, recent colors, and global colors
- **[STANDARD]** Spot colors and named swatches should be preserved for production workflows
- **[QOL]** Contrast checker and gamut warning overlays in the picker

### Stroke & Effects Controls
- **[CORE]** Stroke width, linecap, linejoin, dash, miter, opacity, and paint order must be touch-editable
- **[STANDARD]** Dash editing should provide chip-based presets plus deep numeric editing
- **[STANDARD]** Gradients should use direct on-canvas handles alongside inspector controls
- **[QOL]** Mini preview strip for filters, shadows, blur, and blend modes

### Production Color Workflows
- **[STANDARD]** ICC profile and `<color-profile>` support must be preserved in mobile editing flows, not stripped as “advanced only”
- **[STANDARD]** The app must visibly indicate when a document uses embedded profiles or production spot colors
- **[QOL]** Export warnings when output destinations may flatten, rasterize, or lose print-specific color data

---

## 12. Layers, Structure & Defs Navigation

### Layer Navigation
- **[CORE]** The layer panel must be touch-usable for hide/show, lock, reorder, rename, and select
- **[CORE]** Nested groups must be collapsible and readable on small screens
- **[STANDARD]** Swipe actions may expose common layer commands such as lock, duplicate, hide, and delete
- **[QOL]** Layer thumbnails should be optional on very small devices to trade detail for density

### Reordering
- **[CORE]** Drag-to-reorder must work reliably with autoscroll in long layer lists
- **[STANDARD]** Bring forward/back and move to front/back shortcuts should be available without dragging when the list is crowded
- **[QOL]** Drop previews and haptic slot confirmation during reorder

### Defs, References & Structure Tools
- **[CORE]** Mobile users must still be able to browse gradients, filters, symbols, masks, markers, patterns, clips, and views from defs
- **[STANDARD]** Def items should have compact preview cards and usage counts
- **[STANDARD]** ID editing and reference auditing must be available in mobile inspectors without forcing raw-code mode
- **[QOL]** Quick-jump chips from a selected element to any referenced defs item and back again

### Structural Awareness
- **[CORE]** The app must communicate when editing an instance vs a definition vs a clone target
- **[STANDARD]** Breadcrumbs for nested groups, symbols, clips, masks, and isolated edit contexts
- **[QOL]** Local structure map mini-sheet for dense nested documents

---

## 13. Gestures & Input Grammar

### Required Gesture Set
- **[CORE]** Pinch to zoom
- **[CORE]** Two-finger pan or dedicated pan gesture
- **[CORE]** Tap to select
- **[CORE]** Tap-and-hold for alternate actions, disambiguation, or context menus
- **[CORE]** Drag for direct manipulation
- **[STANDARD]** Two-finger tap for undo and three-finger tap for redo, where platform-appropriate and not conflicting with OS behavior
- **[QOL]** User-remappable gesture vocabulary for power users

### Gesture Conflict Management
- **[CORE]** Gestures must not perform different critical actions in near-identical ways without clear state separation
- **[CORE]** The app must visibly indicate when a gesture is reserved for canvas navigation versus object editing
- **[STANDARD]** Gesture tutorials should appear contextually the first few times advanced modes are entered
- **[QOL]** Gesture diagnostics mode for internal QA and power users to inspect what the app interpreted

### Stylus Support
- **[STANDARD]** Pressure-insensitive and pressure-aware stylus input modes should be supported where device APIs allow
- **[STANDARD]** Palm rejection should be reliable during path drawing and annotation
- **[QOL]** Distinct stylus-vs-finger roles, such as stylus draws while finger pans

---

## 14. Precision Controls & Numeric Entry

### Numeric Editing
- **[CORE]** Every important geometric and style value must be editable numerically even on mobile
- **[CORE]** Numeric input flows must be lightweight and not require opening giant full-screen forms for single values
- **[STANDARD]** Stepper buttons, drag scrubbing, and sliders should complement direct typing
- **[STANDARD]** Users should be able to choose unit types where relevant
- **[QOL]** Expression parsing for simple math in numeric fields, such as `*2`, `/3`, `+12`, or `50%`

### Precision UX
- **[CORE]** Fine adjustments must support slower precision drag speeds or adjustable sensitivity
- **[STANDARD]** Holding or toggling a precision modifier should reduce drag increments on sliders and canvas handles
- **[STANDARD]** Snap values and alignment guides must appear clearly without cluttering the screen
- **[QOL]** Alternate “jog wheel” control for precision values like rotation or stroke width

### Keyboard & External Input
- **[STANDARD]** Hardware keyboard shortcuts should enhance the experience when available, but never gate core tasks
- **[STANDARD]** Pointer/mouse support on tablets or desktop-class mobile browsers should be additive, not break touch logic
- **[QOL]** Custom shortcut bindings for external keyboards on advanced devices

---

## 15. View Management, Navigation & Orientation Changes

### View Tools
- **[CORE]** Fit canvas, fit selection, actual size, zoom percentage, and minimap/overview access must be available on mobile
- **[CORE]** View controls should avoid persistent clutter while remaining quickly accessible
- **[STANDARD]** Users should be able to bookmark views or named viewpoints for large documents
- **[QOL]** Small floating minimap with drag-to-pan on tablets and large phones

### Orientation Changes
- **[CORE]** Rotating the device must not lose work, selection, or editing state
- **[CORE]** The layout must adapt meaningfully between portrait and landscape, not simply scale
- **[STANDARD]** Landscape can expose more persistent inspectors; portrait can prioritize canvas and bottom sheets
- **[QOL]** Optional orientation lock per document session

### Deep Navigation
- **[STANDARD]** For large artboards or sprawling documents, users need quick-jump navigation to selected items, layers, symbols, or named views
- **[QOL]** Search-driven “jump to object” navigator with result previews

---

## 16. Files, Import, Export & Sharing

### File Intake
- **[CORE]** Opening local files, cloud files, shared links, and clipboard/import content must feel native on mobile OSes
- **[CORE]** The app must support resumeable import flows if the OS interrupts the picker or background state
- **[STANDARD]** Drag-and-drop import should be supported where the platform permits it
- **[QOL]** Batch import for multiple SVG assets into a project or document set

### Import UX
- **[CORE]** Unsupported or partially supported content must produce readable warnings instead of silent degradation
- **[CORE]** The app must preserve advanced SVG content whenever possible, even if the mobile UI cannot fully edit it yet
- **[STANDARD]** Import summaries should list fonts, images, filters, scripts, external refs, color profiles, and defs resources detected
- **[QOL]** Guided repair suggestions for broken references or unsupported features

### Export UX
- **[CORE]** Quick export to SVG must be one of the simplest flows in the app
- **[CORE]** Raster export presets for PNG/WebP/JPEG must be available with size and transparency controls
- **[STANDARD]** Export should communicate whether output preserves editability, interactivity, animation, scripts, profiles, spot colors, and defs integrity
- **[STANDARD]** Sharing flows should integrate with platform share sheets and save providers cleanly
- **[QOL]** One-tap “export current selection” and “export slices/views” workflows

### Versioned Saving
- **[STANDARD]** Autosave, save as copy, duplicate document, and restore previous version should all be mobile-usable
- **[QOL]** Time-stamped snapshots with thumbnail previews in a session history view

---

## 17. Performance, Battery & Thermal Behavior

### Performance Baseline
- **[CORE]** The editor must stay responsive under typical phone hardware constraints while editing medium-complexity SVG files
- **[CORE]** Touch latency, scroll stutter, and panel lag must be treated as first-class product bugs
- **[STANDARD]** Heavy features such as large filters, vectorization, or script preview should degrade gracefully under limited hardware
- **[QOL]** Performance HUD for dev/testing builds to inspect frame timing and bottlenecks

### Battery & Thermal Awareness
- **[CORE]** The app must avoid unnecessary continuous re-rendering when idle
- **[CORE]** Background tasks must be paused or reduced appropriately when the app is backgrounded
- **[STANDARD]** The app should reduce animation density and preview refresh rate under thermal stress or low-power conditions where the platform exposes signals
- **[QOL]** Optional low-power editing mode that favors stability over fluid effects previews

### Large File Handling
- **[CORE]** Large documents should load progressively when possible, with clear progress UI
- **[STANDARD]** Panels showing many items, fonts, layers, or assets must use virtualization
- **[STANDARD]** Previews and thumbnails should lazy-load and cache intelligently
- **[QOL]** Document complexity analyzer with suggestions like flatten effects preview, hide heavy layers, or isolate current region

---

## 18. Offline, Recovery & Session Continuity

### Offline Editing
- **[CORE]** Core editing must function without network access
- **[CORE]** Save and recovery behavior must be understandable while offline
- **[STANDARD]** Cloud sync states should clearly distinguish local saved, queued upload, sync conflict, and failed sync
- **[QOL]** Offline badge and queue inspector for pending saves/exports

### Crash Recovery & Resilience
- **[CORE]** Unexpected app termination must reopen into a recoverable state with the last autosaved work intact whenever possible
- **[CORE]** Recovery must preserve selection, viewport, unsaved edits, and open inspector context where feasible
- **[STANDARD]** Recovery UI should explain what was restored and what may be missing
- **[QOL]** Automatic forensic log export option after repeated crashes in the same document

### Session Continuity
- **[CORE]** Backgrounding the app must not recklessly reset the workspace
- **[STANDARD]** Reopening a document should return the user to the last meaningful workspace state
- **[QOL]** Cross-device handoff support where feasible, continuing from the last saved view/selection context

---

## 19. Collaboration, Review & Commenting

### Lightweight Review on Mobile
- **[STANDARD]** Users should be able to open a document in comment/review mode without exposing full editing complexity
- **[STANDARD]** Tap-to-comment on canvas regions or object selections should be supported
- **[QOL]** Voice-note or quick markup annotations for mobile review sessions

### Change Awareness
- **[STANDARD]** Visual diff summaries for recent changes should be mobile-readable
- **[STANDARD]** Change history should describe edits in human terms, such as “Changed fill of 3 objects” or “Moved group logo-lockup”
- **[QOL]** Approve/request-changes workflow for team review on mobile

---

## 20. Accessibility & Inclusive Mobile Design

### Core Accessibility
- **[CORE]** The app UI must support dynamic text scaling without collapsing into unusability
- **[CORE]** Color alone must not communicate critical states such as selection, warnings, or errors
- **[CORE]** Screen reader labeling must exist for global controls, tool names, layer actions, and key inspector sections
- **[STANDARD]** Haptics, visual indicators, and audible cues should complement one another where useful
- **[QOL]** High-contrast editing theme and reduced motion mode

### Motor Accessibility
- **[CORE]** The app must support slower interaction speeds and avoid punishing short accidental drags
- **[STANDARD]** Users should be able to enlarge control density and handles globally
- **[QOL]** Sticky target mode for very small path nodes or inspector toggles

### Cognitive Accessibility
- **[CORE]** The UI should avoid overwhelming new users with all advanced SVG concepts at once
- **[STANDARD]** Explanatory labels and summaries should translate technical SVG jargon into user-readable language where possible
- **[QOL]** Contextual “what does this do?” inline help for advanced features like masks, symbols, filters, views, and scripts

---

## 21. Adaptive Layouts: Phones, Foldables & Tablets

### Phones
- **[CORE]** Phone layouts must prioritize canvas and a small number of immediate actions
- **[CORE]** Deep controls should live in bottom sheets, step flows, or contextual inspectors
- **[STANDARD]** Compact density mode for sub-6.3-inch devices

### Foldables & Large Phones
- **[STANDARD]** Foldables and large phones should gain optional dual-pane layouts without losing touch ergonomics
- **[STANDARD]** The app should handle hinge/fold safe areas gracefully where applicable
- **[QOL]** “Canvas on one pane, inspector on the other” layout for expanded devices

### Tablets
- **[STANDARD]** Tablets can expose more persistent panels, larger minimaps, and split visual/code or visual/layers arrangements
- **[QOL]** Desktop-adjacent tablet layout presets while preserving touch-first interactions

---

## 22. Safe Interactivity, Preview & Runtime Modes

### Interactive SVG Content
- **[CORE]** Documents containing `<foreignObject>` content must preview correctly within mobile constraints
- **[CORE]** `<script>` tags and inline event attributes must be preserved during save/edit flows even if execution is restricted in edit mode
- **[STANDARD]** Preview mode should safely execute supported interactive content in a sandboxed environment where feasible
- **[STANDARD]** The UI must clearly indicate when the user is in safe edit mode versus live interactive preview mode
- **[QOL]** Quick toggle to restart interactive preview and inspect runtime warnings/errors

### Animation Preview
- **[CORE]** CSS and SMIL animation preview must be available without forcing export to another app
- **[STANDARD]** Preview should include play/pause, restart, speed multiplier, and reduced-motion simulation
- **[QOL]** Timeline scrubber for compatible animation types on larger devices

### Safety Model
- **[CORE]** Script execution must never occur implicitly during normal editing if it could alter the document or environment unexpectedly
- **[STANDARD]** The app should show trust prompts or file trust status for interactive documents
- **[QOL]** Fine-grained preview permissions such as scripts on/off, network access on/off, animations on/off

---

## 23. Customization & Workspace Preferences

### Workspace Tuning
- **[STANDARD]** Users should be able to customize toolbar position, dominant hand preference, haptics, theme, and panel defaults
- **[STANDARD]** Users should be able to choose between simplified and advanced inspector density
- **[QOL]** Saved workspace presets for quick edit, draw, path edit, review, and text-heavy sessions

### Behavioral Preferences
- **[STANDARD]** Toggle preferences for tap-to-select behavior, target picker behavior, gesture sensitivity, snapping strength, and loupe display
- **[QOL]** Per-device preferences synced across sessions where appropriate

### Personal Efficiency Features
- **[QOL]** User-defined quick actions menu
- **[QOL]** User-defined object defaults such as default fill, stroke, text style, and gradient preset

---

## 24. Onboarding, Discoverability & Learning UX

### Initial Onboarding
- **[CORE]** The first-run experience should teach the minimum needed to avoid confusion: navigate, select, edit, undo, save
- **[CORE]** Onboarding must be skippable and recoverable later
- **[STANDARD]** Mode-specific micro-tutorials should appear when entering complex flows like path editing, text-on-path, gradients, or boolean operations
- **[QOL]** Interactive practice canvas for learning gestures safely

### Discoverability
- **[CORE]** Hidden gestures and long-press behaviors should have visible affordances or hints somewhere nearby
- **[STANDARD]** Empty states should teach what the panel or mode is for
- **[QOL]** Searchable command palette or help index on larger devices

### Expert Help
- **[STANDARD]** Advanced inspector fields should include examples or mini explanations where the raw SVG concept is obscure
- **[QOL]** “Show underlying SVG” for the current control so users can learn the format while editing visually

---

## 25. Implementation Readiness Checklist

A mobile-first SVG editor is not ready unless all of the following are true:

- **[CORE]** Every common edit task is achievable by touch only
- **[CORE]** The canvas remains the dominant visual region on phones
- **[CORE]** Selection in dense artwork is reliable and debuggable
- **[CORE]** Numeric precision is available without desktop assumptions
- **[CORE]** Keyboard appearance, app backgrounding, and rotation do not destroy user context
- **[CORE]** The shell makes fast edits cheap in taps and slow edits tolerable in depth
- **[STANDARD]** Panels, inspectors, and layer flows are optimized for scanning and thumb travel, not copied from desktop
- **[STANDARD]** Performance is acceptable under mid-range mobile hardware and sustained sessions
- **[STANDARD]** Interactive content is preserved safely and previewed intentionally
- **[STANDARD]** Accessibility, offline resilience, and export clarity are not afterthoughts
- **[QOL]** The app supports both casual burst edits and long-form professional sessions gracefully

---

## 26. Recommended Build Order

### Phase 1 — Mobile Editing Foundation
- **[CORE]** App shell, canvas-first layout, viewport navigation, selection, direct transforms, undo/redo, save/autosave
- **[CORE]** Basic bottom-sheet inspector, touch-sized controls, quick fill/stroke editing, layer list basics

### Phase 2 — Reliable Touch Editing
- **[STANDARD]** Dense-object target picker, loupe, multi-select, better transforms, better numeric controls, orientation-safe layouts
- **[STANDARD]** Performance tuning, virtualization, crash recovery, keyboard-aware layouts

### Phase 3 — Professional Mobile Workflow
- **[STANDARD]** Full style system, defs navigation, gradients, masks, symbols, advanced text, path editing, raster trace, compound paths
- **[STANDARD]** Import/export diagnostics, color profile retention, spot color support, interactive preview mode

### Phase 4 — Power User Layer
- **[QOL]** Workspace customization, gesture remapping, review mode, command/help search, saved presets, advanced previews, large-device adaptive layouts

### Phase 5 — Polish and Validation
- **[STANDARD]** Tap-cost audits, ergonomics review, accessibility QA, battery/thermal testing, interruption testing, real-device validation across small phones, large phones, foldables, and tablets

---

## Closing Note

A strong mobile SVG editor cannot merely be “feature complete.” It must be **gesture-literate, interruption-resistant, precision-friendly, and screen-space intelligent**. Desktop vector tools assume room to sprawl. Mobile tools must fight for every pixel and every tap.

That means the win condition is not just “all SVG features exist somewhere.” The win condition is this:

**a person on a phone can reliably find them, use them, trust them, and keep momentum while creating real work.**
