import test from "node:test";
import assert from "node:assert/strict";
import { THEMES, themeColor, themeValue } from "../src/theme.js";

const hue = ([r, g, b]) => {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (!d) return 0;
  const h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return h * 60;
};
const light = ([r, g, b]) => (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
const PURPLE_BG = [32, 23, 68], // --bg
  CREAM_TEXT = [255, 245, 214], // --cream
  GOLD = [255, 211, 84],
  MINT = [112, 242, 190],
  INK = [18, 13, 48];

test("four themes; the purple original is unchanged", () => {
  assert.deepEqual(Object.keys(THEMES), ["roxo", "verde", "preto", "claro"]);
  assert.deepEqual(themeColor("roxo", "background-color", PURPLE_BG), [
    ...PURPLE_BG,
    1,
  ]);
});

test("verde: purple base turns green; mint accent turns lilac; gold stays", () => {
  const bg = themeColor("verde", "background-color", PURPLE_BG);
  assert.ok(hue(bg) > 130 && hue(bg) < 170, "green base");
  const mint = themeColor("verde", "background-color", MINT);
  assert.ok(hue(mint) > 255 && hue(mint) < 285, "lilac accent");
  assert.deepEqual(themeColor("verde", "background-color", GOLD), [...GOLD, 1]);
});

test("preto: base becomes near-neutral charcoal; accents keep their colour", () => {
  const [r, g, b] = themeColor("preto", "background-color", PURPLE_BG);
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) < 8, "almost grey");
  assert.ok(light([r, g, b]) < 0.15, "dark");
  assert.deepEqual(themeColor("preto", "color", GOLD), [...GOLD, 1]);
});

test("claro: dark surfaces become light, light text becomes dark, dark text stays", () => {
  assert.ok(light(themeColor("claro", "background-color", PURPLE_BG)) > 0.85);
  assert.ok(light(themeColor("claro", "color", CREAM_TEXT)) < 0.35);
  // Ink on gold buttons stays dark, so the button stays readable.
  assert.ok(light(themeColor("claro", "color", INK)) < 0.15);
  assert.deepEqual(themeColor("claro", "background-color", GOLD), [...GOLD, 1]);
});

test("every colour in a CSS value is recoloured, keeping transparency", () => {
  const out = themeValue(
    "preto",
    "background-image",
    "linear-gradient(90deg, rgba(33, 25, 66, 0.133) 1px, transparent 1px), #382d5a",
  );
  assert.match(out, /rgba\(\d+, \d+, \d+, 0\.133\)/);
  assert.doesNotMatch(out, /#382d5a/);
  assert.match(out, /transparent/);
});

test("claro: dark coloured bands become pale tints of the same colour", () => {
  const band = themeColor("claro", "background-color", [29, 63, 54]); // .band-good
  assert.ok(light(band) > 0.75);
  assert.ok(hue(band) > 140 && hue(band) < 190);
});
