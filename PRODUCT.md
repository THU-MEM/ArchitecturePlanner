# ArchitecturePlanner

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite, selected by the user. GitHub Pages hosts the static build.

## Product Purpose

Connect business modules, technology components and work assignments in one planning workspace.

## Capabilities and Constraints

Preserve the authorized original architecture as a read-only reference, separate from editable planning data.
Use original-color local SVGs, necessary names and collapsed detail. Support editable mappings and independent primary/secondary owners for modules and technology components.
Planning ownership is not authentication, organization membership or access permission. Publish only authorized GitHub nicknames and planning content, never private source, credentials or additional personal data.
Business architecture is the first navigation item; technical architecture is second. Reuse the current-project page and shared graph layout to show sanitized infrastructure, service and storage relationships.
Technical architecture defaults to a deployment-and-entry overview. Dashed domain frames separate the main server (Kubernetes, ingress and the planned API/SSH bridge) from an independent planned GPU server (TTS, video generation and modeling). GPU establishes reverse SSH forwarding to the main server; API requests travel through the main-server proxy and mapped ports to GPU models. GPU is not presented as an additional Kubernetes node. Show the planned homepage Navigation at /, browser Agent loop at /app, installable PWA shell, IndexedDB structured-data layers and separate Cache Storage resources. These are architecture plans, not implementations of the planner or newly verified deployments; preserve the dated observed-runtime scope.
Architecture drawing is a separate third Tab for freehand strokes, shapes, text, bound arrows and draggable local technology SVG logos. Use the MIT-licensed Excalidraw editor, lazy-loaded with same-site fonts, without a collaboration or AI backend. Drawings autosave independently in the current browser and can be downloaded as editable files or PNG; they never modify or publish planning data.
Expose labeled Brush and Selection shortcuts in the drawing action row. Reuse native freehand strokes for mouse, touch and pen trajectories, with native styling, history and persistence. Keep shortcut activation in sync with native toolbar changes; close the mobile logo palette when starting to draw.
The drawing palette contains 207 self-hosted SVG assets: 135 distinct brand logos and 72 Alibaba Cloud service illustrations, organized by category and searchable by English/Chinese names, abbreviations and keywords. Brand art comes from pinned CC0 sources; transparent Alibaba service illustrations reuse licensed Lucide shapes with product codes and are explicitly not official product artwork. Do not redistribute unlicensed service icon collections or imply a complete Alibaba product catalog. Large palettes keep category/search controls visible and lazy-load previews.
Selected rectangles, ellipses, diamonds and images expose four drag-to-connect edge ports. Connections use native bound elbow arrows, with an arrowhead only at the destination by default, and remain attached as shapes move. Users can select connectors to change stroke pattern and arrowhead direction; native geometry/style editing remains available. Cancelled or empty drops leave no scene changes. Ports also offer a keyboard target picker. All connections participate in normal undo/redo, persistence and exports.
While the drawing Tab is open, system paste inserts clipboard images or creates editable multiline text at the last canvas pointer position, falling back to the visible center. Preserve native scene copy/paste and normal input/text-editor paste. Rasterize clipboard images locally to static PNG (20 MiB input limit, 4096-pixel longest edge), retaining aspect ratio and transparency, with explicit decode/storage errors and normal undo, backup and export.
Prioritize drawing space: combine product identity, current view and assignment count in a compact top banner, use a single horizontal navigation strip instead of a left sidebar, and keep both canvases aligned to the browser bottom. Preserve filters, accessible navigation, draft recovery and explicit errors.
Keep source evidence, observed runtime readiness and planning status separate; distinguish user identity, model keys and service credentials. Technical architecture is a dated, read-only SSH-verified snapshot, not live monitoring or business acceptance. Never publish host addresses, private domains, credentials, raw operational output or environment values.
Business selection highlights current, upstream and downstream owners in the inspector without changing assignments.
Repository JSON is authoritative; browser edits are recoverable local drafts. Publishing uses GitHub's native editor and review, without tokens in the planner, write APIs or an external backend. Clipboard failure must leave manual copy/export available.
See [README](README.md) for operation and publishing.

## Users

Project teams reviewing architecture and dividing implementation work.
