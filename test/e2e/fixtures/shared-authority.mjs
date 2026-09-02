/**
 * One authoritative coordinator shared by two isolated browser contexts.
 *
 * This is the *test* side of the Phase-2 contract, not product behavior. It
 * models exactly what the Companion is specified to do - server-owned roles,
 * one exclusive engineering lease, exact content and access revisions, a
 * strictly sequenced event stream, opaque evidence cursors, and configured
 * control results - so two exact-dist pages can be driven through real
 * concurrent scenarios without any live Home Assistant.
 *
 * Deliberate properties:
 *   - It never accepts a caller-authored domain, service or target.
 *   - It never returns a lease token to anyone but the holder.
 *   - It answers a hidden project and a missing project identically.
 *   - Its clock and its faults are advanced explicitly by the test.
 */
import { randomUUID } from "node:crypto";

import { installFakeHomeAssistant } from "./fake-ha.mjs";

/** Fixed role -> capability matrix, mirroring the Python policy contract. */
const VIEWER = ["project.list", "project.read", "control.read", "evidence.read"];
const OPERATOR = [...VIEWER, "control.execute", "evidence.telemetry.write"];
const ENGINEER = [...OPERATOR, "project.write", "lease.engineering"];
const ADMIN = [...ENGINEER, "project.delete", "project.access.read", "project.access.write"];

export const ROLE_CAPABILITIES = Object.freeze({
  viewer: Object.freeze(VIEWER),
  operator: Object.freeze(OPERATOR),
  engineer: Object.freeze(ENGINEER),
  admin: Object.freeze(ADMIN),
});

export const STABLE_CODES = Object.freeze([
  "not_found_or_denied",
  "capability_denied",
  "authority_stale",
  "lease_required",
  "lease_expired",
  "lease_held",
  "revision_conflict",
  "invalid_input",
  "effect_unknown",
  "rate_limited",
  "feature_unavailable",
  "not_loaded",
]);

/** Request fields no browser may ever send for a configured control. */
const FORBIDDEN_CONTROL_FIELDS = [
  "domain",
  "service",
  "entity_id",
  "device_id",
  "area_id",
  "target",
  "service_data",
  "context",
  "user_id",
];

const PAGE_SIZE = 50;

function denied(code, extra = {}) {
  return { error: { code, message: code, ...extra } };
}

/**
 * Create the shared coordinator.
 *
 * @param {object} options
 * @param {object} options.project    initial project head
 * @param {object} options.members    actor key -> fixed role
 * @param {object} options.controls   configured control definitions
 */
export function createSharedAuthority(options = {}) {
  const state = {
    now: 0,
    generation: 1,
    sequence: 0,
    policyVersion: 1,
    accessRevision: 1,
    revision: options.project?.project?.revision ?? 1,
    head: structuredClone(options.project ?? {}),
    members: { ...(options.members ?? {}) },
    controls: structuredClone(options.controls ?? []),
    lease: null,
    connections: new Map(),
    cursors: new Map(),
    evidence: [],
    telemetry: [],
    serviceCalls: [],
    faults: new Set(),
  };

  const capabilitiesOf = (actor) => ROLE_CAPABILITIES[state.members[actor]] ?? [];
  const may = (actor, capability) => capabilitiesOf(actor).includes(capability);

  const leaseValid = (actor, session, token) =>
    state.lease !== null &&
    state.lease.token === token &&
    state.lease.actor === actor &&
    state.lease.session === session &&
    state.lease.generation === state.generation &&
    state.lease.accessRevision === state.accessRevision &&
    state.lease.expiresAt > state.now;

  const coordinator = {
    /** Advance the coordinator clock; expiry is decided by this value alone. */
    advance(seconds) {
      state.now += seconds;
      return state.now;
    },

    /** Drop one connection, as a network loss or a browser reload would. */
    disconnect(session) {
      state.connections.delete(session);
      if (state.lease?.session === session) state.lease = null;
      for (const [id, cursor] of state.cursors) {
        if (cursor.session === session) state.cursors.delete(id);
      }
    },

    /** Restart the Companion: every ephemeral capability dies. */
    restart() {
      state.generation += 1;
      state.lease = null;
      state.cursors.clear();
    },

    /** Change a member's role server-side, as an admin would. */
    setRole(actor, role) {
      if (role === null) delete state.members[actor];
      else state.members[actor] = role;
      state.accessRevision += 1;
      if (state.lease && !may(state.lease.actor, "lease.engineering")) state.lease = null;
    },

    /** Inject a named fault that the next matching request must honor. */
    injectFault(name) {
      state.faults.add(name);
    },

    /** Read-only view for assertions. */
    inspect() {
      return {
        revision: state.revision,
        accessRevision: state.accessRevision,
        generation: state.generation,
        sequence: state.sequence,
        leaseHeld: state.lease !== null,
        leaseHolder: state.lease?.actor ?? null,
        serviceCalls: structuredClone(state.serviceCalls),
        evidence: structuredClone(state.evidence),
        telemetry: structuredClone(state.telemetry),
        cursors: state.cursors.size,
      };
    },

    /** Handle one WebSocket message from one actor's session. */
    handle(actor, session, message) {
      const type = String(message?.type ?? "");
      state.connections.set(session, actor);

      if (state.faults.has("authority_stale")) {
        state.faults.delete("authority_stale");
        return denied("authority_stale");
      }

      switch (type) {
        case "glt_flow_card/capabilities/get": {
          state.sequence += 1;
          return {
            result: {
              role: state.members[actor] ?? null,
              capabilities: capabilitiesOf(actor),
              policy_version: state.policyVersion,
              access_revision: state.accessRevision,
              sequence: state.sequence,
              generation: state.generation,
              expires_in: 300,
            },
          };
        }

        case "glt_flow_card/projects/list": {
          if (!may(actor, "project.list")) return { result: [] };
          return { result: [{ id: state.head?.project?.id, revision: state.revision }] };
        }

        case "glt_flow_card/projects/get": {
          if (!may(actor, "project.read")) return denied("not_found_or_denied");
          if (message.project_id !== state.head?.project?.id) {
            return denied("not_found_or_denied");
          }
          return { result: { id: message.project_id, revision: state.revision, config: structuredClone(state.head) } };
        }

        case "glt_flow_card/leases/acquire": {
          const purpose = message.purpose ?? "engineering";
          const capability = purpose === "administration" ? "lease.administration" : "lease.engineering";
          if (!may(actor, capability)) return denied("capability_denied");
          if (state.lease && state.lease.expiresAt > state.now) return denied("lease_held");
          const ttl = Number(message.ttl_seconds ?? 300);
          if (!Number.isInteger(ttl) || ttl < 60 || ttl > 900) return denied("invalid_input");
          state.lease = {
            token: randomUUID(),
            actor,
            session,
            purpose,
            generation: state.generation,
            accessRevision: state.accessRevision,
            expiresAt: state.now + ttl,
          };
          return { result: { lease_token: state.lease.token, expires_in: ttl, purpose } };
        }

        case "glt_flow_card/leases/renew": {
          if (!leaseValid(actor, session, message.lease_token)) return denied("lease_expired");
          const ttl = Number(message.ttl_seconds ?? 300);
          state.lease = { ...state.lease, token: randomUUID(), expiresAt: state.now + ttl };
          return { result: { lease_token: state.lease.token, expires_in: ttl } };
        }

        case "glt_flow_card/leases/release": {
          if (!leaseValid(actor, session, message.lease_token)) return denied("lease_expired");
          state.lease = null;
          return { result: { released: true } };
        }

        case "glt_flow_card/projects/apply": {
          if (!may(actor, "project.write")) return denied("capability_denied");
          if (!leaseValid(actor, session, message.lease_token)) {
            return denied(state.lease ? "lease_expired" : "lease_required");
          }
          if (Number(message.expected_revision) !== state.revision) {
            return denied("revision_conflict", {
              base_revision: Number(message.expected_revision),
              current_revision: state.revision,
              candidate_revision: Number(message.expected_revision),
            });
          }
          state.revision += 1;
          state.sequence += 1;
          state.head = structuredClone(message.candidate ?? state.head);
          state.evidence.unshift({
            id: `evidence-${state.evidence.length + 1}`,
            trusted: true,
            at: `t+${state.now}`,
            actor,
            action: "project.apply",
            revision: state.revision,
          });
          return { result: { revision: state.revision, digest: "e".repeat(64) } };
        }

        case "glt_flow_card/controls/execute": {
          if (!may(actor, "control.execute")) return denied("capability_denied");
          const leaked = FORBIDDEN_CONTROL_FIELDS.filter((field) => field in message);
          if (leaked.length > 0) return denied("invalid_input", { fields: leaked });
          const control = state.controls.find((entry) => entry.id === message.control_id);
          if (!control) return denied("not_found_or_denied");
          if (Number(message.expected_revision) !== state.revision) {
            return denied("revision_conflict", { current_revision: state.revision });
          }
          const correlation = randomUUID();
          state.serviceCalls.push({
            domain: control.domain,
            service: control.service,
            target: structuredClone(control.target),
            data: structuredClone(control.data ?? {}),
            actor,
          });
          const result = state.faults.has("control_timeout")
            ? "timed_out"
            : state.faults.has("control_unknown")
              ? "result_unknown"
              : "readback_confirmed";
          state.faults.delete("control_timeout");
          state.faults.delete("control_unknown");
          state.evidence.unshift({
            id: `evidence-${state.evidence.length + 1}`,
            trusted: true,
            at: `t+${state.now}`,
            actor,
            action: "control.execute",
            state: result,
            correlation_id: correlation,
          });
          return { result: { correlation_id: correlation, state: result } };
        }

        case "glt_flow_card/evidence/list": {
          if (!may(actor, "evidence.read")) return denied("not_found_or_denied");
          const cursorId = message.cursor;
          let offset = 0;
          if (cursorId !== undefined && cursorId !== null) {
            const cursor = state.cursors.get(cursorId);
            if (
              !cursor ||
              cursor.actor !== actor ||
              cursor.session !== session ||
              cursor.generation !== state.generation
            ) {
              return denied("invalid_input", { reason: "cursor_invalid" });
            }
            offset = cursor.offset;
          }
          const rows = state.evidence.slice(offset, offset + PAGE_SIZE);
          const hasMore = state.evidence.length > offset + rows.length;
          let nextCursor = null;
          if (hasMore) {
            nextCursor = randomUUID();
            state.cursors.set(nextCursor, {
              actor,
              session,
              generation: state.generation,
              offset: offset + rows.length,
            });
          }
          return { result: { rows: structuredClone(rows), cursor: nextCursor, has_more: hasMore } };
        }

        case "glt_flow_card/telemetry/add": {
          if (!may(actor, "evidence.telemetry.write")) return denied("capability_denied");
          state.telemetry.unshift({
            trusted: false,
            at: `t+${state.now}`,
            actor,
            payload: structuredClone(message.payload ?? {}),
          });
          return { result: { accepted: true } };
        }

        default:
          if (type.startsWith("glt_flow_card/remote/")) return denied("feature_unavailable");
          return denied("not_found_or_denied");
      }
    },
  };

  return coordinator;
}

/**
 * Mount one browser context against the shared coordinator as a named actor.
 *
 * Each context gets its own session identity and its own isolated storage, but
 * both talk to the same authority, which is what makes a two-session conflict
 * real rather than simulated.
 */
export async function installSharedAuthority(page, coordinator, options = {}) {
  const actor = options.actor ?? "engineer";
  const session = options.session ?? `${actor}-session-${Math.random().toString(36).slice(2, 10)}`;
  const bridge = "__gltAuthorityCall";

  await page.exposeFunction(bridge, (message) => coordinator.handle(actor, session, message));
  await installFakeHomeAssistant(page, { ...options, bridge });
  return { actor, session };
}
