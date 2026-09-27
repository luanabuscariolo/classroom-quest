import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { STORE } from "../src/storage.js";
import { validateWorkspace } from "../src/model.js";

test("classroom, points, registo, import and presentation work together", async () => {
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
    assert.equal($("teacherName").value, "");
    click("createClass");
    assert.equal($("setupOverlay").hidden, true);
    input("teacherName", "  Alex Teste  ");
    $("teacherForm").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    assert.equal(stored().teachers.length, 1);
    assert.equal(stored().teachers[0].name, "Alex Teste");
    click("createClass");
    input("setupName", "Turma teste");
    input("setupNames", "Ana\nBruno\nCarla");
    $("setupForm").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    click("applyNames");
    assert.equal($("gameMain").hidden, false);
    assert.equal(stored().classes.length, 1);
    assert.equal($("masterDisplayName").textContent, "Prof. Alex Teste");
    assert.equal($("gameTeacherName").textContent, "♛ Prof. Alex Teste");
    assert.equal($("masterChange"), null);
    assert.equal($("gameTeacherSelect"), null);
    input("teacherName", "Nome indevido");
    $("teacherForm").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    assert.equal(stored().teachers[0].name, "Alex Teste");
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
    click("registoOpen");
    assert.equal($("registoOverlay").hidden, false);
    assert.match($("registoDay").textContent, /\d\d\/\d\d\/\d{4}/);
    input("lessonSummary", "Resumo privado");
    input("lessonHomework", "Ficha");
    // Switching tab saves text that is still waiting to be written.
    click("registoTabHistory");
    const lesson = stored().classes[0].diary.lessons[0];
    assert.equal(lesson.summary, "Resumo privado");
    assert.equal(lesson.teacher, "Prof. Alex Teste");
    click("registoTabDay");
    w.document.querySelector('#logLenses [data-lens="delivery"]').click();
    assert.match($("homeworkTargetInfo").textContent, /“Ficha”/);
    w.document
      .querySelector('.log-card[data-slot="0"] [data-value="delivered"]')
      .click();
    click("rewardHomework");
    assert.equal(stored().classes[0].students[0].points, 2);
    assert.doesNotThrow(() => validateWorkspace(stored()));
    click("registoSave");
    assert.equal($("registoOverlay").hidden, true);
    click("registoOpen");
    assert.equal($("lessonSummary").value, "Resumo privado");
    click("registoTabHistory");
    w.document.querySelector("#dailyHistoryList .history-day").click();
    assert.match($("dailyReportView").textContent, /Resumo privado/);
    assert.match(
      $("dailyReportView").textContent,
      /Entregaram a TPC desta aula: Ana/,
    );
    click("registoSave");
    click("gameProject");
    assert.ok(popup.document.querySelector('link[rel="stylesheet"]'));
    assert.equal(
      popup.document.body.textContent.includes("Resumo privado"),
      false,
    );
    assert.equal(popup.document.querySelector("#registoOverlay"), null);
    assert.equal(popup.document.querySelector("input"), null);
    assert.equal(popup.document.getElementById("newLesson"), null);
    popup.document.getElementById("lifeMinus").click();
    assert.equal(stored().classes[0].lives, 3);
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
