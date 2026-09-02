/**
 * A contribution is data, and cannot become code (SDK-01, T5-12).
 *
 * The decision behind this module, settled with the user and recorded as F-01
 * in FUTURE-ROADMAP.md: a contribution is pure data, interpreted by first-party
 * code. No contributed JavaScript is loaded, evaluated or executed, in any
 * realm. Same-realm JavaScript is not a sandbox, and a Worker behind a message
 * contract is a larger phase than this one.
 *
 * Not executing is necessary and not sufficient. A declarative SVG contribution
 * can still carry `<script>`, an `onload` attribute, an `href` to somewhere on
 * the internet, or a `<foreignObject>` full of arbitrary markup. So this
 * allowlists elements and attributes rather than denylisting the dangerous
 * ones: a denylist is a promise to have thought of everything, and the list of
 * things nobody thought of is exactly the list that matters.
 *
 * Bounds are checked before anything is interpreted. An oversized manifest is
 * refused by its length, not by the parser giving up part way through — a
 * parser that has already started is a parser that can be made to work.
 */

/** What a contribution may be. Closed. */
export const CONTRIBUTION_KINDS = Object.freeze([
  "symbol", "profile", "template", "descriptor", "translation",
]);

/** Project schema versions a manifest may declare support for. */
export const SUPPORTED_SCHEMA_VERSIONS = Object.freeze([0, 1, 2, 3, 4]);

/**
 * Everything checked before the manifest is interpreted.
 *
 * These are refusals, not capacity claims: they bound what an installation can
 * be made to do by a file it was handed, and say nothing about how much a
 * healthy installation handles.
 */
export const MANIFEST_LIMITS = Object.freeze({
  max_bytes: 262144,
  max_contributions: 256,
  max_markup_bytes: 32768,
  max_markup_elements: 512,
  max_markup_depth: 16,
  max_attributes_per_element: 32,
  max_namespace_length: 64,
});

/**
 * The elements a contribution may draw with.
 *
 * Deliberately absent: `use` and `image` (they reference), `script` and
 * `style` (they execute or restyle the host), `foreignObject` and `iframe`
 * (they embed a different document), `animate` and `set` (they mutate),
 * `a` (it navigates), `filter`, `marker` and `pattern` (they reference by url).
 */
export const ALLOWED_ELEMENTS = Object.freeze([
  "svg", "g", "title", "desc", "defs",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan",
  "linearGradient", "radialGradient", "stop",
]);

/** The attributes those elements may carry. `data-` is allowed by prefix. */
export const ALLOWED_ATTRIBUTES = Object.freeze([
  "id", "class", "viewBox", "xmlns", "preserveAspectRatio", "transform",
  "d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "dx", "dy", "offset",
  "fill", "fill-opacity", "fill-rule", "opacity",
  "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-dashoffset", "stroke-opacity",
  "text-anchor", "dominant-baseline", "font-size", "font-weight", "font-family",
  "stop-color", "stop-opacity", "gradientUnits", "gradientTransform",
  "role", "aria-label", "aria-hidden",
]);

/** Every way a manifest can be refused. Closed, for the same reason ports' is. */
export const MANIFEST_REFUSALS = Object.freeze([
  "manifest_too_large", "manifest_not_json", "manifest_not_an_object",
  "namespace_missing", "namespace_malformed", "version_missing",
  "schema_versions_missing", "schema_versions_unsupported",
  "contributions_missing", "too_many_contributions",
  "contribution_id_missing", "contribution_outside_namespace",
  "contribution_kind_unknown", "contribution_payload_missing",
  "markup_too_large", "markup_too_deep", "markup_too_many_elements",
  "too_many_attributes", "malformed_markup",
  "script_element", "event_handler_attribute", "external_reference",
  "foreign_object", "unknown_element", "unknown_attribute", "javascript_url",
  "data_url", "doctype_declaration",
]);

const ELEMENTS = new Set(ALLOWED_ELEMENTS);
const ATTRIBUTES = new Set(ALLOWED_ATTRIBUTES);
const KINDS = new Set(CONTRIBUTION_KINDS);
const VERSIONS = new Set(SUPPORTED_SCHEMA_VERSIONS);

/** Elements refused by name rather than by absence, so the reason is specific. */
const NAMED_REFUSALS = new Map([
  ["script", "script_element"],
  ["foreignobject", "foreign_object"],
]);

const NAMESPACE = /^[a-z0-9][a-z0-9._-]{0,62}[a-z0-9]$/;
const REFERENCE_ATTRIBUTES = new Set(["href", "xlink:href", "src", "xlink:src"]);

function issue(code, path, detail) {
  return { code, path, detail: detail ?? null };
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

/**
 * Resolve the character entities an attacker can hide a scheme behind.
 *
 * `java&#115;cript:` is the same URL as `javascript:` by the time a browser
 * reads it, and a check that runs before this one is checking a string nobody
 * will ever use.
 */
function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/giu, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/gu, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&(amp|lt|gt|quot|apos|tab|newline);?/giu, (_, name) => (
      { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", tab: "\t", newline: "\n" }[name.toLowerCase()]
    ));
}

/**
 * The scheme a URL actually carries, once the ways of hiding one are undone.
 *
 * `javascript:` and `vbscript:` run. `data:` does not reach the network but
 * inlines a whole document of somebody else\'s choosing, which is a different
 * problem and gets a different name — a refusal that calls a data URL a
 * JavaScript URL sends a pack author looking for script they did not write.
 */
function dangerousScheme(value) {
  const collapsed = decodeEntities(value).replace(/[\u0000-\u0020]/gu, "");
  if (/^(?:javascript|vbscript):/iu.test(collapsed)) return "javascript_url";
  if (/^data:/iu.test(collapsed)) return "data_url";
  return null;
}

const ATTRIBUTE_PATTERN = /([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gu;
const TAG_PATTERN = /<\/?([A-Za-z_][A-Za-z0-9_.:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)\/?>/gu;

/**
 * Walk contributed markup and report everything wrong with it.
 *
 * Attributes are checked on every element, including one whose name is already
 * refused. A `<a href="javascript:...">` should be reported for both reasons:
 * telling a pack author only that `a` is not allowed teaches them to reach for
 * an element that is, with the same URL still in it.
 */
export function validateMarkup(markup, path = "/payload/markup") {
  const errors = [];
  if (typeof markup !== "string") {
    return [issue("malformed_markup", path, { reason: "not a string" })];
  }
  if (byteLength(markup) > MANIFEST_LIMITS.max_markup_bytes) {
    return [issue("markup_too_large", path, { limit: MANIFEST_LIMITS.max_markup_bytes })];
  }
  if (/<!\s*(doctype|entity)/iu.test(markup)) {
    // Refused outright: an internal subset is where entity expansion lives, and
    // no contribution has ever needed one.
    return [issue("doctype_declaration", path)];
  }

  const stripped = markup
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gu, "");

  let depth = 0;
  let elements = 0;
  let maxDepth = 0;
  const seen = new Set();

  for (const match of stripped.matchAll(TAG_PATTERN)) {
    const [tag, rawName, rawAttributes = ""] = match;
    const closing = tag.startsWith("</");
    const selfClosing = /\/>$/u.test(tag);
    const name = rawName;
    const lowered = name.toLowerCase();

    if (closing) {
      depth -= 1;
      if (depth < 0) {
        errors.push(issue("malformed_markup", path, { reason: `unbalanced </${name}>` }));
        break;
      }
      continue;
    }

    elements += 1;
    if (elements > MANIFEST_LIMITS.max_markup_elements) {
      errors.push(issue("markup_too_many_elements", path, {
        limit: MANIFEST_LIMITS.max_markup_elements,
      }));
      break;
    }

    const named = NAMED_REFUSALS.get(lowered);
    if (named) {
      if (!seen.has(named)) errors.push(issue(named, `${path}/${name}`));
      seen.add(named);
    } else if (!ELEMENTS.has(name)) {
      errors.push(issue("unknown_element", `${path}/${name}`, { element: name }));
    }

    let attributeCount = 0;
    for (const attribute of rawAttributes.matchAll(ATTRIBUTE_PATTERN)) {
      const [, attributeName, doubleQuoted, singleQuoted, bare] = attribute;
      const value = doubleQuoted ?? singleQuoted ?? bare ?? "";
      attributeCount += 1;
      if (attributeCount > MANIFEST_LIMITS.max_attributes_per_element) {
        errors.push(issue("too_many_attributes", `${path}/${name}`, {
          limit: MANIFEST_LIMITS.max_attributes_per_element,
        }));
        break;
      }
      const attributePath = `${path}/${name}@${attributeName}`;

      if (/^on/iu.test(attributeName)) {
        errors.push(issue("event_handler_attribute", attributePath, { attribute: attributeName }));
        continue;
      }
      const scheme = dangerousScheme(value);
      if (scheme) {
        errors.push(issue(scheme, attributePath, { attribute: attributeName }));
        continue;
      }
      if (REFERENCE_ATTRIBUTES.has(attributeName.toLowerCase())) {
        // A same-document fragment is the only reference that reaches nothing.
        if (!/^#[A-Za-z0-9_.:-]+$/u.test(value)) {
          errors.push(issue("external_reference", attributePath, { value }));
        }
        continue;
      }
      if (/\burl\(\s*['"]?(?!#)/iu.test(decodeEntities(value))) {
        errors.push(issue("external_reference", attributePath, { value }));
        continue;
      }
      if (attributeName.startsWith("data-") || attributeName === "xml:space") continue;
      if (!ATTRIBUTES.has(attributeName)) {
        errors.push(issue("unknown_attribute", attributePath, { attribute: attributeName }));
      }
    }

    if (!selfClosing) {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
      if (maxDepth > MANIFEST_LIMITS.max_markup_depth) {
        errors.push(issue("markup_too_deep", path, { limit: MANIFEST_LIMITS.max_markup_depth }));
        break;
      }
    }
  }

  return errors;
}

function validateContribution(contribution, index, namespace) {
  const path = `/contributions/${index}`;
  const errors = [];
  if (!contribution || typeof contribution !== "object" || Array.isArray(contribution)) {
    return [issue("contribution_payload_missing", path, { reason: "not an object" })];
  }
  const { id, kind, payload } = contribution;
  if (typeof id !== "string" || id.length === 0) {
    errors.push(issue("contribution_id_missing", `${path}/id`));
  } else if (!id.startsWith(`${namespace}/`) || id.length === namespace.length + 1) {
    // A pack that can name a contribution outside its namespace can shadow
    // another pack's, and installation order decides which one wins.
    errors.push(issue("contribution_outside_namespace", `${path}/id`, { id, namespace }));
  }
  if (!KINDS.has(kind)) {
    errors.push(issue("contribution_kind_unknown", `${path}/kind`, { kind: kind ?? null }));
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    errors.push(issue("contribution_payload_missing", `${path}/payload`));
    return errors;
  }
  if (payload.markup !== undefined) {
    errors.push(...validateMarkup(payload.markup, `${path}/payload/markup`));
  }
  return errors;
}

function result(errors) {
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

/**
 * Validate an extension manifest, given either the bytes as received or an
 * already-parsed object.
 *
 * Bytes are the real boundary: an installation is handed a file, and the size
 * check has to happen before the parser sees it. An object is accepted too,
 * because the browser half of the SDK already holds one, and it is measured by
 * serializing it rather than trusted for being in memory already.
 */
export function validateManifest(input) {
  let document = input;
  if (typeof input === "string") {
    if (byteLength(input) > MANIFEST_LIMITS.max_bytes) {
      return result([issue("manifest_too_large", "/", { limit: MANIFEST_LIMITS.max_bytes })]);
    }
    try {
      document = JSON.parse(input);
    } catch (error) {
      return result([issue("manifest_not_json", "/", { reason: error.message })]);
    }
  } else if (input && typeof input === "object") {
    let serialized;
    try {
      serialized = JSON.stringify(input);
    } catch (error) {
      return result([issue("manifest_not_json", "/", { reason: error.message })]);
    }
    if (byteLength(serialized ?? "") > MANIFEST_LIMITS.max_bytes) {
      return result([issue("manifest_too_large", "/", { limit: MANIFEST_LIMITS.max_bytes })]);
    }
  }

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return result([issue("manifest_not_an_object", "/")]);
  }

  const errors = [];
  const namespace = document.namespace;
  if (typeof namespace !== "string" || namespace.length === 0) {
    errors.push(issue("namespace_missing", "/namespace"));
  } else if (namespace.length > MANIFEST_LIMITS.max_namespace_length || !NAMESPACE.test(namespace)) {
    errors.push(issue("namespace_malformed", "/namespace", { namespace }));
  }

  if (typeof document.version !== "string" || document.version.length === 0) {
    errors.push(issue("version_missing", "/version"));
  }

  const versions = document.supports_schema_versions;
  if (!Array.isArray(versions) || versions.length === 0) {
    errors.push(issue("schema_versions_missing", "/supports_schema_versions"));
  } else {
    const unsupported = versions.filter((version) => !VERSIONS.has(version));
    if (unsupported.length > 0) {
      // Refusing beats degrading: a pack that declares a version this card does
      // not have cannot be read safely by guessing which parts still apply.
      errors.push(issue("schema_versions_unsupported", "/supports_schema_versions", {
        unsupported,
        supported: [...SUPPORTED_SCHEMA_VERSIONS],
      }));
    }
  }

  const contributions = document.contributions;
  if (!Array.isArray(contributions)) {
    errors.push(issue("contributions_missing", "/contributions"));
    return result(errors);
  }
  if (contributions.length > MANIFEST_LIMITS.max_contributions) {
    errors.push(issue("too_many_contributions", "/contributions", {
      limit: MANIFEST_LIMITS.max_contributions,
    }));
    return result(errors);
  }
  for (const [index, contribution] of contributions.entries()) {
    errors.push(...validateContribution(contribution, index, namespace));
  }
  return result(errors);
}
