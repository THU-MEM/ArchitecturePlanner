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
Keep SSO and MEM-AI source evidence separate from planning status and production-deployment claims; distinguish user identity, model keys and service credentials.
Repository JSON is authoritative; browser edits are recoverable local drafts. Publishing uses GitHub's native editor and review, without tokens in the planner, write APIs or an external backend. Clipboard failure must leave manual copy/export available.
See [README](README.md) for operation and publishing.

## Users

Project teams reviewing architecture and dividing implementation work.
