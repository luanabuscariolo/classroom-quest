import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { STORE } from "../src/storage.js";
import { validateWorkspace } from "../src/model.js";

test("classroom, points, diary drafts, import and presentation work together", async () => {
  const timers = new Set();
  const originalTimeout = globalThis.setTimeout,
    originalInterval = globalThis.setInterval;
  globalThis.setTimeout = (...args) => {
    const timer = originalTimeout(...args);
    timers.add(timer);
    return timer;
  };
  globalThis.setInterval = (...args) => {
    const timer = originalInterval(...args);
    timers.add(timer);
    return timer;
  };
  const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
    url: "http://localhost/classroom-quest/",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  for (const key of [
    "window",
    "document",
    "localStorage",
    "Event",
    "FileReader",
    "HTMLElement",
  ])
    globalThis[key] = key === "window" ? w : w[key];
  globalThis.confirm = () => true;
  const alerts = [];
  globalThis.alert = (message) => alerts.push(message);
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.matchMedia = () => ({ matches: true });
  const errors = [];
  w.addEventListener("error", (e) => errors.push(e.error));
  let popup;
  w.open = () => {
    popup = new JSDOM("", { url: w.location.href, pretendToBeVisual: true })
      .window;
    return popup;
  };
  const $ = (id) => w.document.getElementById(id);
  const click = (id) => $(id).click();
  const input = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  const stored = () => JSON.parse(w.localStorage.getItem(STORE));
  try {
    await import("../src/app.js");
    assert.equal($("bootWarning").hidden, true);
    assert.equal($("classHub").hidden, false);
    click("createClass");
    input("setupName", "Turma teste");
    input("setupNames", "Ana\nBruno\nCarla");
    $("setupForm").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    click("applyNames");
    assert.equal($("gameMain").hidden, false);
    assert.equal(stored().classes.length, 1);
    w.document.querySelector('[data-seat="0"]').click();
    click("scorePlus");
    assert.equal(stored().classes[0].students[0].points, 1);
    click("lifeMinus");
    assert.equal(stored().classes[0].lives, 4);
    click("teamsOpen");
    $("teamCount").value = "2";
    click("makeTeams");
    assert.equal(stored().classes[0].groups.length, 2);
    w.document.querySelector('[data-close="teamsOverlay"]').click();
    click("gameDiary");
    click("annotateToday");
    input("lessonSummary", "Resumo privado");
    assert.equal(stored().classes[0].diary.lessons.length, 0);
    click("saveDiaryDay");
    assert.equal(
      stored().classes[0].diary.lessons[0].summary,
      "Resumo privado",
    );
    input("lessonHomework", "Ficha");
    $("tabHomework").click();
    const delivery = w.document.querySelector('[data-delivery="0"]');
    delivery.value = "delivered";
    delivery.dispatchEvent(new w.Event("change"));
    click("rewardHomework");
    assert.equal(stored().classes[0].students[0].points, 2);
    assert.doesNotThrow(() => validateWorkspace(stored()));
    w.document.querySelector('[data-close="diaryOverlay"]').click();
    click("gameDiary");
    click("annotateToday");
    assert.equal($("lessonSummary").value, "Resumo privado");
    click("diaryProject");
    assert.ok(popup.document.querySelector('link[rel="stylesheet"]'));
    assert.equal(
      popup.document.body.textContent.includes("Resumo privado"),
      false,
    );
    assert.equal(popup.document.querySelector("#diaryOverlay"), null);
    assert.equal(popup.document.querySelector("input"), null);
    popup.document.getElementById("lifeMinus").click();
    assert.equal(stored().classes[0].lives, 3);
    w.document.querySelector('[data-close="diaryOverlay"]').click();
    click("load");
    input("importText", JSON.stringify(stored()));
    click("readPastedSave");
    assert.equal($("applyImport").disabled, false);
    click("applyImport");
    assert.equal(stored().classes.length, 2);
    assert.doesNotThrow(() => validateWorkspace(stored()));
    w.dispatchEvent(
      new w.StorageEvent("storage", {
        key: STORE,
        newValue: null,
        storageArea: w.localStorage,
      }),
    );
    assert.equal($("storageWarning").hidden, false);
    assert.deepEqual(errors, []);
    assert.deepEqual(alerts, []);
  } finally {
    if (popup) popup.close();
    w.close();
    for (const timer of timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    globalThis.setTimeout = originalTimeout;
    globalThis.setInterval = originalInterval;
  }
});
