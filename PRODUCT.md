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
Prioritize drawing space: combine product identity, current view and assignment count in a compact top banner, use a single horizontal navigation strip instead of a left sidebar, and keep both canvases aligned to the browser bottom. Preserve filters, accessible navigation, draft recovery and explicit errors.
Keep source evidence, observed runtime readiness and planning status separate; distinguish user identity, model keys and service credentials. Technical architecture is a dated, read-only SSH-verified snapshot, not live monitoring or business acceptance. Never publish host addresses, private domains, credentials, raw operational output or environment values.
Business selection highlights current, upstream and downstream owners in the inspector without changing assignments.
Repository JSON is authoritative; browser edits are recoverable local drafts. Publishing uses GitHub's native editor and review, without tokens in the planner, write APIs or an external backend. Clipboard failure must leave manual copy/export available.
See [README](README.md) for operation and publishing.

## Users

Project teams reviewing architecture and dividing implementation work.
