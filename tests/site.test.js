import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { parse } from "acorn";

test("public entry has unique IDs, external scripts and resolvable local assets", () => {
  const dom = new JSDOM(fs.readFileSync("index.html", "utf8"));
  const document = dom.window.document;
  try {
    const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const el of document.querySelectorAll("*")) {
      assert.equal(
        [...el.attributes].some((a) => a.name.startsWith("on")),
        false,
      );
    }
    assert.equal(
      document.querySelectorAll("style, script:not([src])").length,
      0,
    );
    for (const el of document.querySelectorAll(
      "script[src], link[rel=stylesheet]",
    )) {
      const reference = el.getAttribute("src") || el.getAttribute("href");
      assert.ok(reference.startsWith("./"));
      assert.ok(fs.existsSync(reference), reference);
    }
    for (const file of fs.readdirSync("assets/css")) {
      const css = fs.readFileSync(path.join("assets/css", file), "utf8");
      for (const [, reference] of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        assert.ok(
          fs.existsSync(path.resolve("assets/css", reference)),
          reference,
        );
      }
    }
    for (const file of fs.readdirSync("src")) {
      const ast = parse(fs.readFileSync(path.join("src", file), "utf8"), {
        sourceType: "module",
        ecmaVersion: "latest",
      });
      for (const node of ast.body.filter(
        (n) => n.type === "ImportDeclaration",
      )) {
        assert.ok(node.source.value.startsWith("./"));
        assert.ok(
          fs.existsSync(path.resolve("src", node.source.value)),
          node.source.value,
        );
      }
    }
    // The offline cache must list every public file.
    const sw = fs.readFileSync("sw.js", "utf8");
    const cached = [...sw.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]);
    const expected = ["", "index.html", "manifest.webmanifest"];
    for (const dir of ["assets/css", "assets/images", "src"])
      for (const file of fs.readdirSync(dir)) expected.push(dir + "/" + file);
    assert.deepEqual([...cached].sort(), [...expected].sort());
    const manifest = JSON.parse(
      fs.readFileSync("manifest.webmanifest", "utf8"),
    );
    for (const icon of manifest.icons)
      assert.ok(fs.existsSync(icon.src), icon.src);
  } finally {
    dom.window.close();
  }
});
