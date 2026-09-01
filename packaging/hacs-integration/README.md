# GLT Flow Card Companion — local HACS staging

Requires Home Assistant 2024.8.0 or newer. The minimum is verified against the
exact staged Companion ZIP before release.

This directory describes the integration-category package produced from the same
verified build as the GLT Flow Card dashboard package. It is release-only local
evidence for Phase 1; it does not claim that a separate Companion repository is
published or discoverable through HACS.

The repository-shaped stage contains exactly one integration at
`custom_components/glt_flow_card/`. For a release install, HACS downloads
`glt-flow-card-companion.zip` and extracts its component-relative members directly
into `/config/custom_components/glt_flow_card/`. The ZIP therefore does not repeat
the `custom_components/glt_flow_card/` prefix.

Install the dashboard/plugin package separately. The Companion adds authoritative
shared operations but does not replace the dashboard resource.
