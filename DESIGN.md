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

## Elevation & Depth
Hairline borders and tonal layering lead; soft offset shadows distinguish selected graph nodes.

## Shapes
Compact rounded controls and nodes, without decorative panels.

## Components
Icon-only actions have accessible names and tooltips. Native owner controls retain names. Details and the component palette expand only when requested. Published/draft status, GitHub handoff instructions, errors and replacement warnings remain explicit.
Local initials avatars identify participants across views; owner tooltips include names and roles, and primary owners have an outline.
Canvas module cards have two content rows: icon, ID, name and state share the tinted heading; technology logos and owner avatars share the footer. Long headings truncate visually with the full name and layer available on hover and the node's accessible name retaining the full module name. Heading tints indicate architecture layer, not completion status.
The architecture-layer color legend sits at the upper right of the canvas toolbar, on the same desktop row as the all-dependencies toggle. A separate line-direction key below distinguishes edge colors from card tints. Both reflow on narrow screens without covering graph content.

## Do's and Don'ts
Do preserve original SVG colors and keyboard focus. Do keep assignments visibly actionable. Don't replace meaningful names with ambiguous logos or imply that local data is shared.
