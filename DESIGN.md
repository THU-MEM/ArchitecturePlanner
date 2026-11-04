---
name: ArchitecturePlanner
description: Icon-first architecture and ownership workbench
colors:
  navy: "#16364d"
  accent: "#176976"
  canvas: "#f4f8fa"
  surface: "#ffffff"
  text: "#1c3041"
typography:
  headline:
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
rounded:
  control: "6px"
  node: "7px"
---

# Design System: ArchitecturePlanner

## Overview
**Creative North Star: "The Engineering Workbench"**
An Operate surface: readable architecture, explicit responsibility and restrained visual chrome. Original-color technology logos carry identity; necessary names remain visible and longer descriptions open on demand.

## Colors
Navy frames the product, teal identifies actions and selection, and pale surfaces separate navigation, canvas and inspector. Brand SVG colors are preserved, never recolored to the application accent.

## Typography
System UI fonts support Chinese and English. Hierarchy comes from weight and size; monospace is reserved for module IDs.

## Layout
A compact navy banner combines the product wordmark, current view heading and assignment count. The technical heading includes Kubernetes and services/data in the same line. Seven labeled navigation buttons form one narrow horizontal Tab-style strip underneath; overflow scrolls horizontally rather than wrapping. Remove the left navigation column, duplicate workspace titles and persistent published/deleted notices. The plan name remains available as the wordmark tooltip; unsubmitted edits keep a concise banner indicator and action feedback remains available to assistive technology.
Desktop uses workspace and inspector columns, with filters in a compact horizontal toolbar. At narrow widths the inspector stacks below. Both architecture drawing areas fill the remaining viewport down to the browser bottom; inspectors scroll independently on desktop and below the full-height drawing area on narrow screens. Diagram layouts remain user-editable.
Graphs show all dependencies by default, with ELK layered topology layout and orthogonal routes around measured node bounds. Incoming edges to the selected module are blue (#2167ad); outgoing edges are orange (#a34d12); other dependencies stay gray. A text legend explains direction without relying only on color. Focus filtering is optional; automatic layout and display filtering never modify planning data. Manual dragging persists the displayed positions and uses dynamic connectors for affected edges.
Business diagrams never auto-shrink below 75% zoom on arrival or re-layout, on any screen size. Node coordinates and spacing are viewport-independent; oversized graphs center the current (or first) module and invite panning. Resizing does not reset zoom. Whole-graph fitting remains an explicit toolbar/control action, not the default mobile presentation.

## Elevation & Depth
Hairline borders and tonal layering lead; soft offset shadows distinguish selected graph nodes.

## Shapes
Compact rounded controls and nodes, without decorative panels.

## Components
Icon-only actions have accessible names and tooltips. Native owner controls retain names. Details and the component palette expand only when requested. Unsubmitted edits, recoverable drafts, GitHub handoff instructions, errors and replacement warnings remain explicit without permanent published/deleted status text.
Local initials avatars identify participants across views; owner tooltips include names and roles, and primary owners have an outline.
Mapped participants use unique two-letter pinyin initials from the authorized account-to-initials table, never their numeric GitHub ID. Only public nicknames and initials ship; real names and full pinyin are not stored. Unmapped display names retain the existing local initials fallback.
Canvas module cards have two content rows: icon, ID, name and state share the tinted heading; technology logos and owner avatars share the footer. Long headings truncate visually with the full name and layer available on hover and the node's accessible name retaining the full module name. Heading tints indicate architecture layer, not completion status.
Business card titles use 18px text, with 12px module IDs and footer text; technical card titles also use 18px. Preserve the compact two-row structure and full accessible names.
The saved-draft prompt offers explicit restore and delete actions. Delete removes only the planner's saved local draft before hiding the prompt; refresh must not resurrect it. A storage error keeps recovery available and reports the failure. Later deliberate edits can create a new draft.
The architecture-layer and line-direction legends share one compact row with the all-dependencies toggle. The toolbar scrolls horizontally on narrow screens instead of consuming additional canvas height.
The selected module has a teal outline. Its direct upstream neighbors have a deep-blue glow, downstream neighbors a pale-yellow glow, and feedback neighbors both glows. Unrelated cards dim without losing pointer or keyboard interaction; relation labels are included in accessible node names. If filtering hides the selected module, visible cards remain undimmed.
Selection is optional: clicking the current card again, the blank canvas, or Escape on a focused card clears selection. Enter and Space toggle a focused card. With no visible selection, all cards and dependencies regain normal opacity and all dependencies are shown even when focus filtering is enabled. The empty inspector retains its column to avoid shifting the graph.
Business architecture is the first navigation item, technical architecture the second. Business inspector owners use the same current/upstream/downstream roles as cards, including multiple relation labels and subdued unrelated people. Context styling never changes collaborator checkboxes. Dependency buttons include owner avatars and retain business-canvas navigation.
Technical architecture reuses the existing current-project surface and shared ELK routing with fixed-size, non-draggable but interactive nodes. Default to the focused deployment-and-entry overview; observed runtime and full source/template topology remain available through the scope selector. Its desktop graph and independently scrolling detail column fill the remaining viewport. Narrow screens stack the detail below the graph; the compact toolbar scrolls horizontally.
Use two dashed domain frames for the main server and independent GPU server, with compound ELK layout reserving label space and routing across domain boundaries. Frames describe deployment boundaries, not runtime status. Existing ready cards retain their badges; GPU models, reverse SSH mapping and API exposure are explicitly planned. The GPU-to-main SSH-session edge is distinct from main-to-GPU API forwarding. Homepage / is a separate planned project within the main-server domain; /app Agent execution, PWA shell, IndexedDB and Cache Storage remain outside both server frames on the user device. Do not equate browser persistence with cloud sync, permanent retention or offline inference.
Runtime badges explicitly distinguish ready, blocked, not observed in the inspected cluster, source/template only, and planned integration. Solid edges mean observed resource/configuration relationships, dashed edges source/template relationships, dotted edges planned connections. A visible timestamp and snapshot warning prevent readiness from being mistaken for live monitoring or business acceptance. Selecting a technical node highlights its direct neighbors; deselection restores the overview.
The reverified runtime view shows MEM-AI ready and connected to its PostgreSQL logical database, hosted in the same PostgreSQL instance as Keycloak with different databases and usernames. Solid edges trace this instance to its actual 20Gi local-path PVC; a separate branch preserves MEM-AI's mounted 1Gi /data volume without misrepresenting it as the SQL store. This is connection and resource evidence, not historical migration, SQL privilege or recovery acceptance; independent LLMWiki SQLite storage is unchanged.
The empty technical inspector exposes concrete readiness evidence for cert-manager, CoreDNS, metrics-server and Calico with direct navigation. These are observed running infrastructure, not plans. The certificate controller's three ready Pods do not imply issued business certificates: no Certificate resources were observed. Local-path PVs are node-local storage, not replicated or proven backed up.
Architecture drawing extends the same Operate workbench as the third Tab. Keep the existing banner and single-row navigation, omit planning filters and owner inspector, and fill the remaining viewport with Excalidraw. A compact scrolling action row exposes local-only autosave, editable-file backup/import and PNG export; the native editor owns familiar drawing, undo/redo and shape-property controls. Default shapes are crisp rather than rough, with readable system text; native style choices remain available.
The technology SVG palette contains 207 assets (135 brand logos and 72 Alibaba Cloud service illustrations). Use a narrow 280px right column on wide screens and a closable overlay on phones, closing after insertion so drawing space remains usable. Keep search, category selection and result counts above an independently scrolling grid; show two-line names and explicit brand/service labels, with full names and provenance in tooltips. Match Chinese and English product names, abbreviations and keywords; apply category and multi-word search together. Lazy-load thumbnails, serve SVGs as individual same-site files and retain keyboard focus in the scroller.
Brand logos retain original colors. Alibaba product illustrations combine licensed Lucide outlines with product codes on transparent backgrounds; they must never be presented as official service artwork. The Alibaba category explains that distinction, and no asset implies a runtime deployment. Click insertion and desktop drag/drop preserve aspect ratios and create ordinary movable, resizable image elements. Drawings are independent of planning JSON; storage errors remain visible, corrupt drafts require explicit recovery/discard, and replacing nonempty content requires confirmation. Export PNG includes all scene elements and images with background and padding, capped at 4096 pixels on its longest edge.
A single selected, unlocked rectangle, ellipse, diamond or image exposes four small teal connection ports just outside its edge midpoints, without replacing native resize handles. Ports follow rotation, pan and zoom. During drag, show a directional preview, highlight the prospective destination and let Escape cancel. Committed connections are native bound elbow arrows, with fixed-point endpoints and a destination arrowhead by default; they move with their components and participate in native history. No scene changes occur for empty or cancelled drops. Keyboard activation opens a target picker. When an arrow is selected, a compact floating strip above the native bottom controls exposes stroke pattern and arrowhead direction; native style and geometry controls remain unchanged.

## Do's and Don'ts
Do preserve original SVG colors and keyboard focus. Do keep assignments visibly actionable. Don't replace meaningful names with ambiguous logos or imply that local data is shared.
