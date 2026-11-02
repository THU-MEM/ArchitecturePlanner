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
Preserve its views and module/component mappings; do not publish service-private source, credentials or unapproved personnel data. The user authorized displaying organization members' GitHub nicknames as planning participants. Initial participants come from deployment configuration; planning ownership is separate from repository access permissions.
Icon-first editable canvas, module/component mappings and independent primary/secondary owner assignments for both modules and technology components.
Use original-color local SVG technology logos; keep necessary names and controls visible, with detailed prose collapsed. Support local JSON import/export.
Reflect the current SSO snapshot and public MEM-AI implementation in a separate source-backed view, with links into assignments. Distinguish implemented code from production deployment and planned integrations; never equate OIDC identity, model API keys and balance-query service credentials. Preserve existing drafts and the original planning baseline.
The repository planning JSON is authoritative. Open the published version by default and offer explicit recovery of local drafts. Submit edits as a JSON-only branch and pull request using the editor's GitHub credentials held only in page memory. Review, consistency and conflict resolution belong to repository maintainers; never write directly to main or automatically merge.
GitHub Pages publishes after merge. No database, external API server, SSO or Cloudflare dependency is required for planning persistence. Published planning information is public; never include secrets or additional personal information.

## Users

Project teams reviewing architecture and dividing implementation work.
