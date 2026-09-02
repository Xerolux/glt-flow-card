/**
 * The status palette, with a contrast ratio behind every colour.
 *
 * The shipped values were designed against a dark ground and used on both:
 *
 * | colour    | on white |
 * |-----------|----------|
 * | `#31d879` | 1.87 : 1 |
 * | `#36c7ff` | 1.95 : 1 |
 * | `#ff9f1c` | 2.05 : 1 |
 * | `#ff4f4f` | 3.24 : 1 |
 *
 * WCAG AA asks 4.5 : 1 for normal text. All four fail on a light theme, and the
 * worst of them is more than twice under. On a bright control-room screen that
 * is not a preference: an operator reads "live" and "stale" as the same pale
 * smudge, in exactly the surfaces built to tell them apart.
 *
 * **This is a contrast fix, not a colour-coding fix.** Every one of these
 * surfaces already carries its state as a word and a shape — that rule predates
 * this phase and is asserted with colour removed. Colour is the redundant
 * channel here, and it still has to be legible to the people using it.
 *
 * Each entry names its light and dark value and the ratio each achieves against
 * its own ground, so a later change can be checked rather than eyeballed.
 */

/** The ground each variant is measured against. */
export const GROUNDS = Object.freeze({ dark: "#12181f", light: "#ffffff" });

/**
 * Tone → the two values and their measured ratios.
 *
 * Ratios recorded rather than recomputed at runtime: a number in a comment
 * drifts, and a number in the data can be asserted by a test.
 */
export const STATUS_COLOURS = Object.freeze({
  error: Object.freeze({ dark: "#ff8a80", darkRatio: 7.82, light: "#b3261e", lightRatio: 6.54 }),
  info: Object.freeze({ dark: "#36c7ff", darkRatio: 9.16, light: "#0f6d99", lightRatio: 5.73 }),
  muted: Object.freeze({ dark: "#9fb2c4", darkRatio: 8.32, light: "#5f7288", lightRatio: 4.94 }),
  success: Object.freeze({ dark: "#31d879", darkRatio: 9.55, light: "#0b6b38", lightRatio: 6.62 }),
  warning: Object.freeze({ dark: "#ff9f1c", darkRatio: 8.70, light: "#8a5200", lightRatio: 6.39 }),
});

/** The AA threshold for normal text. Named so a test cannot quietly lower it. */
export const AA_NORMAL_TEXT = 4.5;

/**
 * The custom properties every surface's stylesheet inherits.
 *
 * Emitted once and shared, because five stylesheets each carrying their own
 * hex values is five places for the next contrast regression to hide — which is
 * how these four ended up in five files.
 */
export function statusColourStyles() {
  const declare = (variant) => Object.entries(STATUS_COLOURS)
    .map(([tone, value]) => `    --glt-${tone}:${value[variant]};`)
    .join("\n");
  return `
  :host,:root{
${declare("light")}
  }
  @media(prefers-color-scheme:dark){
    :host,:root{
${declare("dark")}
    }
  }`;
}

/** The WCAG relative luminance of one hex colour. */
export function luminance(hex) {
  const channel = (value) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** The contrast ratio between two hex colours. */
export function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
