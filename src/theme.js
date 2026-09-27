/**
 * Colour themes. The stylesheets are written for the original purple theme;
 * other themes recolour every colour in them at run time, by rules of colour
 * theory, so the CSS stays readable and a new colour needs no extra work.
 *
 * - verde: green base (hue 150). Pink (its complement) and gold (a warm
 *   neighbour) stay as accents; mint, too close to the base, becomes lilac.
 * - preto: neutral charcoal base; saturated accents for maximum contrast.
 * - claro: light backgrounds and dark text; the accents keep their colour.
 */
export const THEMES = {
  roxo: { label: "Roxo", swatch: ["#201744", "#ffd354", "#70f2be"] },
  verde: { label: "Verde", swatch: ["#113a2c", "#ffd354", "#ff78b0"] },
  preto: { label: "Preto", swatch: ["#111111", "#ffd354", "#70f2be"] },
  claro: { label: "Claro", swatch: ["#f3f0fa", "#7a5a00", "#5b3fa0"] },
};
export const THEME_KEY = "tic-quest.theme";

function rgbToHsl(r, g, b) {
  ((r /= 255), (g /= 255), (b /= 255));
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min,
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}

// Text properties: light text becomes dark on light backgrounds.
const TEXT =
  /^(color|caret-color|-webkit-text-fill-color|text-decoration-color|column-rule-color)$/;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Transform one colour for a theme; `property` tells text from surfaces. */
export function themeColor(theme, property, [r, g, b, a = 1]) {
  if (theme === "roxo" || !THEMES[theme]) return [r, g, b, a];
  let [h, s, l] = rgbToHsl(r, g, b);
  const base = s < 0.12 || (h >= 225 && h <= 320), // purples and greys
    mint = h >= 130 && h <= 185 && s >= 0.35;
  if (theme === "verde") {
    if (base) h = h - 115;
    else if (mint) h = 270; // lilac accent instead of a second green
  } else if (theme === "preto") {
    if (base) {
      s = s * 0.12;
      l = l * 0.72;
    }
  } else if (theme === "claro") {
    if (TEXT.test(property)) {
      // Light text → dark text; dark text (on gold buttons) stays dark.
      if (l > 0.55) {
        l = clamp(1.05 - l, 0.14, 0.32);
        s = Math.min(s, 0.55);
      }
    } else if (base) {
      l = clamp(1 - l * 0.6, 0.08, 0.97);
      s = s * 0.55;
    } else if (l < 0.4) {
      // Dark coloured surfaces (status bands, notices) → pale tint of the
      // same colour, so dark text stays readable on them.
      l = clamp(1 - l * 0.6, 0.75, 0.93);
      s = Math.min(s, 0.6);
    } else if (l > 0.8) {
      l = 0.9; // pale accent surfaces stay pale
    }
  }
  return [...hslToRgb(h, s, l), a];
}

const COLOR =
  /rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+%?))?\s*\)|#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(white|black)\b/gi;
function parse(match) {
  const [text, r, g, b, alpha, hex, named] = match;
  if (named)
    return named.toLowerCase() === "white" ? [255, 255, 255, 1] : [0, 0, 0, 1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
    const n = (i) => parseInt(full.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1];
  }
  const a =
    alpha === undefined
      ? 1
      : alpha.endsWith("%")
        ? parseFloat(alpha) / 100
        : parseFloat(alpha);
  void text;
  return [Number(r), Number(g), Number(b), a];
}
const format = ([r, g, b, a]) =>
  a >= 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`;

/** Recolour every colour in a CSS value. */
export function themeValue(theme, property, value) {
  return value.replace(COLOR, (...m) =>
    format(themeColor(theme, property, parse(m))),
  );
}

// Original declarations of each stylesheet, so switching themes always
// starts from the purple original.
const originals = new WeakMap();
function styleRules(list, out = []) {
  for (const rule of list) {
    if (rule.style) out.push(rule);
    if (rule.cssRules) styleRules(rule.cssRules, out);
  }
  return out;
}

/**
 * Declarations as written in the rule's text. Shorthands that use var()
 * (e.g. "background: var(--bg)") are not split into longhands by the
 * browser, so the text is the only place to find them.
 */
function declarations(cssText) {
  const out = [];
  let depth = 0,
    current = "";
  const push = (text) => {
    const i = text.indexOf(":");
    if (i < 0) return;
    const name = text.slice(0, i).trim(),
      raw = text.slice(i + 1).trim(),
      important = /!\s*important$/i.test(raw);
    out.push([
      name,
      raw.replace(/\s*!\s*important$/i, ""),
      important ? "important" : "",
    ]);
  };
  for (const ch of cssText) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === ";" && !depth) {
      push(current);
      current = "";
    } else current += ch;
  }
  push(current);
  return out;
}

function appSheets(doc) {
  const out = [];
  for (const sheet of doc.styleSheets) {
    if (!sheet.href || !/assets\/css\//.test(sheet.href)) continue;
    try {
      if (!originals.has(sheet))
        originals.set(
          sheet,
          styleRules(sheet.cssRules).map((rule) => [
            rule,
            declarations(rule.style.cssText),
          ]),
        );
      out.push(sheet);
    } catch {
      // A stylesheet that cannot be read (still loading) keeps its colours.
    }
  }
  return out;
}

/** Apply a theme to every app stylesheet of a document (main or projector). */
export function applyTheme(doc, theme) {
  const root = doc.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "claro" ? "light" : "dark";
  const sheets = appSheets(doc);
  // Custom properties (--gold…) are replaced by their values, so each use is
  // recoloured for its own property (text or surface). Later sheets win.
  const vars = {};
  for (const sheet of sheets)
    for (const [rule, decls] of originals.get(sheet))
      if (rule.selectorText === ":root")
        for (const [name, value] of decls)
          if (name.startsWith("--")) vars[name] = value.trim();
  for (const sheet of sheets)
    for (const [rule, decls] of originals.get(sheet))
      for (const [name, value, priority] of decls) {
        if (name.startsWith("--")) continue;
        const next =
          theme === "roxo"
            ? value
            : themeValue(
                theme,
                name,
                value.replace(
                  /var\(\s*(--[\w-]+)\s*\)/g,
                  (m, v) => vars[v] ?? m,
                ),
              );
        if (rule.style.getPropertyValue(name) !== next)
          rule.style.setProperty(name, next, priority);
      }
}
