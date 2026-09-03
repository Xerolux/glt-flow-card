/* Configured controls in the browser: name the control, never the effect.
 *
 * A request may carry only a control identifier, the revision it believes it is
 * acting on, and the bounded input the control's own schema declares. The
 * domain, the service and the target are the server's to resolve from the
 * verified head, so they never appear in a form field, a request body, or the
 * DOM as anything but a read-only summary the server itself produced.
 *
 * There is deliberately no retry entry point in this module. A control that may
 * already have moved a physical thing is repaired forward by a person deciding
 * to act again, never by code deciding for them.
 */

/** Every authoritative control lifecycle state, in the contract's order. */
export const CONTROL_RESULT_STATES = Object.freeze([
  "accepted",
  "dispatched",
  "readback_confirmed",
  "timed_out",
  "denied",
  "failed_before_dispatch",
  "failed_after_dispatch",
  "result_unknown",
  "cancelled_before_dispatch",
]);

/**
 * The only state the UI may present as a completed successful action.
 *
 * `accepted` means the server wrote it down. `dispatched` means Home Assistant
 * was asked. Neither means the plant moved, and calling either a success is the
 * exact lie this list exists to prevent.
 */
export const CONTROL_SUCCESS_STATES = Object.freeze(["readback_confirmed"]);

/** States after which nothing further will arrive for this correlation. */
export const CONTROL_TERMINAL_STATES = Object.freeze([
  "readback_confirmed",
  "timed_out",
  "denied",
  "failed_before_dispatch",
  "failed_after_dispatch",
  "result_unknown",
  "cancelled_before_dispatch",
]);

/**
 * States where the effect on the plant is genuinely unknown.
 *
 * These direct the user to the current state and the trusted audit rather than
 * to a retry button.
 */
export const CONTROL_UNKNOWN_STATES = Object.freeze([
  "timed_out",
  "result_unknown",
  "failed_after_dispatch",
]);

/** Fields a control request may never carry; the server owns every one. */
const FORBIDDEN_REQUEST_FIELDS = Object.freeze([
  "domain",
  "service",
  "entity_id",
  "device_id",
  "area_id",
  "target",
  "service_data",
  "context",
  "user_id",
]);

export function initialControlState() {
  return {
    phase: "idle",
    controlId: null,
    preview: null,
    result: null,
    correlationId: null,
    error: null,
    announcement: null,
  };
}

/** Whether a lifecycle state may be shown as a completed successful action. */
export function isControlSuccess(state) {
  return CONTROL_SUCCESS_STATES.includes(state);
}

/** Whether the effect on the plant is unknown and needs a person to look. */
export function isControlUnknown(state) {
  return CONTROL_UNKNOWN_STATES.includes(state);
}

/**
 * Apply one control lifecycle action.
 *
 * A state the contract does not name is refused rather than displayed: an
 * unknown result string rendered verbatim is a way for a server response to
 * write arbitrary text into a safety-critical status line.
 */
export function reduceControlEvidence(state, action) {
  const current = state ?? initialControlState();
  const type = String(action?.type ?? "");
  const next = { ...current };

  switch (type) {
    case "control/selected": {
      next.phase = "ready";
      next.controlId = action.controlId ?? null;
      next.preview = null;
      next.result = null;
      next.correlationId = null;
      next.error = null;
      return next;
    }

    case "control/preview": {
      next.phase = "confirm";
      // The preview is the server's own normalized summary. It is displayed,
      // never echoed back: execute re-resolves everything from the head again.
      next.preview = action.preview ?? null;
      next.error = null;
      return next;
    }

    case "control/cancelled": {
      next.phase = "ready";
      next.preview = null;
      next.result = "cancelled_before_dispatch";
      next.announcement = { level: "polite", code: "cancelled_before_dispatch" };
      return next;
    }

    case "control/pending": {
      next.phase = "pending";
      next.result = null;
      next.correlationId = action.correlationId ?? null;
      return next;
    }

    case "control/result": {
      const result = String(action.state ?? "");
      if (!CONTROL_RESULT_STATES.includes(result)) {
        next.phase = "result";
        next.result = "result_unknown";
        next.announcement = { level: "assertive", code: "result_unknown" };
        return next;
      }
      next.phase = CONTROL_TERMINAL_STATES.includes(result) ? "result" : "pending";
      next.result = result;
      next.correlationId = action.correlationId ?? next.correlationId;
      next.announcement = {
        level: isControlSuccess(result) ? "polite" : "assertive",
        code: result,
      };
      return next;
    }

    case "control/denied": {
      next.phase = "result";
      next.result = "denied";
      next.error = { code: action.code ?? "effect_unknown" };
      next.announcement = { level: "assertive", code: "denied" };
      return next;
    }

    default:
      return current;
  }
}

/**
 * Talk to the configured-control routes.
 *
 * The request body is assembled here and carries the control id, the expected
 * revision and the declared input only. A caller-supplied field that names an
 * effect is dropped before the request is built, so a compromised caller cannot
 * smuggle a target past the server's own refusal.
 */
export function createConfiguredControlClient(options = {}) {
  const hass = options.hass ?? null;
  const projectId = options.projectId ?? null;
  const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
  let state = initialControlState();

  const dispatch = (action) => {
    state = reduceControlEvidence(state, action);
    onChange(state);
    return state;
  };

  const bounded = (input) => {
    const payload = {};
    for (const [key, value] of Object.entries(input ?? {})) {
      if (FORBIDDEN_REQUEST_FIELDS.includes(key)) continue;
      payload[key] = value;
    }
    return payload;
  };

  const call = async (type, payload) => {
    if (!hass?.callWS) throw Object.assign(new Error("not_loaded"), { code: "not_loaded" });
    return hass.callWS({ type, project_id: projectId, ...payload });
  };

  return {
    get state() {
      return state;
    },

    select(controlId) {
      return dispatch({ type: "control/selected", controlId });
    },

    cancel() {
      return dispatch({ type: "control/cancelled" });
    },

    /** Ask the server what this control would do. Nothing is dispatched. */
    async preview(controlId, input, expectedRevision) {
      try {
        const preview = await call("glt_flow_card/controls/preview", {
          control_id: controlId,
          expected_revision: expectedRevision,
          input: bounded(input),
        });
        return dispatch({ type: "control/preview", preview });
      } catch (error) {
        return dispatch({ type: "control/denied", code: error?.code });
      }
    },

    /**
     * Execute once.
     *
     * Whatever comes back - confirmed, timed out, unknown - is reported as it
     * is. This function is the only dispatch path in the module, and it is
     * never called by anything but a person pressing the confirmation.
     */
    async execute(controlId, input, expectedRevision) {
      dispatch({ type: "control/pending" });
      try {
        const result = await call("glt_flow_card/controls/execute", {
          control_id: controlId,
          expected_revision: expectedRevision,
          input: bounded(input),
        });
        return dispatch({
          type: "control/result",
          state: result?.state,
          correlationId: result?.correlation_id,
        });
      } catch (error) {
        return dispatch({ type: "control/denied", code: error?.code });
      }
    },
  };
}
