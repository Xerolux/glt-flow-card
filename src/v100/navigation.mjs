/**
 * The address is the state (NAV-01, T4-06).
 *
 * Everything needed to reconstruct a view lives in the address: node path,
 * selected time window, selected alarm. State kept only in a component cannot
 * be deep linked, and state kept in both drifts.
 *
 * Back and forward re-resolve through the server rather than replaying a cached
 * view. That costs one round trip per Back press and is the only way Back can
 * be correct after a revocation: the state object a page pushed was serialized
 * by a page that may have held a different authority, and in a restored session
 * it can be arbitrarily old.
 */

/** Mirrors the server's bounds. Both validate; neither trusts the other. */
export const MAX_ADDRESS_DEPTH = 32;
export const MAX_ADDRESS_LENGTH = 1024;
export const MAX_SEGMENT_LENGTH = 200;

/** The staleness reasons a view may report. Closed. */
export const STALENESS_REASONS = Object.freeze([
  "sequence-gap", "reconnect", "revocation", "incompatible-snapshot",
]);

const SEGMENT = /^[A-Za-z0-9_\-.~:@+]+$/;

function validSegment(segment) {
  if (typeof segment !== "string") return false;
  if (segment.length === 0 || segment.length > MAX_SEGMENT_LENGTH) return false;
  if (segment === "." || segment === "..") return false;
  return SEGMENT.test(segment);
}

/**
 * Serialize an address. The node path is the base; window and alarm are query
 * parameters so a link without them is the shortest thing that still works.
 */
export function serializeAddress(address) {
  if (!address || !Array.isArray(address.node) || address.node.length === 0) {
    throw new Error("an address needs at least one node segment");
  }
  for (const segment of address.node) {
    if (!validSegment(segment)) throw new Error(`malformed segment: ${segment}`);
  }
  const parameters = [];
  if (address.window) {
    parameters.push(`from=${encodeURIComponent(address.window.from)}`);
    parameters.push(`to=${encodeURIComponent(address.window.to)}`);
  }
  if (address.alarm) parameters.push(`alarm=${encodeURIComponent(address.alarm)}`);
  const path = address.node.join("/");
  return parameters.length > 0 ? `${path}?${parameters.join("&")}` : path;
}

/** Parse an address, refusing anything malformed rather than half-accepting it. */
export function parseAddress(serialized) {
  if (typeof serialized !== "string" || serialized.length === 0) {
    throw new Error("empty address");
  }
  if (serialized.length > MAX_ADDRESS_LENGTH) throw new Error("address too long");

  const [path, query = ""] = serialized.split("?");
  const node = path.split("/");
  if (node.length > MAX_ADDRESS_DEPTH) throw new Error("address too deep");
  for (const segment of node) {
    if (!validSegment(segment)) throw new Error(`malformed segment: ${segment}`);
  }

  const parameters = new URLSearchParams(query);
  const from = parameters.get("from");
  const to = parameters.get("to");
  if ((from === null) !== (to === null)) {
    throw new Error("a time window needs both ends");
  }
  return {
    node,
    window: from === null ? null : { from, to },
    alarm: parameters.get("alarm"),
  };
}

/**
 * A navigation reducer that re-resolves on every transition.
 *
 * `resolve` is the only way it learns anything. It holds no cached view, so
 * there is nothing stale to replay, and `history` is injectable so this is
 * testable without a browser.
 */
export function createNavigation({ resolve, history = null } = {}) {
  if (typeof resolve !== "function") throw new Error("navigation needs a resolver");
  const stack = [];
  let index = -1;
  let current = null;
  // Set while this reducer is the cause of a history change, so its own
  // pushState does not come back as a navigation and resolve twice.
  let pushing = false;

  async function apply(address) {
    current = await resolve(address);
    return current;
  }

  return {
    async go(address) {
      const serialized = serializeAddress(address);
      stack.splice(index + 1);
      stack.push(serialized);
      index = stack.length - 1;
      if (history && typeof history.pushState === "function") {
        pushing = true;
        try {
          // Only the address string is pushed. Trusting a richer state object
          // would mean trusting a serialization made under other authority.
          history.pushState({ address: serialized }, "", `#${serialized}`);
        } finally {
          pushing = false;
        }
      }
      return apply(address);
    },

    async back() {
      if (index <= 0) return current;
      index -= 1;
      return apply(parseAddress(stack[index]));
    },

    async forward() {
      if (index >= stack.length - 1) return current;
      index += 1;
      return apply(parseAddress(stack[index]));
    },

    /** Handle a popstate. Re-resolves; never restores a cached view. */
    async popped(state) {
      if (pushing) return current;
      const serialized = typeof state?.address === "string" ? state.address : null;
      if (serialized === null) return current;
      return apply(parseAddress(serialized));
    },

    /**
     * Breadcrumbs come from the server-returned ancestry only. A locally
     * cached tree can outlive the membership that admitted it, and a
     * breadcrumb is a link.
     */
    breadcrumbs(resolution) {
      const ancestry = resolution?.ancestry;
      if (!Array.isArray(ancestry)) return [];
      return ancestry.map((entry, position) => ({
        id: entry.id,
        name: entry.name ?? entry.id,
        level: entry.level ?? null,
        address: ancestry.slice(0, position + 1).map((step) => step.id).join("/"),
        current: position === ancestry.length - 1,
      }));
    },

    state() {
      return current;
    },
  };
}
