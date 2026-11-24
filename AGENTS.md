# Contributor guide — SUZI

> **Current editing path (since 2026-11-23): GitHub is this code's home.**
> This repository was imported from Lovable by download (PR #10), NOT by
> Lovable's GitHub connect, and Lovable is no longer the editor for this
> code. Edits made in the old Lovable project do not sync here and will
> drift. Make changes as ordinary GitHub branches and pull requests
> against this repository, with review at the exact head before merge.
>
> **Database changes** do not go through any editor: schema for the
> external SUZI datastore lives as proposed, unapplied migrations in
> `supabase-external/proposed/` and moves only through that folder's
> separately gated review-and-apply process (see the header of each
> proposed migration). The `supabase/` and `drizzle/` trees in this repo
> are the archived Lovable prototype schema, not a live migration path.
>
> The block below is the imported Lovable guide, retained verbatim for
> provenance. It is **historical and inactive** — do not follow it.

<!-- LOVABLE:HISTORICAL-INACTIVE — retained for provenance only; superseded by the GitHub editing path above. -->
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
<!-- LOVABLE:HISTORICAL-INACTIVE:END -->

## Project rules (SUZI)
- Contributions persist ONLY to the external SUZI Supabase via `src/lib/external-suzi-supabase.server.ts` (approved ref check, explicit `SUZI_EXTERNAL_WRITES_ENABLED`, no Lovable Cloud fallback); otherwise the form shows unavailable — founder rule: one governed SUZI datastore. Schema lives as a proposed, unapplied migration in `supabase-external/proposed/`.
- Never log submitted contribution content; log only error codes — submissions may contain personal details.
- Analytics live in `src/lib/analytics/`; vendor SDKs load only after opt-in and only with valid `VITE_SUZI_*` keys, and every prop passes the allowlist sanitizer — prevents pre-consent requests and PII leakage.
- Conversions fire only via `trackConversion(id)` after a persisted row id is returned, de-duplicated by id.
- Site stays `noindex` (root meta + robots.txt) until launch is approved.
