# ArchitecturePlanner

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite, selected by the user. GitHub Pages hosts the static build.

## Product Purpose

Connect business modules, technology components and work assignments in one planning workspace.

## Capabilities and Constraints

The user authorized the existing AI-MEM architecture document as the public content carrier.
Preserve its views and module/component mappings; do not publish service-private source, credentials or actual personnel.
Icon-first editable canvas, module/component mappings and independent primary/secondary owner assignments for both modules and technology components.
Use original-color local SVG technology logos; keep necessary names and controls visible, with detailed prose collapsed. Support local JSON import/export.
Reflect the current SSO snapshot and public MEM-AI implementation in a separate source-backed view, with links into assignments. Distinguish implemented code from production deployment and planned integrations; never equate OIDC identity, model API keys and balance-query service credentials. Preserve existing drafts and the original planning baseline.
Optional Cloudflare Workers + D1 REST API for shared persistence. Protect reads and writes; never embed editor credentials in the frontend.
GitHub Pages must be live; absent Cloudflare authorization must be clearly disclosed, not presented as a working shared service.

## Users

Project teams reviewing architecture and dividing implementation work.
