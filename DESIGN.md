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
Desktop uses navigation, workspace and inspector columns. Narrow screens stack the inspector and keep navigation compact. Diagram layouts remain user-editable.
On the three-column architecture canvas, the drawing area fills the remaining viewport down to the browser bottom; navigation and inspector scroll independently, with planning status in the sidebar.
Graphs show all dependencies by default, with ELK layered topology layout and orthogonal routes around measured node bounds. Incoming edges to the selected module are blue (#2167ad); outgoing edges are orange (#a34d12); other dependencies stay gray. A text legend explains direction without relying only on color. Focus filtering is optional; automatic layout and display filtering never modify planning data. Manual dragging persists the displayed positions and uses dynamic connectors for affected edges.
Business diagrams never auto-shrink below 75% zoom on arrival or re-layout, on any screen size. Node coordinates and spacing are viewport-independent; oversized graphs center the current (or first) module and invite panning. Resizing does not reset zoom. Whole-graph fitting remains an explicit toolbar/control action, not the default mobile presentation.

## Elevation & Depth
Hairline borders and tonal layering lead; soft offset shadows distinguish selected graph nodes.

## Shapes
Compact rounded controls and nodes, without decorative panels.

## Components
Icon-only actions have accessible names and tooltips. Native owner controls retain names. Details and the component palette expand only when requested. Published/draft status, GitHub handoff instructions, errors and replacement warnings remain explicit.
Local initials avatars identify participants across views; owner tooltips include names and roles, and primary owners have an outline.
Mapped participants use unique two-letter pinyin initials from the authorized account-to-initials table, never their numeric GitHub ID. Only public nicknames and initials ship; real names and full pinyin are not stored. Unmapped display names retain the existing local initials fallback.
Canvas module cards have two content rows: icon, ID, name and state share the tinted heading; technology logos and owner avatars share the footer. Long headings truncate visually with the full name and layer available on hover and the node's accessible name retaining the full module name. Heading tints indicate architecture layer, not completion status.
Business card titles use 18px text, with 12px module IDs and footer text; technical card titles also use 18px. Preserve the compact two-row structure and full accessible names.
The saved-draft prompt offers explicit restore and delete actions. Delete removes only the planner's saved local draft before hiding the prompt; refresh must not resurrect it. A storage error keeps recovery available and reports the failure. Later deliberate edits can create a new draft.
The architecture-layer and line-direction legends share one compact row with the all-dependencies toggle. The toolbar scrolls horizontally on narrow screens instead of consuming additional canvas height.
The selected module has a teal outline. Its direct upstream neighbors have a deep-blue glow, downstream neighbors a pale-yellow glow, and feedback neighbors both glows. Unrelated cards dim without losing pointer or keyboard interaction; relation labels are included in accessible node names. If filtering hides the selected module, visible cards remain undimmed.
Selection is optional: clicking the current card again, the blank canvas, or Escape on a focused card clears selection. Enter and Space toggle a focused card. With no visible selection, all cards and dependencies regain normal opacity and all dependencies are shown even when focus filtering is enabled. The empty inspector retains its column to avoid shifting the graph.
Business architecture is the first navigation item, technical architecture the second. Business inspector owners use the same current/upstream/downstream roles as cards, including multiple relation labels and subdued unrelated people. Context styling never changes collaborator checkboxes. Dependency buttons include owner avatars and retain business-canvas navigation.
Technical architecture reuses the existing current-project surface and shared ELK routing with fixed-size, non-draggable but interactive nodes. Default to the observed runtime scope for a readable first view; the full source/template topology remains available through the scope selector. Its desktop graph and independently scrolling detail column fill the remaining viewport. Narrow screens stack the detail below the graph; the compact toolbar scrolls horizontally.
Runtime badges explicitly distinguish ready, blocked, not observed in the inspected cluster, source/template only, and planned integration. Solid edges mean observed resource/configuration relationships, dashed edges source/template relationships, dotted edges planned connections. A visible timestamp and snapshot warning prevent readiness from being mistaken for live monitoring or business acceptance. Selecting a technical node highlights its direct neighbors; deselection restores the overview.
MEM-AI targets PostgreSQL and retires SQLite. The runtime view includes the explicitly planned PostgreSQL migration target and dotted relationship, without claiming readiness. Earlier SQLite observations are historical context only, not the intended architecture; independent LLMWiki SQLite storage is unchanged.

## Do's and Don'ts
Do preserve original SVG colors and keyboard focus. Do keep assignments visibly actionable. Don't replace meaningful names with ambiguous logos or imply that local data is shared.
