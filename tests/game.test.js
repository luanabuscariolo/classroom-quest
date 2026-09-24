import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { STORE } from "../src/storage.js";
import { validateWorkspace } from "../src/model.js";

const html = fs.readFileSync("index.html", "utf8");
let bootNumber = 0;

// App timers (status messages, animations) must not outlive the test window.
const timers = new Set(),
  realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (...args) => {
  const timer = realSetTimeout(...args);
  timers.add(timer);
  return timer;
};
function close(dom) {
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  dom.window.close();
}

/** Open the app with a teacher and a class of four students. */
async function bootWithClass() {
  const dom = new JSDOM(html, {
    url: "http://localhost/classroom-quest/",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  for (const key of ["window", "document", "localStorage", "Event"])
    globalThis[key] = key === "window" ? w : w[key];
  globalThis.confirm = () => true;
  globalThis.alert = (message) => assert.fail("Unexpected alert: " + message);
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  // Reduced motion shortens the raffle to under a second.
  w.matchMedia = () => ({ matches: true });
  // jsdom has no canvas; the wheel only needs a context that accepts calls.
  const context = new Proxy(
    { measureText: () => ({ width: 0 }) },
    { get: (target, key) => target[key] ?? (() => {}), set: () => true },
  );
  w.HTMLCanvasElement.prototype.getContext = () => context;
  await import(`../src/app.js?game-test=${++bootNumber}`);

  const $ = (id) => w.document.getElementById(id);
  const input = (id, value) => {
    $(id).value = value;
    $(id).dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  const submit = (id) =>
    $(id).dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
  input("teacherName", "Professora Teste");
  submit("teacherForm");
  $("createClass").click();
  input("setupName", "Turma jogo");
  input("setupNames", "Ana\nBruno\nCarla\nDuarte");
  submit("setupForm");
  $("applyNames").click();
  const stored = () => JSON.parse(w.localStorage.getItem(STORE));
  return { dom, w, $, input, submit, stored };
}
const wait = (ms) => new Promise((resolve) => realSetTimeout(resolve, ms));

test("raffle picks a student from the pool and can award a point", async () => {
  const { dom, $, w, stored } = await bootWithClass();
  try {
    // Only Bruno stays in the raffle.
    $("selectNone").click();
    const bruno = w.document
      .querySelector('[data-seat="1"]')
      .closest(".player");
    bruno.querySelector("[data-pool]").click();
    assert.equal($("poolCount").textContent, "1 no sorteio");
    $("draw").click();
    assert.equal($("drawOverlay").hidden, false);
    assert.equal($("draw").disabled, true);
    await wait(1200);
    assert.equal($("drawOverlay").hidden, true);
    assert.equal($("winnerOverlay").hidden, false);
    assert.equal($("winnerName").textContent, "Bruno");
    $("winnerPoint").click();
    assert.equal(stored().classes[0].students[1].points, 1);
    assert.equal($("winnerPoint").disabled, true);
    assert.equal(stored().classes[0].history.at(-1).title, "Ajuste individual");
  } finally {
    close(dom);
  }
});

test("cancelling the raffle stops the wheel without a winner", async () => {
  const { dom, $ } = await bootWithClass();
  try {
    $("draw").click();
    $("cancelDraw").click();
    assert.equal($("drawOverlay").hidden, true);
    assert.equal($("drawOutput").textContent, "Cancelado");
    await wait(1200);
    assert.equal($("winnerOverlay").hidden, true);
    assert.equal($("draw").disabled, false);
  } finally {
    close(dom);
  }
});

test("attention countdown lets the teacher take a life when time is up", async () => {
  const { dom, $, stored } = await bootWithClass();
  const realNow = Date.now;
  try {
    $("attention").click();
    assert.equal($("attentionOverlay").hidden, false);
    assert.equal($("attentionDecisions").hidden, true);
    // Jump past the 10-second deadline.
    const start = realNow();
    Date.now = () => start + 11000;
    await wait(200);
    assert.equal($("attentionTitle").textContent, "TEMPO ESGOTADO");
    assert.equal($("attentionDecisions").hidden, false);
    $("attentionNoisy").click();
    assert.equal(stored().classes[0].lives, 4);
    assert.equal($("attentionResult").textContent, "♥ 5 → 4");
    $("attentionCancel").click();
    assert.equal($("attentionOverlay").hidden, true);
  } finally {
    Date.now = realNow;
    close(dom);
  }
});

test("activity points go to the chosen students and are recorded", async () => {
  const { dom, w, $, input, stored } = await bootWithClass();
  try {
    $("activitiesOpen").click();
    input("activityName", "Ficha resolvida");
    input("activityPoints", "3");
    for (const slot of ["0", "2"]) {
      const box = w.document.querySelector(`[data-activity-student="${slot}"]`);
      box.checked = true;
      box.dispatchEvent(new w.Event("change"));
    }
    assert.equal($("applyActivity").textContent, "Dar +3 a 2 alunos");
    $("applyActivity").click();
    const saved = stored();
    assert.deepEqual(
      saved.classes[0].students.slice(0, 4).map((s) => s.points),
      [3, 0, 3, 0],
    );
    assert.equal(saved.classes[0].history.at(-1).recipients.length, 2);
    assert.ok(saved.presets.some((p) => p.name === "Ficha resolvida"));
    assert.doesNotThrow(() => validateWorkspace(saved));
  } finally {
    close(dom);
  }
});

test("renaming a student and choosing a character are saved", async () => {
  const { dom, w, $, input, submit, stored } = await bootWithClass();
  try {
    w.document.querySelector('[data-seat="4"]').click();
    input("studentName", "Eva");
    submit("nameForm");
    let student = stored().classes[0].students[4];
    assert.equal(student.name, "Eva");
    assert.equal(student.inPool, true);
    assert.ok(student.id);
    $("studentGender").value = "robot";
    $("studentGender").dispatchEvent(new w.Event("change"));
    const before = stored().classes[0].students[4].avatar;
    $("nextAvatar").click();
    student = stored().classes[0].students[4];
    assert.equal(student.avatarMode, "manual");
    assert.equal(student.gender, "robot");
    assert.notEqual(student.avatar, before);
  } finally {
    close(dom);
  }
});

test("correcting a name keeps the student; removing frees the slot", async () => {
  const { dom, w, $, input, submit, stored } = await bootWithClass();
  try {
    w.document.querySelector('[data-seat="0"]').click();
    $("scorePlus").click();
    const id = stored().classes[0].students[0].id;
    input("studentName", "Ana Sofia");
    submit("nameForm");
    let saved = stored().classes[0];
    assert.equal(saved.students[0].id, id);
    assert.equal(saved.students[0].points, 1);
    assert.equal(saved.history[0].recipients[0].studentId, id);

    w.document.querySelector('[data-seat="0"]').click();
    $("removeStudent").click();
    saved = stored().classes[0];
    assert.deepEqual(
      [saved.students[0].id, saved.students[0].name, saved.students[0].points],
      [null, "", 0],
    );
    // The history keeps the old record.
    assert.equal(saved.history[0].recipients[0].name, "Ana");
    assert.equal($("studentProfile").hidden, true);
  } finally {
    close(dom);
  }
});
