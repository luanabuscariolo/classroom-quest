import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { STORE } from "../src/storage.js";
import { emptyWorkspace, validateWorkspace } from "../src/model.js";

const html = fs.readFileSync("index.html", "utf8");
let bootNumber = 0;
async function boot(snapshot) {
  const dom = new JSDOM(html, { url: "http://localhost/" });
  const w = dom.window;
  for (const key of ["window", "document", "localStorage", "Event"])
    globalThis[key] = key === "window" ? w : w[key];
  w.scrollTo = () => {};
  globalThis.alert = () => assert.fail("Unexpected alert");
  if (snapshot) w.localStorage.setItem(STORE, snapshot);
  await import(`../src/app.js?teacher-test=${++bootNumber}`);
  return dom;
}

test("teacher name starts empty and is restored on a new page load", async () => {
  let dom = await boot();
  try {
    let doc = dom.window.document;
    assert.equal(doc.getElementById("teacherName").value, "");
    assert.deepEqual(emptyWorkspace().teachers, []);
    doc.getElementById("teacherName").value = "Sofia Teste";
    doc.getElementById("teacherTitle").value = "Professora";
    doc.getElementById("teacherAvatar").value = "4";
    doc
      .getElementById("teacherForm")
      .dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    const snapshot = dom.window.localStorage.getItem(STORE);
    assert.doesNotThrow(() => validateWorkspace(JSON.parse(snapshot)));
    dom.window.close();
    dom = await boot(snapshot);
    doc = dom.window.document;
    assert.equal(doc.getElementById("teacherName").value, "Sofia Teste");
    assert.equal(doc.getElementById("teacherAvatar").value, "4");
    assert.equal(
      doc.getElementById("hubTeacherName").textContent,
      "Prof. Sofia Teste · MASTER",
    );
    assert.equal(doc.getElementById("teacherCards"), null);
  } finally {
    dom.window.close();
  }
});

test("legacy bundled profiles do not prefill onboarding or get deleted", async () => {
  const old = emptyWorkspace();
  old.teachers = [
    { id: "master-demo", name: "Demo", title: "Professor", avatar: 0 },
  ];
  old.activeTeacherId = "master-demo";
  const dom = await boot(JSON.stringify(old));
  try {
    const doc = dom.window.document;
    assert.equal(doc.getElementById("teacherName").value, "");
    doc.getElementById("teacherName").value = "Novo nome";
    doc
      .getElementById("teacherForm")
      .dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    const saved = JSON.parse(dom.window.localStorage.getItem(STORE));
    assert.equal(
      saved.teachers.find((t) => t.id === saved.activeTeacherId).name,
      "Novo nome",
    );
    assert.equal(
      saved.teachers.find((t) => t.id === "master-demo").name,
      "Demo",
    );
  } finally {
    dom.window.close();
  }
});
