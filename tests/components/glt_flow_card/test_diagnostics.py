"""Allowlisted Companion diagnostics and localized metadata tests."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.glt_flow_card.diagnostics import (
    async_get_config_entry_diagnostics,
)
from custom_components.glt_flow_card.project_migrations import (
    CURRENT_PROJECT_SCHEMA_VERSION,
)

pytestmark = [
    pytest.mark.enable_socket,
    pytest.mark.allow_hosts(["127.0.0.1", "localhost"]),
]


async def test_diagnostics_use_explicit_metadata_allowlist(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
) -> None:
    """Support output contains only named lifecycle, build, and count evidence."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    from custom_components import glt_flow_card as integration

    manager = integration._manager(hass)
    repository = manager.project_repository
    repository._heads["projects"] = {
        "private-project-id": {
            "id": "private-project-id",
            "digest": "abcdef0123456789secret-tail",
            "config": {"secret": "PROJECT-BODY-CANARY"},
        }
    }
    repository._snapshots["snapshots"] = {
        "private-snapshot-id": {
            "id": "private-snapshot-id",
            "project_id": "private-project-id",
            "digest": "9876543210abcdefsecret-tail",
            "config": {"asset": "ASSET-BODY-CANARY"},
        }
    }
    repository._journals["journals"] = {
        "private-journal-id": {
            "id": "private-journal-id",
            "state": "PREPARED",
            "error": "RAW-EXCEPTION-CANARY",
        }
    }
    repository._audit["events"] = [
        {"id": "private-audit", "body": "PROJECT-AUDIT-BODY-CANARY"}
    ]
    manager.data["audit"] = [
        {"id": "legacy-audit", "body": "LEGACY-AUDIT-BODY-CANARY"}
    ]
    manager.remote_sites = {
        "private-site": {
            "id": "private-site",
            "url": "https://REMOTE-URL-CANARY.invalid",
            "token": "REMOTE-TOKEN-CANARY",
        }
    }
    hass.states.async_set(
        "sensor.private_canary",
        "ENTITY-STATE-CANARY",
        {"secret": "ENTITY-ATTRIBUTE-CANARY"},
    )

    result = await async_get_config_entry_diagnostics(hass, config_entry)

    assert set(result) == {
        "integration",
        "build",
        "options",
        "stores",
        "counts",
        "digests",
        "recovery",
    }
    assert result["integration"] == {
        "domain": "glt_flow_card",
        "version": "1.0.0",
        "project_schema_version": CURRENT_PROJECT_SCHEMA_VERSION,
        "loaded": True,
    }
    assert result["options"] == {
        "default_lock_ttl": 300,
        "max_versions": 60,
        "max_audit": 5000,
    }
    assert result["counts"] == {
        "projects": 1,
        "snapshots": 1,
        "journals": 1,
        "project_audit_events": 1,
        "legacy_audit_events": 1,
        "locks": 0,
        "alarm_tasks": 0,
        "listeners": 2,
        "remote_sites": 1,
    }
    assert result["digests"] == {
        "project_head_prefixes": ["abcdef012345"],
        "snapshot_prefixes": ["9876543210ab"],
    }
    assert result["recovery"]["journals_by_state"] == {"PREPARED": 1}
    assert len(result["build"]["card_sha256_prefix"]) == 12


async def test_diagnostics_redact_seeded_canaries(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
) -> None:
    """T-07: project, state, token, URL, asset, and audit bodies never serialize."""
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()

    from custom_components import glt_flow_card as integration

    manager = integration._manager(hass)
    manager.project_repository._heads["projects"] = {
        "PROJECT-ID-CANARY": {
            "id": "PROJECT-ID-CANARY",
            "digest": "a" * 64,
            "config": {"body": "PROJECT-BODY-CANARY"},
        }
    }
    manager.project_repository._snapshots["snapshots"] = {
        "SNAPSHOT-ID-CANARY": {
            "id": "SNAPSHOT-ID-CANARY",
            "project_id": "PROJECT-ID-CANARY",
            "digest": "b" * 64,
            "config": {"body": "ASSET-BODY-CANARY"},
        }
    }
    manager.project_repository._journals["journals"] = {
        "JOURNAL-ID-CANARY": {
            "id": "JOURNAL-ID-CANARY",
            "state": "BROKEN-STATE-CANARY",
            "exception": "RAW-EXCEPTION-CANARY",
        }
    }
    manager.data["audit"] = [{"body": "AUDIT-BODY-CANARY"}]
    manager.remote_sites = {
        "SITE-ID-CANARY": {
            "url": "https://REMOTE-URL-CANARY.invalid",
            "token": "REMOTE-TOKEN-CANARY",
        }
    }
    hass.states.async_set("sensor.canary", "ENTITY-STATE-CANARY")

    serialized = json.dumps(
        await async_get_config_entry_diagnostics(hass, config_entry),
        sort_keys=True,
    )
    for canary in (
        "PROJECT-ID-CANARY",
        "PROJECT-BODY-CANARY",
        "SNAPSHOT-ID-CANARY",
        "ASSET-BODY-CANARY",
        "JOURNAL-ID-CANARY",
        "BROKEN-STATE-CANARY",
        "RAW-EXCEPTION-CANARY",
        "AUDIT-BODY-CANARY",
        "SITE-ID-CANARY",
        "REMOTE-URL-CANARY",
        "REMOTE-TOKEN-CANARY",
        "ENTITY-STATE-CANARY",
    ):
        assert canary not in serialized


def test_english_and_german_flow_metadata_are_complete() -> None:
    """English, German, and source strings share setup/options/error metadata."""
    integration_dir = (
        Path(__file__).resolve().parents[3]
        / "custom_components"
        / "glt_flow_card"
    )
    documents = [
        json.loads((integration_dir / "strings.json").read_text(encoding="utf-8")),
        json.loads(
            (integration_dir / "translations" / "en.json").read_text(
                encoding="utf-8"
            )
        ),
        json.loads(
            (integration_dir / "translations" / "de.json").read_text(
                encoding="utf-8"
            )
        ),
    ]

    for document in documents:
        assert document["config"]["step"]["user"]["title"]
        assert document["config"]["abort"]["single_instance_allowed"]
        assert document["config"]["error"]["setup_failed"]
        option_data = document["options"]["step"]["init"]["data"]
        assert set(option_data) == {
            "default_lock_ttl",
            "max_versions",
            "max_audit",
        }
        assert document["options"]["error"]["invalid_options"]
