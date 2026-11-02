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
Dense graphs focus on the selected module, with all dependencies available on demand. Upstream/downstream navigation and display filtering never modify planning data.

## Elevation & Depth
Hairline borders and tonal layering lead; soft offset shadows distinguish selected graph nodes.

## Shapes
Compact rounded controls and nodes, without decorative panels.

## Components
Icon-only actions have accessible names and tooltips. Native owner controls retain names. Details and the component palette expand only when requested. Published/draft status, GitHub handoff instructions, errors and replacement warnings remain explicit.
Local initials avatars identify participants across views; owner tooltips include names and roles, and primary owners have an outline.

## Do's and Don'ts
Do preserve original SVG colors and keyboard focus. Do keep assignments visibly actionable. Don't replace meaningful names with ambiguous logos or imply that local data is shared.
