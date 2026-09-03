/**
 * Every custom element this artifact defines, recorded as it is defined.
 *
 * A sweep needs to know what to sweep. The alternatives are both bad in the way
 * this codebase keeps correcting:
 *
 * - **A hardcoded list in the test** silently skips a surface added later, and a
 *   suite that reports success for something it never ran is worse than no
 *   suite. That is precisely what the exact-dist runner did in Phase 9 until its
 *   drift guard was added.
 * - **Scraping the bundle text** cannot see an artifact loaded as an external
 *   script, which is how the shipped card is loaded.
 *
 * So registration records itself. `defineElement` is the one place an element is
 * defined, and the list it keeps is the authoritative answer to "what did this
 * artifact ship?" — usable by an accessibility sweep, by a coverage guard, and
 * by anyone debugging a card that is missing a tag.
 */

/** The tag names defined so far, in definition order. */
const DEFINED = [];

/**
 * Define one custom element and record it.
 *
 * Idempotent: defining a name twice is a no-op rather than a throw, because the
 * bundle can be evaluated twice in a page that loads two cards.
 */
export function defineElement(name, constructor) {
  if (customElements.get(name)) return false;
  customElements.define(name, constructor);
  DEFINED.push(name);
  publish();
  return true;
}

/** The tag names this artifact has defined, sorted. */
export function definedElements() {
  return [...DEFINED].sort();
}

/**
 * Publish the list where a sweep running in the page can read it.
 *
 * On `window` rather than only as an export, because the accessibility sweep
 * runs inside the page against the shipped bundle and has no module graph to
 * import from.
 */
function publish() {
  if (typeof window === "undefined") return;
  window.__gltRegisteredElements = definedElements();
}
