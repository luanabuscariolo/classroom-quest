import { canUndo } from "./points.js";
import { downloadText } from "./dom.js";
import {
  awardHomework,
  classNoteOn,
  createLesson,
  dailyReport,
  dayDates,
  daySummary,
  rewardableRows,
} from "./diary-data.js";
import { MARKS, createLessonGrid } from "./lesson-log.js";
import { dateLabel, dayISO, integer, uid } from "./utils.js";

const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];
function longDate(day) {
  const [y, m, d] = day.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()] + ", " + dateLabel(day);
}

/**
 * "Registo": the class diary of one day. The day is chosen once (on the class
 * list, or "Editar este dia" in the history) and everything written here is
 * saved at once into that day: students' marks and notes, summary,
 * activities, homework and a general note. The history shows each day in a
 * readable form. Texts and reports come from diary-data.js.
 */
export function createDiary(app) {
  const {
    $,
    element,
    button,
    dirty,
    syncAll,
    playSound,
    openOverlay,
    closeOverlay,
    masterName,
    requireTeacher,
  } = app;
  const pending = new Map();
  let reportDay = null,
    snapshot = null,
    closing = false,
    lens = "summary",
    homeworkTargetId = null;

  const day = () => app.sessionDay;
  function lessonOn(c, date) {
    return c.diary.lessons
      .filter((l) => l.date === date)
      .sort((a, b) => b.number - a.number)[0];
  }
  /** The lesson of the chosen day; created when something is first written. */
  function getLesson(create) {
    const c = app.state;
    let lesson = lessonOn(c, day());
    if (!lesson && create) {
      if (c.diary.lessons.length >= 2000) {
        alert("Limite de 2000 aulas por turma.");
        return null;
      }
      lesson = createLesson(c, c.diary, day(), masterName());
      c.diary.lessons.push(lesson);
      renderHeader();
    }
    return lesson;
  }
  /** Homework deliveries are marked on the lesson where the TPC was set. */
  function homeworkTarget() {
    return (
      app.state.diary.lessons.find((l) => l.id === homeworkTargetId) || null
    );
  }
  const grid = createLessonGrid({
    $,
    element,
    dirty,
    lessonFor: (key, create) =>
      key === "delivery" ? homeworkTarget() : getLesson(create),
    onChange(message) {
      saved(message);
      updateRewardButton();
    },
    get state() {
      return app.state;
    },
    get readOnly() {
      return app.readOnly;
    },
  });

  function saved(message) {
    $("registoSaved").textContent =
      (message || "✓ Guardado") +
      (app.storageOK
        ? " · gravado neste aparelho"
        : " · ⚠ sem gravação local: faça backup");
  }

  // ── Texts of the day (saved as you type) ─────────────────────────────────
  const FIELDS = [
    ["lessonSummary", "summary"],
    ["lessonActivities", "activities"],
    ["lessonHomework", "homework"],
  ];
  /** Save texts still waiting (typing is saved 0.4 s after the last key). */
  function flush() {
    const jobs = [...pending.values()];
    pending.clear();
    jobs.forEach((job) => {
      clearTimeout(job.timer);
      job.save();
    });
  }
  function later(key, save) {
    const previous = pending.get(key);
    if (previous) clearTimeout(previous.timer);
    const job = {
      save,
      timer: setTimeout(() => {
        pending.delete(key);
        save();
      }, 400),
    };
    pending.set(key, job);
  }
  FIELDS.forEach(([id, key]) => {
    $(id).oninput = function () {
      const value = this.value;
      later(key, () => {
        const lesson = getLesson(true);
        if (!lesson) return;
        lesson[key] = value;
        dirty();
        saved();
        if (key === "homework") fillHomeworkTargets();
      });
    };
  });
  $("homeworkDue").onchange = function () {
    const lesson = getLesson(true);
    if (!lesson) return;
    lesson.due = this.value || "";
    dirty();
    saved();
    fillHomeworkTargets();
  };
  $("classNote").oninput = function () {
    const value = this.value;
    later("classNote", () => {
      const c = app.state;
      let note = classNoteOn(c.diary, day());
      if (!note) {
        if (!value.trim()) return;
        if (c.diary.notes.length >= 10000) {
          alert("Limite de notas atingido.");
          return;
        }
        note = {
          id: uid(),
          date: day(),
          text: "",
          slot: null,
          studentId: null,
          name: "",
        };
        c.diary.notes.push(note);
      }
      note.text = value.slice(0, 6000);
      dirty();
      saved("✓ Nota da turma guardada");
    });
  };

  // ── Homework points ──────────────────────────────────────────────────────
  function updateRewardButton() {
    const c = app.state,
      lesson = homeworkTarget(),
      n = lesson ? rewardableRows(c, lesson).length : 0,
      points = Number($("homeworkPoints").value);
    $("rewardHomework").textContent =
      "★ Dar +" +
      (integer(points, 1, 1000) ? points : "?") +
      " a " +
      n +
      " entrega" +
      (n === 1 ? "" : "s");
    $("rewardHomework").disabled =
      !lesson || !lesson.homework.trim() || !n || !integer(points, 1, 1000);
  }
  $("homeworkPoints").oninput = updateRewardButton;
  $("rewardHomework").onclick = function () {
    flush();
    const c = app.state,
      lesson = homeworkTarget(),
      points = Number($("homeworkPoints").value);
    if (!lesson) return;
    const rows = rewardableRows(c, lesson);
    if (!rows.length || !lesson.homework.trim() || !integer(points, 1, 1000))
      return;
    if (!awardHomework(c, lesson, rows, points)) {
      alert("Não é possível adicionar este lançamento.");
      return;
    }
    dirty();
    syncAll();
    playSound("point");
    $("homeworkFeedback").textContent =
      "✓ " +
      rows.length +
      " entregas premiadas. Pode desfazer no Histórico por dia.";
    updateRewardButton();
  };

  function copyText(text) {
    if (!text) {
      saved("Ainda não há texto para copiar.");
      return;
    }
    const fallback = () => {
      openOverlay("copyOverlay", "copyText");
      $("copyText").value = text;
      $("copyText").select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard
        .writeText(text)
        .then(() => saved("✓ Texto copiado"), fallback);
    else fallback();
  }
  $("copySummary").onclick = () => copyText($("lessonSummary").value);
  $("copyHomework").onclick = () =>
    copyText(
      $("lessonHomework").value +
        ($("homeworkDue").value
          ? "\nEntrega: " + dateLabel($("homeworkDue").value)
          : ""),
    );

  // ── Day tab ──────────────────────────────────────────────────────────────
  function renderHeader() {
    const c = app.state,
      lesson = lessonOn(c, day()),
      isToday = day() === dayISO(new Date());
    $("registoClass").textContent = c.className + " · " + masterName();
    $("registoDay").textContent =
      (lesson ? "Aula " + lesson.number + " · " : "") + longDate(day());
    $("registoDay").classList.toggle("not-today", !isToday);
    $("registoToday").hidden = isToday;
  }
  function renderDay() {
    const c = app.state,
      lesson = lessonOn(c, day());
    renderHeader();
    FIELDS.forEach(([id, key]) => ($(id).value = lesson ? lesson[key] : ""));
    $("homeworkDue").value = lesson ? lesson.due : "";
    const note = classNoteOn(c.diary, day());
    $("classNote").value = note ? note.text : "";
    $("homeworkFeedback").textContent = "";
    setLens(lens);
  }

  // ── Tabs of the day: Sumário, the marks, TPC and Observação ─────────────
  const LENS_TABS = [
    ["summary", "📝 Sumário"],
    ...Object.entries(MARKS).map(([key, def]) => [
      key,
      def.options[0][1] + " " + def.label,
    ]),
    ["note", "💬 Observação"],
  ];
  function setLens(key) {
    lens = key;
    const bar = $("logLenses");
    bar.textContent = "";
    LENS_TABS.forEach(([k, label]) => {
      const b = element("button", "button", label);
      b.type = "button";
      b.dataset.lens = k;
      b.setAttribute("aria-pressed", String(k === lens));
      b.onclick = () => {
        flush();
        setLens(k);
      };
      bar.appendChild(b);
    });
    $("summaryPanel").hidden = lens !== "summary";
    $("homeworkPanel").hidden = lens !== "delivery";
    $("homeworkReward").hidden = lens !== "delivery";
    $("notePanel").hidden = lens !== "note";
    if (lens === "delivery") fillHomeworkTargets();
    else grid.render(lens);
    applyReadOnly();
  }
  /**
   * TPC to check: every TPC set up to this day. By default the one due today,
   * else the latest set before today, else today's.
   */
  function fillHomeworkTargets() {
    const c = app.state,
      list = c.diary.lessons
        .filter((l) => l.homework.trim() && l.date <= day())
        .sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number),
      select = $("homeworkTarget");
    select.textContent = "";
    if (!list.some((l) => l.id === homeworkTargetId))
      homeworkTargetId = (
        list.find((l) => l.due === day()) ||
        list.find((l) => l.date < day()) ||
        list[0] || { id: null }
      ).id;
    list.forEach((l) => {
      const o = element(
        "option",
        "",
        "Dada a " +
          dateLabel(l.date) +
          " · " +
          l.homework.slice(0, 50) +
          (l.due ? " · entrega " + dateLabel(l.due) : ""),
      );
      o.value = l.id;
      select.appendChild(o);
    });
    select.disabled = !list.length;
    if (!list.length) {
      select.appendChild(element("option", "", "Ainda não há TPC registada"));
      $("homeworkTargetInfo").textContent =
        "Escreva a nova TPC acima. As entregas verificam-se aqui, na aula do prazo.";
    } else {
      select.value = homeworkTargetId;
      const l = homeworkTarget();
      $("homeworkTargetInfo").textContent =
        "As marcações abaixo referem-se à TPC dada a " +
        dateLabel(l.date) +
        (l.due ? ", com entrega até " + dateLabel(l.due) : "") +
        ": “" +
        l.homework +
        "”.";
    }
    grid.render("delivery");
    // Without a TPC there is nothing to mark yet.
    if (!list.length) $("logGrid").hidden = true;
    updateRewardButton();
    applyReadOnly();
  }
  /** Past lesson not being edited: everything can be read, nothing changed. */
  function applyReadOnly() {
    const ro = app.readOnly;
    $("registoDayPane")
      .querySelectorAll("input, textarea, .log-choice, #rewardHomework")
      .forEach((el) => (el.disabled = ro));
    $("registoReadOnly").hidden = !ro;
    $("registoEdit").hidden = !ro;
    $("registoSave").hidden = ro;
    $("registoCancel").textContent = ro ? "Fechar" : "Cancelar";
  }
  $("registoEdit").onclick = () => {
    if (!app.startEditing()) return;
    snapshot = snapshotOf();
    setTab("day");
  };
  $("homeworkTarget").onchange = function () {
    homeworkTargetId = this.value;
    $("homeworkFeedback").textContent = "";
    fillHomeworkTargets();
  };

  // ── History tab ──────────────────────────────────────────────────────────
  function setTab(tab) {
    flush();
    $("registoTabDay").setAttribute("aria-pressed", String(tab === "day"));
    $("registoTabHistory").setAttribute("aria-pressed", String(tab !== "day"));
    $("registoDayPane").hidden = tab !== "day";
    $("registoHistoryPane").hidden = tab === "day";
    if (tab === "day") renderDay();
    else showHistoryList();
  }
  function showHistoryList() {
    $("dailyHistoryList").hidden = false;
    $("historyFilterBar").hidden = false;
    $("dailyReport").hidden = true;
    const c = app.state,
      root = $("dailyHistoryList"),
      filter = $("historyDateFilter").value;
    root.textContent = "";
    let dates = dayDates(c, c.diary);
    if (filter) dates = dates.filter((d) => d === filter);
    if (!dates.length) {
      root.appendChild(element("p", "diary-hint", "Sem registos nesta data."));
      return;
    }
    dates.forEach((date) => {
      const s = daySummary(c, c.diary, date),
        absences = s.lessons.reduce(
          (n, l) =>
            n + (l.groups.find(([k]) => k === "Faltas")?.[1].length || 0),
          0,
        ),
        card = button("", () => showDay(date), "daily-card history-day");
      card.append(
        element("strong", "", longDate(date)),
        element(
          "span",
          "diary-hint",
          [
            s.lessons.length
              ? "Aula " + s.lessons.map((l) => l.lesson.number).join(", ")
              : "",
            s.lessons[0]?.lesson.summary
              ? "“" + s.lessons[0].lesson.summary.slice(0, 80) + "”"
              : "",
            absences ? absences + " falta(s)" : "",
            s.events.length ? s.events.length + " lançamento(s) de pontos" : "",
          ]
            .filter(Boolean)
            .join(" · ") || "Só notas",
        ),
      );
      root.appendChild(card);
    });
  }
  function section(title, content) {
    const box = element("section", "day-section");
    box.appendChild(element("h4", "", title));
    if (typeof content === "string")
      box.appendChild(element("p", "day-text", content));
    else box.appendChild(content);
    return box;
  }
  function namesList(items) {
    const list = element("ul", "day-groups");
    items.forEach(([label, text]) => {
      const li = element("li");
      li.append(element("strong", "", label), document.createTextNode(text));
      list.appendChild(li);
    });
    return list;
  }
  function showDay(date) {
    reportDay = date;
    const c = app.state,
      s = daySummary(c, c.diary, date),
      view = $("dailyReportView");
    $("dailyHistoryList").hidden = true;
    $("historyFilterBar").hidden = true;
    $("dailyReport").hidden = false;
    $("dailyReportTitle").textContent = c.className + " · " + longDate(date);
    view.textContent = "";
    s.lessons.forEach(({ lesson, present, groups, observations }) => {
      const card = element("article", "daily-card day-card");
      card.appendChild(
        element("h3", "", "Aula " + lesson.number + " · " + lesson.teacher),
      );
      card.appendChild(section("Sumário", lesson.summary || "—"));
      card.appendChild(section("Atividades", lesson.activities || "—"));
      card.appendChild(
        section(
          "TPC",
          (lesson.homework || "—") +
            (lesson.due ? "\nEntrega até " + dateLabel(lesson.due) : ""),
        ),
      );
      card.appendChild(
        section(
          "Alunos",
          namesList([
            [
              "",
              present + " de " + lesson.attendance.length + " alunos presentes",
            ],
            ...groups.map(([label, names]) => [label + ": ", names.join(", ")]),
          ]),
        ),
      );
      if (observations.length)
        card.appendChild(
          section(
            "Observações",
            namesList(observations.map((o) => [o.name + ": ", o.text])),
          ),
        );
      view.appendChild(card);
    });
    if (s.classNotes.length || s.studentNotes.length) {
      const card = element("article", "daily-card day-card");
      s.classNotes.forEach((n) =>
        card.appendChild(section("Nota geral sobre a turma", n.text)),
      );
      s.studentNotes.forEach((n) =>
        card.appendChild(section("Nota sobre " + n.name, n.text)),
      );
      view.appendChild(card);
    }
    if (!view.children.length)
      view.appendChild(
        element("p", "diary-hint", "Neste dia só há pontos lançados."),
      );
    renderPointEvents(date);
  }
  function renderPointEvents(date) {
    const c = app.state,
      root = $("dailyPointEvents");
    root.textContent = "";
    const events = daySummary(c, c.diary, date).events;
    if (!events.length) return;
    root.appendChild(element("h4", "", "Pontos lançados neste dia"));
    events.forEach((h) => {
      const line = element("div", "daily-card" + (h.undoneAt ? " undone" : ""));
      line.appendChild(
        element(
          "strong",
          "",
          (h.undoneAt ? "[ANULADO] " : "") +
            h.title +
            " · " +
            (h.points > 0 ? "+" : "") +
            h.points +
            " ★",
        ),
      );
      line.appendChild(
        element("p", "", h.recipients.map((r) => r.name).join(", ")),
      );
      if (!h.undoneAt)
        line.appendChild(
          button(
            "Desfazer pontos",
            () => {
              if (!confirm("Desfazer este lançamento de pontos?")) return;
              if (!canUndo(c, h)) {
                alert(
                  "Não é possível desfazer: o aluno mudou ou a pontuação excede o limite.",
                );
                return;
              }
              h.recipients.forEach((r) => {
                c.students[r.slot].points -= h.points;
              });
              h.undoneAt = new Date().toISOString();
              dirty();
              syncAll();
              showDay(date);
            },
            "small",
          ),
        );
      root.appendChild(line);
    });
  }
  $("historyDateFilter").oninput = showHistoryList;
  $("clearHistoryFilter").onclick = () => {
    $("historyDateFilter").value = "";
    showHistoryList();
  };
  $("dailyReportBack").onclick = showHistoryList;
  $("editReportDay").onclick = () => {
    app.setSessionDay(reportDay);
    grid.reset();
    homeworkTargetId = null;
    setTab("day");
  };
  $("copyWholeDay").onclick = () =>
    copyText(dailyReport(app.state, app.state.diary, reportDay));
  $("exportWholeDay").onclick = () =>
    downloadText(
      dailyReport(app.state, app.state.diary, reportDay),
      "TIC_Dia_" + reportDay + ".txt",
    );

  // ── Open, backup and exit ────────────────────────────────────────────────
  function open(tab = "day") {
    if (!requireTeacher()) return;
    grid.reset();
    lens = "summary";
    homeworkTargetId = null;
    snapshot = snapshotOf();
    $("registoSaved").textContent =
      "Tudo o que escrever fica gravado neste dia.";
    $("historyDateFilter").value = "";
    openOverlay("registoOverlay", "registoTabDay");
    setTab(tab);
  }
  $("registoOpen").onclick = () => open("day");
  // "Histórico por dia" in the points window opens this history.
  $("historyTab").onclick = () => {
    closeOverlay("activitiesOverlay");
    open("history");
  };
  $("registoTabDay").onclick = () => setTab("day");
  $("registoTabHistory").onclick = () => setTab("history");
  $("registoToday").onclick = () => {
    flush();
    app.setSessionDay(dayISO(new Date()));
    homeworkTargetId = null;
    setTab("day");
  };
  // Cancel: everything is written as you go (so nothing is lost if the
  // tablet switches off), and "Cancelar" puts back what was there on opening.
  function snapshotOf() {
    const c = app.state;
    return JSON.stringify({
      students: c.students,
      history: c.history,
      diary: c.diary,
    });
  }
  function changed() {
    flush();
    return snapshot !== null && snapshotOf() !== snapshot;
  }
  function discard() {
    Object.assign(app.state, JSON.parse(snapshot));
    dirty();
    syncAll();
  }
  /** Called for every close (buttons and Escape); false keeps it open. */
  function beforeClose() {
    if (closing || !changed()) {
      snapshot = null;
      return true;
    }
    if (
      !confirm(
        "Sair sem salvar?\nAs alterações feitas agora no Registo serão descartadas.",
      )
    )
      return false;
    discard();
    snapshot = null;
    return true;
  }
  function finish() {
    closing = true;
    closeOverlay("registoOverlay");
    closing = false;
  }
  $("registoCancel").onclick = () => closeOverlay("registoOverlay");
  $("registoSave").onclick = () => {
    flush();
    snapshot = null;
    finish();
  };
  // Leaving the page never loses a note still waiting to be saved.
  window.addEventListener("pagehide", flush);

  return { open, flush, beforeClose };
}
