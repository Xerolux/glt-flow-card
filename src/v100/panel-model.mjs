/**
 * Render the server-composed panel, and add no authority of its own.
 *
 * The browser renders the regions it is given, in the order it is given them.
 * It never derives a role, a capability or a control list: its capability
 * snapshot can be five minutes stale and would not see a revocation, so a
 * control it invented is a control the server would refuse.
 *
 * A region the server did not send is not rendered. An absent region and an
 * empty one are different renders and both are declared, because "nothing here"
 * and "nothing to show you" are different facts.
 */

/** The ordered region kinds. Closed: an unknown kind is an error. */
export const REGION_KINDS = Object.freeze([
  "identity", "state", "values", "runtime", "quality", "alarms", "controls", "trend",
]);

/** Declared empty text per region, so an empty region never renders blank. */
const EMPTY_TEXT = Object.freeze({
  values: "no_values_declared",
  alarms: "no_alarms",
  controls: "no_controls_available",
});

/** Regions whose emptiness is meaningful enough to need declared text. */
const CAN_BE_EMPTY = Object.freeze(Object.keys(EMPTY_TEXT));

function isEmpty(region) {
  if (region.kind === "values" || region.kind === "runtime") {
    return (region.values ?? []).length === 0;
  }
  if (region.kind === "alarms") return (region.alarms ?? []).length === 0;
  if (region.kind === "controls") return (region.controls ?? []).length === 0;
  return false;
}

/**
 * Reduce one panel response into render state.
 *
 * Throws on an unknown region kind rather than passing it through: a region
 * nobody validated is a region nobody can render, and silently dropping it
 * would hide a server change instead of reporting it.
 */
export function reducePanel(response) {
  if (!response || !Array.isArray(response.regions)) {
    throw new Error("panel response carries no regions");
  }
  const regions = response.regions.map((region) => {
    if (!region || !REGION_KINDS.includes(region.kind)) {
      throw new Error(`undeclared region kind: ${region?.kind}`);
    }
    const rendered = { ...region };
    if (CAN_BE_EMPTY.includes(region.kind) && isEmpty(region)) {
      rendered.empty = true;
      // The server may send its own text; the browser never invents content,
      // only the declared key for a state the server already reported.
      rendered.emptyText = region.emptyText ?? EMPTY_TEXT[region.kind];
    }
    return rendered;
  });

  return {
    objectId: response.object_id ?? null,
    regions,
    // Convenience only. Nothing downstream may use this to decide authority:
    // an empty list means the server sent none, never that the browser judged
    // the user unworthy of one.
    controls: regions
      .filter((region) => region.kind === "controls")
      .flatMap((region) => region.controls ?? []),
  };
}

/** Whether the panel declared its trend region unavailable, and why. */
export function trendState(rendered) {
  const region = rendered.regions.find((entry) => entry.kind === "trend");
  return region ? region.state ?? null : null;
}
