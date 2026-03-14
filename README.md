# Mobile SVG Editor Starter

A mobile-first SVG editor starter built with React, TypeScript, Vite, Zustand, and Dexie.

## Included right now

- app shell with top bar, context strip, bottom mode bar
- canvas viewport with viewBox-based camera
- rectangle creation command
- document bootstrapping from IndexedDB
- auto-created starter document if none exists
- manual save button
- new document button
- basic object selection from canvas and layer list
- recursive layers panel for nested groups and children
- multi-select toggle for mobile-friendly additive selection
- marquee selection by dragging empty canvas in Select mode
- single and multi-selection overlay bounds
- group transform box for multi-selection
- full single-selection transform box with corner and side handles
- group drag, group resize, and group rotation
- aspect-ratio lock toggle in the context strip
- rotation handle with shift-snap to 15-degree increments
- drag selected objects or selections to move them
- navigate mode for panning the canvas
- wheel and +/- zoom controls
- two-finger pinch zoom with midpoint-aware camera updates
- undo/redo snapshot history for commands, moves, resizes, and rotations
- Dexie persistence layer
- command registry and command runner
- group selection command for sibling nodes sharing the same parent
- ungroup command that preserves visible transforms by folding group transforms into children
- selection-preserving structure operations for group and ungroup commands

## Run

```bash
npm install
npm run dev
```

## First smoke test

1. Open the app.
2. Press **Add Rectangle** a few times.
3. Turn **Multi On** and select two or more sibling rectangles.
4. Press **Group** and confirm the layers panel now shows a group containing those nodes.
5. Select the new group from the layers panel and drag, resize, and rotate it.
6. Press **Ungroup** and confirm the former children are selected again and remain visually in place.
7. Use **Undo** and **Redo** to verify the structure change history is stable.
8. Drag empty canvas in **Select** mode to marquee-select multiple objects.
9. Switch to **Navigate** mode and pan/zoom the camera.
10. Press **Save** and reload to confirm the latest document comes back.

## Notes

This is still a foundation repo, not a finished editor.
Known limitations in this pass:

- grouping currently works best when the selected nodes share the same parent container
- freeform lasso selection is not added yet
- drag/move is strongest for basic primitive nodes
- path translation and path scaling are still partially generalized
- history uses whole-document snapshots rather than optimized patches
- resizing rotated shapes is functional but still axis-box based rather than a full rotated-bounds editor
- transform folding during ungroup is solid for current starter transforms, but not yet a full matrix-composition engine for every future SVG edge case
- pinch zoom focuses on camera scaling and does not yet add canvas rotation gestures

## Strong next additions

- lasso selection
- explicit group enter/isolation mode
- shape creation mode
- text tool
- richer inspector editing
- code/inspect panel
- export flows

## GitHub Pages deployment

This repo is now wired for GitHub Pages using GitHub Actions.

### Before the first deploy

1. Push this repo to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Make sure your default deployment branch is **main**.
4. Push to `main` or run the **Deploy to GitHub Pages** workflow manually.

### What is already handled

- Vite asset paths are built using the GitHub Pages base path automatically.
- `.nojekyll` is published so files and folders are served as expected.
- `404.html` is generated from `index.html` to make future SPA-style routing safer on Pages.
- The workflow installs dependencies, builds the app, uploads the Pages artifact, and deploys it.

### Local build

```bash
npm install
npm run build
```
