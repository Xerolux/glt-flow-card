/**
 * Local wording names, mapped to their catalog keys.
 *
 * The wording itself lives in `catalog-de.mjs` and `catalog-en.mjs`. It used
 * to live here as a `COPY` table, which is what made a third locale a code
 * edit in every module that renders anything: a locale is now a catalog, and a
 * catalog is data.
 *
 * This map exists so the call sites below keep naming the string they mean
 * rather than a namespaced key, including the ones that compute a name.
 */

import { template as catalogTemplate, text as catalogText } from "./catalog-lookup.mjs";
import "./catalog-de.mjs";
import "./catalog-en.mjs";

const KEYS = Object.freeze({
  "accessDenied": "safety.access_denied",
  "accessEmpty": "safety.access_empty",
  "accessHeading": "safety.access_heading",
  "accessLoading": "safety.access_loading",
  "accessRevision": "safety.access_revision",
  "accessSaved": "safety.access_saved",
  "acquireLease": "safety.acquire_lease",
  "actionColumn": "safety.action_column",
  "addMember": "safety.add_member",
  "announcements.authority_current": "safety.announcements_authority_current",
  "announcements.evidence_page_failed": "safety.announcements_evidence_page_failed",
  "announcements.lease_acquired": "safety.announcements_lease_acquired",
  "announcements.lease_held": "safety.announcements_lease_held",
  "announcements.lease_released": "safety.announcements_lease_released",
  "announcements.lease_renewed": "safety.announcements_lease_renewed",
  "applyAccessChange": "safety.apply_access_change",
  "applyFailure": "safety.apply_failure",
  "applying": "safety.applying",
  "applySelected": "safety.apply_selected",
  "applySuccess": "safety.apply_success",
  "applySuccessBody": "safety.apply_success_body",
  "artifactEquality": "safety.artifact_equality",
  "assetMetadata": "safety.asset_metadata",
  "assigned": "safety.assigned",
  "assignmentColumn": "safety.assignment_column",
  "auditActor": "safety.audit_actor",
  "auditAt": "safety.audit_at",
  "auditCorrelation": "safety.audit_correlation",
  "auditEvent": "safety.audit_event",
  "auditResult": "safety.audit_result",
  "authorityBar": "safety.authority_bar",
  "backToOverview": "safety.back_to_overview",
  "bundleEmpty": "safety.bundle_empty",
  "bundleSafety": "safety.bundle_safety",
  "byteIdentical": "safety.byte_identical",
  "cancelAccessChange": "safety.cancel_access_change",
  "cancelApply": "safety.cancel_apply",
  "cancelDiscard": "safety.cancel_discard",
  "candidateHeading": "safety.candidate_heading",
  "candidateStates.applied": "safety.candidate_states_applied",
  "candidateStates.dirty": "safety.candidate_states_dirty",
  "candidateStates.none": "safety.candidate_states_none",
  "candidateStates.preserved": "safety.candidate_states_preserved",
  "capabilitiesColumn": "safety.capabilities_column",
  "capabilityCodes": "safety.capability_codes",
  "categories.add": "safety.categories_add",
  "categories.binding": "safety.categories_binding",
  "categories.config": "safety.categories_config",
  "categories.move": "safety.categories_move",
  "categories.remove": "safety.categories_remove",
  "checkLease": "safety.check_lease",
  "checksum": "safety.checksum",
  "chooseUser": "safety.choose_user",
  "clientTelemetry": "safety.client_telemetry",
  "close": "safety.close",
  "collaboration": "safety.collaboration",
  "companion": "safety.companion",
  "companionStates.current": "safety.companion_states_current",
  "companionStates.incompatible": "safety.companion_states_incompatible",
  "companionStates.refreshing": "safety.companion_states_refreshing",
  "companionStates.stale": "safety.companion_states_stale",
  "companionStates.unavailable": "safety.companion_states_unavailable",
  "confirmAccessBody": "safety.confirm_access_body",
  "confirmAccessHeading": "safety.confirm_access_heading",
  "confirmApplyBody": "safety.confirm_apply_body",
  "confirmApplyHeading": "safety.confirm_apply_heading",
  "confirmRemoveBody": "safety.confirm_remove_body",
  "conflictBody": "safety.conflict_body",
  "conflictChoices.discard": "safety.conflict_choices_discard",
  "conflictChoices.merge-preview": "safety.conflict_choices_merge_preview",
  "conflictChoices.refresh": "safety.conflict_choices_refresh",
  "conflictChoices.retry-with-fresh-lease": "safety.conflict_choices_retry_with_fresh_lease",
  "conflictHeading": "safety.conflict_heading",
  "connected": "safety.connected",
  "controlCancel": "safety.control_cancel",
  "contractUnknown": "safety.contract_unknown",
  "controlConfirmBody": "safety.control_confirm_body",
  "finding": "safety.finding",
  "controlConfirmHeading": "safety.control_confirm_heading",
  "controlCorrelation": "safety.control_correlation",
  "controlEffect": "safety.control_effect",
  "controlHeading": "safety.control_heading",
  "controlNoRetry": "safety.control_no_retry",
  "controlPolicy": "safety.control_policy",
  "controlPreview": "safety.control_preview",
  "controlRun": "safety.control_run",
  "controlStates.accepted": "safety.control_states_accepted",
  "controlStates.cancelled_before_dispatch": "safety.control_states_cancelled_before_dispatch",
  "controlStates.denied": "safety.control_states_denied",
  "controlStates.dispatched": "safety.control_states_dispatched",
  "controlStates.failed_after_dispatch": "safety.control_states_failed_after_dispatch",
  "controlStates.failed_before_dispatch": "safety.control_states_failed_before_dispatch",
  "controlStates.readback_confirmed": "safety.control_states_readback_confirmed",
  "controlStates.result_unknown": "safety.control_states_result_unknown",
  "controlStates.timed_out": "safety.control_states_timed_out",
  "controlsVisible": "safety.controls_visible",
  "controlTarget": "safety.control_target",
  "currentRevision": "safety.current_revision",
  "discardBody": "safety.discard_body",
  "discardHeading": "safety.discard_heading",
  "dryRun": "safety.dry_run",
  "dryRunFresh": "safety.dry_run_fresh",
  "editing": "safety.editing",
  "eligibleUser": "safety.eligible_user",
  "errorCodes.authority_stale": "safety.error_codes_authority_stale",
  "errorCodes.capability_denied": "safety.error_codes_capability_denied",
  "errorCodes.effect_unknown": "safety.error_codes_effect_unknown",
  "errorCodes.feature_unavailable": "safety.error_codes_feature_unavailable",
  "errorCodes.invalid_input": "safety.error_codes_invalid_input",
  "errorCodes.lease_expired": "safety.error_codes_lease_expired",
  "errorCodes.lease_held": "safety.error_codes_lease_held",
  "errorCodes.lease_required": "safety.error_codes_lease_required",
  "errorCodes.not_found_or_denied": "safety.error_codes_not_found_or_denied",
  "errorCodes.not_loaded": "safety.error_codes_not_loaded",
  "errorCodes.rate_limited": "safety.error_codes_rate_limited",
  "errorCodes.revision_conflict": "safety.error_codes_revision_conflict",
  "errors": "safety.errors",
  "exactCardVersion": "safety.exact_card_version",
  "expectedRevision": "safety.expected_revision",
  "exportTelemetry": "safety.export_telemetry",
  "exportTrusted": "safety.export_trusted",
  "ignoredNoise": "safety.ignored_noise",
  "impact": "safety.impact",
  "inspectBundle": "safety.inspect_bundle",
  "lastRefresh": "safety.last_refresh",
  "leaseAcquiring": "safety.lease_acquiring",
  "leaseExpiresIn": "safety.lease_expires_in",
  "leaseHeading": "safety.lease_heading",
  "leaseRenewDue": "safety.lease_renew_due",
  "leaseStates.available": "safety.lease_states_available",
  "leaseStates.expired": "safety.lease_states_expired",
  "leaseStates.heldOther": "safety.lease_states_held_other",
  "leaseStates.heldSelf": "safety.lease_states_held_self",
  "leaseStates.lost": "safety.lease_states_lost",
  "leaseStates.readOnly": "safety.lease_states_read_only",
  "leaseStates.renewing": "safety.lease_states_renewing",
  "loadNext": "safety.load_next",
  "manageAccess": "safety.manage_access",
  "mediaType": "safety.media_type",
  "memberColumn": "safety.member_column",
  "mergeStates.applied": "safety.merge_states_applied",
  "mergeStates.blocked": "safety.merge_states_blocked",
  "mergeStates.failed": "safety.merge_states_failed",
  "mergeStates.idle": "safety.merge_states_idle",
  "mergeStates.ready": "safety.merge_states_ready",
  "mergeStates.requested": "safety.merge_states_requested",
  "modeLocal": "safety.mode_local",
  "modeShared": "safety.mode_shared",
  "myAccess": "safety.my_access",
  "myRole": "safety.my_role",
  "never": "safety.never",
  "noCapabilities": "safety.no_capabilities",
  "noEvidence": "safety.no_evidence",
  "notEvidence": "safety.not_evidence",
  "notRun": "safety.not_run",
  "overview": "safety.overview",
  "path": "safety.path",
  "policyVersion": "safety.policy_version",
  "previewFailed": "safety.preview_failed",
  "previewReady": "safety.preview_ready",
  "project": "safety.project",
  "rawContract": "safety.raw_contract",
  "readOnly": "safety.read_only",
  "readOnlyReasons.authority_absent": "safety.read_only_reasons_authority_absent",
  "readOnlyReasons.authority_incompatible": "safety.read_only_reasons_authority_incompatible",
  "readOnlyReasons.authority_loading": "safety.read_only_reasons_authority_loading",
  "readOnlyReasons.authority_rejected": "safety.read_only_reasons_authority_rejected",
  "readOnlyReasons.authority_sequence_gap": "safety.read_only_reasons_authority_sequence_gap",
  "readOnlyReasons.authority_stale": "safety.read_only_reasons_authority_stale",
  "readOnlyReasons.companion_disconnected": "safety.read_only_reasons_companion_disconnected",
  "readOnlyReasons.lease_expired": "safety.read_only_reasons_lease_expired",
  "readOnlyReasons.lease_lost": "safety.read_only_reasons_lease_lost",
  "readOnlyReasons.lease_required": "safety.read_only_reasons_lease_required",
  "readOnlyReasons.role_missing": "safety.read_only_reasons_role_missing",
  "readOnlyReasons.role_revoked": "safety.read_only_reasons_role_revoked",
  "releaseEvidence": "safety.release_evidence",
  "releaseLease": "safety.release_lease",
  "removeAccess": "safety.remove_access",
  "renewLease": "safety.renew_lease",
  "requiredDependency": "safety.required_dependency",
  "restore": "safety.restore",
  "restoreAwaiting": "safety.restore_awaiting",
  "restoreBody": "safety.restore_body",
  "restoreLabel": "safety.restore_label",
  "restoreMismatch": "safety.restore_mismatch",
  "restoreReady": "safety.restore_ready",
  "revision": "safety.revision",
  "revisionConflict": "safety.revision_conflict",
  "revisionTriplet": "safety.revision_triplet",
  "roleColumn": "safety.role_column",
  "roleMatrix": "safety.role_matrix",
  "roleMatrixUnavailable": "safety.role_matrix_unavailable",
  "roleNames.admin": "safety.role_names_admin",
  "roleNames.engineer": "safety.role_names_engineer",
  "roleNames.none": "safety.role_names_none",
  "roleNames.operator": "safety.role_names_operator",
  "roleNames.viewer": "safety.role_names_viewer",
  "rollbackFailure": "safety.rollback_failure",
  "rollbackRunning": "safety.rollback_running",
  "rollbackSuccess": "safety.rollback_success",
  "rollbackSuccessBody": "safety.rollback_success_body",
  "rowsStale": "safety.rows_stale",
  "schema": "safety.schema",
  "scope": "safety.scope",
  "serverAuthored": "safety.server_authored",
  "serverNormalization": "safety.server_normalization",
  "sharedAuthority": "safety.shared_authority",
  "size": "safety.size",
  "standalone": "safety.standalone",
  "tabs_0": "safety.tabs_0",
  "tabs_1": "safety.tabs_1",
  "tabs_2": "safety.tabs_2",
  "tabs_3": "safety.tabs_3",
  "tabs_4": "safety.tabs_4",
  "telemetryCategory": "safety.telemetry_category",
  "telemetryEmpty": "safety.telemetry_empty",
  "telemetryPayload": "safety.telemetry_payload",
  "telemetryReceived": "safety.telemetry_received",
  "title": "safety.title",
  "trustedAudit": "safety.trusted_audit",
  "trustedEmpty": "safety.trusted_empty",
  "unchanged": "safety.unchanged",
  "validate": "safety.validate",
  "validationFailed": "safety.validation_failed",
  "validationIdle": "safety.validation_idle",
  "validationInvalid": "safety.validation_invalid",
  "validationRunning": "safety.validation_running",
  "validationSuccess": "safety.validation_success",
  "validationValid": "safety.validation_valid",
  "workflow_0": "safety.workflow_0",
  "workflow_1": "safety.workflow_1",
  "workflow_2": "safety.workflow_2",
  "workflow_3": "safety.workflow_3",
  "workflow_4": "safety.workflow_4",
});

export function projectSafetyLocale(hass, documentLanguage = "en") {
  const language = hass?.locale?.language || documentLanguage || "en";
  return String(language).toLowerCase().startsWith("de") ? "de" : "en";
}

/**
 * The names that used to hold an array, rebuilt from their indexed members.
 *
 * A catalog holds strings, because a locale has to be supplyable as data and a
 * nested structure is not something a translator can be handed. The ordered
 * groups this surface renders — the tab strip and the workflow steps — are
 * therefore stored as `tabs_0` … `tabs_4` and reassembled here, so the callers
 * that ask for `"tabs"` keep getting an array.
 */
function groupMembers(key) {
  const prefix = `${key}_`;
  return Object.keys(KEYS)
    .filter((local) => local.startsWith(prefix))
    .sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)));
}

/** The names that used to hold a lookup table, rebuilt from `key.member`. */
function tableMembers(key) {
  const prefix = `${key}.`;
  return Object.keys(KEYS).filter((local) => local.startsWith(prefix));
}

export function projectSafetyCopy(locale, key, values = {}) {
  if (KEYS[key]) return catalogText(KEYS[key], locale, values);

  const ordered = groupMembers(key);
  if (ordered.length > 0 && /^\d+$/u.test(ordered[0].slice(key.length + 1))) {
    return ordered.map((local) => catalogText(KEYS[local], locale, values));
  }
  const members = tableMembers(key);
  if (members.length > 0) {
    return Object.fromEntries(members.map((local) => [
      local.slice(key.length + 1),
      catalogText(KEYS[local], locale, values),
    ]));
  }
  throw new Error(`project-safety has no wording named ${JSON.stringify(key)}`);
}

/** The wording this surface renders, by language. Assembled from the catalog. */
export const PROJECT_SAFETY_COPY = Object.freeze(Object.fromEntries(
  ["de", "en"].map((language) => [
    language,
    Object.freeze(Object.fromEntries(
      Object.entries(KEYS).map(([local, catalogKey]) => [local, catalogTemplate(catalogKey, language)]),
    )),
  ]),
));
