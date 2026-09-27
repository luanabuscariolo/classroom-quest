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
/** Registo: open a tab (lens) and tap one option of a student. */
const lens = (w, key) =>
  w.document.querySelector(`#logLenses [data-lens="${key}"]`).click();
const mark = (w, slot, value) =>
  w.document
    .querySelector(`.log-card[data-slot="${slot}"] [data-value="${value}"]`)
    .click();
/**
 * Open the class on another day through the class list ("Aula passada" →
 * "Outra data") and start editing it.
 */
function openDay(w, date) {
  const $ = (id) => w.document.getElementById(id);
  if (!$("gameMain").hidden) {
    $("classesOpen").click();
    $("exitNoBackup").click();
  }
  w.document.querySelector(".class-past").click();
  $("pastDate").value = date;
  $("pastOpen").click();
  $("sessionEdit").click(); // confirm() answers yes
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

test("+5 and +10 give points; a class can be deleted after a copy is saved", async () => {
  const { dom, w, $, stored } = await bootWithClass();
  try {
    w.document.querySelector('[data-seat="0"]').click();
    $("scorePlusFive").click();
    $("scorePlusTen").click();
    assert.equal(stored().classes[0].students[0].points, 15);

    const downloads = [];
    w.URL.createObjectURL = () => "blob:copy";
    w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () {
      downloads.push(this.download);
    };
    $("classesOpen").click();
    $("exitNoBackup").click();
    const card = w.document.querySelector(".class-card");
    assert.equal(card.textContent.includes("Duplicar"), false);
    [...card.querySelectorAll("button")]
      .find((b) => b.textContent.includes("Apagar"))
      .click(); // confirm() answers yes
    assert.equal(downloads.length, 1);
    assert.match(downloads[0], /^TIC_turma_Turma_jogo_/);
    assert.equal(stored().classes.length, 0);
    assert.equal(w.document.querySelector(".class-card"), null);
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

test("registo taps and assessment scores produce a period grade", async () => {
  const { dom, w, $, stored } = await bootWithClass();
  try {
    $("registoOpen").click();
    assert.equal($("registoOverlay").hidden, false);
    lens(w, "status");
    mark(w, 0, "late");
    let lesson = stored().classes[0].diary.lessons[0];
    assert.equal(lesson.attendance[0].status, "late");
    lens(w, "behavior");
    mark(w, 1, "poor");
    lesson = stored().classes[0].diary.lessons[0];
    assert.equal(lesson.attendance[1].behavior, "poor");
    assert.equal(stored().classes[0].diary.lessons.length, 1);
    $("registoSave").click();

    $("gradesOpen").click();
    $("gradesTabScores").click();
    const score = w.document.querySelector("#scoresTable input.score");
    score.value = "80";
    score.dispatchEvent(new w.Event("change"));
    const saved = stored().classes[0];
    assert.equal(saved.assessments.length, 3);
    assert.equal(saved.assessments[0].scores[saved.students[0].id], 80);

    $("gradesTabSummary").click();
    const first = $("summaryTable").rows[1];
    assert.match(first.cells[1].textContent, /Ana \*/);
    assert.notEqual(first.cells[7].textContent, "—");
    // Tapping a student shows how the grade was calculated.
    first.click();
    assert.equal($("summaryExplain").hidden, false);
    assert.match($("summaryExplain").textContent, /1\.º Trabalho 80 × 50/);
    assert.match($("summaryExplain").textContent, /Nota final: .* em 5/);
    $("inovarMode").click();
    assert.equal($("summaryTable").rows.length, 4);
  } finally {
    close(dom);
  }
});

test("a trabalho sheet with criteria calculates the score", async () => {
  const { dom, w, $, stored } = await bootWithClass();
  try {
    $("gradesOpen").click();
    $("gradesTabScores").click();
    $("addAssessment").click();
    // The new trabalho opens on its own sheet.
    assert.equal($("assessmentForm").hidden, false);
    assert.match($("scoresView").selectedOptions[0].textContent, /Trabalho 4/);
    const add = [...$("assessmentForm").querySelectorAll("button")].find(
      (b) => b.textContent === "＋ Critério",
    );
    add.click(); // Critério 1 gets 100%
    const weight = $("assessmentForm").querySelector(".criterion-row .weight");
    weight.value = "60";
    weight.dispatchEvent(new w.Event("change"));
    assert.match($("assessmentForm").textContent, /Soma dos pesos: 60%/);
    [...$("assessmentForm").querySelectorAll("button")]
      .find((b) => b.textContent === "＋ Critério")
      .click(); // Critério 2 gets the remaining 40%
    assert.match($("assessmentForm").textContent, /✓ Soma dos pesos: 100%/);
    const [k1, k2] = $("scoresTable").rows[1].querySelectorAll("input.score");
    k1.value = "100";
    k1.dispatchEvent(new w.Event("change"));
    assert.equal($("scoresTable").rows[1].lastChild.textContent, "—");
    k2.value = "50";
    k2.dispatchEvent(new w.Event("change"));
    // (100 × 60 + 50 × 40) ÷ 100 = 80.
    assert.equal($("scoresTable").rows[1].lastChild.textContent, "80");
    const saved = stored().classes[0].assessments.at(-1);
    assert.deepEqual(
      saved.criteria.map((k) => k.weight),
      [60, 40],
    );
    // The period view shows the calculated score, not an input.
    $("scoresView").value = "all";
    $("scoresView").dispatchEvent(new w.Event("change"));
    const cell = $("scoresTable").rows[1].lastChild;
    assert.equal(cell.className, "computed");
    assert.equal(cell.textContent, "80");
  } finally {
    close(dom);
  }
});

test("the lesson date chosen on the class list is used for every record", async () => {
  const { dom, w, $, input, stored } = await bootWithClass();
  try {
    openDay(w, "2026-09-07");
    assert.match($("gameSessionDay").textContent, /07\/09\/2026/);
    w.document.querySelector('[data-seat="0"]').click();
    $("scorePlus").click();
    $("registoOpen").click();
    assert.match($("registoDay").textContent, /segunda, 07\/09\/2026/);
    assert.equal($("registoToday").hidden, false);
    input("classNote", "Turma muito participativa");
    // Observação: tap a student, then write.
    lens(w, "note");
    w.document.querySelector('.log-card[data-slot="1"] .log-note').click();
    input("studentNote", "Ajudou os colegas");
    $("registoSave").click();
    const saved = stored().classes[0];
    assert.equal(saved.diary.lessons[0].date, "2026-09-07");
    assert.equal(
      saved.diary.lessons[0].attendance[1].note,
      "Ajudou os colegas",
    );
    assert.equal(saved.diary.notes[0].date, "2026-09-07");
    assert.equal(saved.diary.notes[0].text, "Turma muito participativa");
    const pointDay = new Date(saved.history[0].date);
    assert.equal(pointDay.getDate(), 7);
    assert.equal(pointDay.getMonth(), 8);
  } finally {
    close(dom);
  }
});

test("cancelling the registo puts back what was there; save keeps it", async () => {
  const { dom, w, $, input, stored } = await bootWithClass();
  try {
    $("registoOpen").click();
    input("lessonSummary", "Rascunho a descartar");
    lens(w, "status");
    mark(w, 0, "late");
    $("registoCancel").click(); // confirm() answers yes: discard
    assert.equal($("registoOverlay").hidden, true);
    assert.equal(stored().classes[0].diary.lessons.length, 0);

    $("registoOpen").click();
    input("lessonSummary", "Resumo guardado");
    $("registoSave").click();
    assert.equal(
      stored().classes[0].diary.lessons[0].summary,
      "Resumo guardado",
    );

    // Leaving the class offers a backup first.
    $("classesOpen").click();
    assert.equal($("exitOverlay").hidden, false);
    $("exitNoBackup").click();
    assert.equal($("classHub").hidden, false);
  } finally {
    close(dom);
  }
});

test("follow-up table starts everyone at the top and shows the last change", async () => {
  const { dom, w, $, stored } = await bootWithClass();
  try {
    $("gradesOpen").click();
    $("gradesTabProgress").click();
    let first = $("progressTable").rows[1];
    assert.match(first.cells[2].textContent, /^100/);
    assert.match(first.cells[6].textContent, /^5,00/);
    w.document.querySelector('[data-close="gradesOverlay"]').click();

    $("registoOpen").click();
    lens(w, "behavior");
    mark(w, 0, "poor");
    $("registoSave").click();
    assert.equal(
      stored().classes[0].diary.lessons[0].attendance[0].behavior,
      "poor",
    );

    $("gradesOpen").click();
    $("gradesTabProgress").click();
    first = $("progressTable").rows[1];
    assert.match(first.cells[2].textContent, /^20 ▼80/);
    assert.ok(first.cells[2].classList.contains("band-low"));
    // Comportamento weighs 10%: losing 80 there costs 8 of 100 (0,40 of 5).
    assert.match(first.cells[6].textContent, /^4,60 ▼0,40/);
  } finally {
    close(dom);
  }
});

test("deliveries are marked on the TPC being checked, set on an earlier day", async () => {
  const { dom, w, $, input, stored } = await bootWithClass();
  const day = (d) => openDay(w, d);
  try {
    day("2026-09-07");
    $("registoOpen").click();
    lens(w, "delivery");
    input("lessonHomework", "Ficha 3");
    $("homeworkDue").value = "2026-09-09";
    $("homeworkDue").dispatchEvent(new w.Event("change"));
    $("registoSave").click();

    day("2026-09-09");
    $("registoOpen").click();
    lens(w, "delivery");
    // The TPC due today is chosen; today's own TPC field starts empty.
    assert.match(
      $("homeworkTargetInfo").textContent,
      /07\/09\/2026.*09\/09\/2026.*Ficha 3/,
    );
    assert.equal($("lessonHomework").value, "");
    mark(w, 0, "delivered");
    mark(w, 1, "missing");
    $("rewardHomework").click();
    $("registoSave").click();
    const [set, checked] = stored().classes[0].diary.lessons;
    assert.equal(set.date, "2026-09-07");
    assert.deepEqual(
      set.attendance.slice(0, 2).map((r) => r.delivery),
      ["delivered", "missing"],
    );
    assert.ok(set.attendance[0].awardId);
    // Nothing about that TPC is written on the day it was checked.
    assert.equal(checked, undefined);
    assert.equal(stored().classes[0].students[0].points, 1);
  } finally {
    close(dom);
  }
});

test("performance table shows each lesson, one lesson, or the average so far", async () => {
  const { dom, w, $ } = await bootWithClass();
  const day = (d) => openDay(w, d);
  try {
    day("2026-09-07");
    $("registoOpen").click();
    lens(w, "status");
    mark(w, 0, "late");
    $("registoSave").click();
    day("2026-09-09");
    $("registoOpen").click();
    lens(w, "behavior");
    mark(w, 0, "poor");
    $("registoSave").click();

    $("gradesOpen").click();
    const table = () => $("perfTable");
    const view = (v) => {
      $("perfView").value = v;
      $("perfView").dispatchEvent(new w.Event("change"));
    };
    // Tudo, aula a aula: one column per lesson, no average.
    assert.deepEqual(
      [...table().rows[0].cells].map((c) => c.textContent),
      ["N.º", "Aluno", "07/09", "09/09"],
    );
    assert.equal(table().rows[1].cells[2].textContent, "⏰");
    assert.equal(table().rows[1].cells[3].textContent, "😟");
    assert.equal(table().rows[2].cells[2].textContent, "✓");

    view("behavior");
    assert.equal(table().rows[1].cells[2].textContent, "😊");
    assert.equal(table().rows[1].cells[3].textContent, "😟");

    view("lesson");
    $("perfLesson").value = $("perfLesson").options[0].value;
    $("perfLesson").dispatchEvent(new w.Event("change"));
    assert.match(table().rows[1].cells[2].textContent, /⏰ Atraso/);

    view("average");
    // The chosen lesson is kept between views; pick the last one.
    $("perfLesson").value = $("perfLesson").options[1].value;
    $("perfLesson").dispatchEvent(new w.Event("change"));
    // Up to 09/09: behaviour (100 + 20) / 2 = 60; attendance (50 + 100) / 2 = 75.
    assert.equal(table().rows[1].cells[2].textContent, "60");
    assert.equal(table().rows[1].cells[4].textContent, "75");
    $("perfLesson").value = $("perfLesson").options[0].value;
    $("perfLesson").dispatchEvent(new w.Event("change"));
    assert.equal(table().rows[1].cells[2].textContent, "100");
  } finally {
    close(dom);
  }
});

test("a past lesson opens read-only until 'Editar esta aula'", async () => {
  const { dom, w, $, stored } = await bootWithClass();
  const past = () => {
    $("classesOpen").click();
    $("exitNoBackup").click();
    w.document.querySelector(".class-past").click();
    $("pastDate").value = "2026-09-07";
    $("pastOpen").click();
  };
  try {
    past();
    assert.equal($("sessionBanner").hidden, false);
    assert.match(
      $("sessionBannerText").textContent,
      /07\/09\/2026 · só leitura/,
    );
    assert.equal($("lifeMinus").disabled, true);
    w.document.querySelector('[data-seat="0"]').click();
    assert.equal($("scorePlus").disabled, true);
    $("registoOpen").click();
    assert.equal($("registoSave").hidden, true);
    assert.equal($("registoEdit").hidden, false);
    assert.equal($("lessonSummary").disabled, true);
    lens(w, "status");
    assert.equal(
      w.document.querySelector('.log-card [data-value="late"]').disabled,
      true,
    );
    // Editing from inside the Registo.
    $("registoEdit").click();
    assert.equal($("lessonSummary").disabled, false);
    lens(w, "status");
    mark(w, 0, "late");
    $("registoSave").click();
    assert.equal(stored().classes[0].diary.lessons[0].date, "2026-09-07");
    assert.equal($("lifeMinus").disabled, false);
    // "Terminar edição" closes editing on purpose.
    $("sessionEndEdit").click();
    assert.equal($("lifeMinus").disabled, true);
    // Coming back: read-only again.
    past();
    assert.equal($("sessionEdit").hidden, false);
    assert.equal($("lifeMinus").disabled, true);
    // The list of past lessons offers that day.
    $("classesOpen").click();
    $("exitNoBackup").click();
    w.document.querySelector(".class-past").click();
    assert.match($("pastList").textContent, /07\/09\/2026 · Aula 1/);
  } finally {
    close(dom);
  }
});
