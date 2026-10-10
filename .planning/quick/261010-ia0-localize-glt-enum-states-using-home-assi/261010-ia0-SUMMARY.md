# Localized entity-state display — completed

Implemented Home Assistant state formatting in the authored card base. Numeric measurements and explicit attribute strings retain their existing behavior. Replay formats the recorded state with its entity metadata rather than the current live mode. Generated card copies were rebuilt from source.

Validation: the two localization regressions failed before the fix; all four focused tests now pass. The full JavaScript suite passes 559 tests, with one existing skip. Deterministic release verification passes, including 85 staged package files and seeded drift failures. The build dependency `fast-uri` was updated to 3.1.8 after an open security alert was found; npm audit reports zero vulnerabilities. Generated provenance was rebuilt after committing canonical inputs so clean-checkout verification reproduces its identity.

Live validation: backed up the installed card, deployed the exact authored bundle with SHA-256 `be13473f256f4b716f0a9a60324ecb6c26cafed3d9027383d30d4347f4f2d69c`, and updated the existing resource cache revision. Both heating circuits display the localized mode. Heating and Solar dashboards render successfully, with desktop and mobile checks. No controller service or plant setpoint was changed. No release tag was created.

Private deployment evidence and rollback files are stored outside this repository. Source fix: `3cb5c01`; dependency fix: `7cc62b0`.

The current-HA artifact lane exposed a registry fixture incompatibility: entities without their own names cannot have entity-level areas in newer HA. The registry factory now provides an original entity name and declares `has_entity_name`; provenance still comes from registry ownership. The focused provenance tests and the full Python suite pass locally on HA 2026.2.3 (735 passed, one deselected). This changes only test fixtures.

Final CI on code commit `a5e007f` passed: exact staged artifacts execute on the independently resolved minimum HA 2024.8.0 and current HA 2026.10.0, with 729 tests passing in each container. Build, HACS categories and documentation publishing also passed. Evidence: https://github.com/Xerolux/glt-flow-card/actions/runs/38048800275.
