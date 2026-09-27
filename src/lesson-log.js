import { avatarFor, sprite } from "./avatars.js";

/**
 * Lesson marks and the student grid of the Registo screen. Each student card
 * shows one button per option (emoji); one tap picks it. The first option of
 * each mark is the normal one, so only exceptions need a tap.
 */
export const MARKS = {
  status: {
    label: "Presença",
    options: [
      ["present", "✅", "Presente"],
      ["late", "⏰", "Atraso"],
      ["absent", "❌", "Falta"],
      ["excused", "📋", "Falta justificada"],
    ],
    get: (r) => (r.status === "unmarked" ? "present" : r.status),
    set: (r, v) => (r.status = v),
  },
  behavior: {
    label: "Comportamento",
    options: [
      ["good", "😊", "Bom"],
      ["regular", "😐", "Regular"],
      ["poor", "😟", "A melhorar"],
    ],
    get: (r) => r.behavior,
    set: (r, v) => (r.behavior = v),
  },
  participation: {
    label: "Participação",
    options: [
      ["normal", "👍", "Normal"],
      ["active", "🙋", "Ativa"],
      ["low", "💤", "Fraca"],
    ],
    get: (r) => r.participation,
    set: (r, v) => (r.participation = v),
  },
  material: {
    label: "Material",
    options: [
      ["yes", "🎒", "Tem material"],
      ["no", "🚫", "Sem material"],
    ],
    get: (r) => (r.material ? "yes" : "no"),
    set: (r, v) => (r.material = v === "yes"),
  },
  delivery: {
    label: "TPC",
    options: [
      ["pending", "⏳", "Por verificar"],
      ["delivered", "📗", "Entregue"],
      ["missing", "📕", "Não entregue"],
      ["excused", "📄", "Dispensado"],
    ],
    get: (r) => r.delivery,
    set: (r, v) => (r.delivery = v),
  },
};

/** Emoji and label of a row's value for one mark. */
export function markOf(key, row) {
  const def = MARKS[key],
    value = def.get(row);
  const option = def.options.find(([v]) => v === value) || def.options[0];
  return {
    value,
    emoji: option[1],
    label: option[2],
    normal: option === def.options[0],
  };
}

export function createLessonGrid(app) {
  const { $, element, dirty, lessonFor, onChange } = app;
  let noteSlot = null;

  /** Row of a student, added if the student joined after the lesson began. */
  function rowFor(lesson, student, slot, create) {
    let row = lesson.attendance.find((r) => r.studentId === student.id);
    if (!row && create) {
      row = {
        slot,
        studentId: student.id,
        name: student.name,
        status: "unmarked",
        note: "",
        delivery: "pending",
        awardId: null,
        behavior: "good",
        participation: "normal",
        material: true,
      };
      // A slot has one row per lesson; a removed student's row is replaced.
      lesson.attendance = lesson.attendance
        .filter((r) => r.slot !== slot)
        .concat(row)
        .sort((a, b) => a.slot - b.slot);
    }
    return row;
  }
  const DEFAULT_ROW = {
    status: "unmarked",
    behavior: "good",
    participation: "normal",
    material: true,
    delivery: "pending",
    note: "",
  };

  /** Legend of the current mark, shown under the tabs. */
  function renderLegend(lens) {
    const legend = $("logLegend");
    legend.textContent = "";
    if (MARKS[lens])
      MARKS[lens].options.forEach(([, emoji, label]) =>
        legend.appendChild(element("span", "", emoji + " " + label)),
      );
    else if (lens === "note")
      legend.appendChild(
        element("span", "", "Toque num aluno para escrever uma observação."),
      );
    legend.hidden = !legend.children.length;
  }

  function render(lens) {
    renderLegend(lens);
    const c = app.state,
      grid = $("logGrid");
    grid.textContent = "";
    grid.hidden = !MARKS[lens] && lens !== "note";
    if (grid.hidden) {
      $("studentNoteBox").hidden = true;
      return;
    }
    const lesson = lessonFor(lens, false);
    c.students.forEach((s, slot) => {
      if (!s.name) return;
      const row = (lesson && rowFor(lesson, s, slot, false)) || DEFAULT_ROW,
        card = element(
          "div",
          "log-card" + (lens === "note" && slot === noteSlot ? " editing" : ""),
        );
      card.dataset.slot = slot;
      const avatar = element("span", "log-avatar");
      sprite(avatar, avatarFor(s, slot));
      card.append(avatar, element("strong", "", s.name));
      if (lens === "note") {
        const open = element(
          "button",
          "log-note " + (row.note ? "has-note" : ""),
          row.note ? "📝 " + row.note.slice(0, 40) : "＋ Observação",
        );
        open.type = "button";
        open.setAttribute("aria-label", "Observação sobre " + s.name);
        open.onclick = () => {
          noteSlot = slot;
          render(lens);
        };
        card.appendChild(open);
      } else {
        const current = MARKS[lens].get(row),
          choices = element("div", "log-choices");
        MARKS[lens].options.forEach(([value, emoji, label]) => {
          const b = element("button", "log-choice", emoji);
          b.type = "button";
          b.dataset.value = value;
          b.title = label;
          b.setAttribute("aria-label", s.name + ": " + label);
          b.setAttribute("aria-pressed", String(value === current));
          b.onclick = () => choose(lens, slot, value);
          choices.appendChild(b);
        });
        // Other marks of this lesson that are not normal, so nothing is missed.
        // Not on the TPC tab: those rows belong to the day the TPC was set.
        const others = (lens === "delivery" ? [] : Object.keys(MARKS))
          .filter((k) => k !== lens && k !== "delivery")
          .map((k) => markOf(k, row))
          .filter((m) => !m.normal)
          .map((m) => m.emoji);
        if (row.note) others.push("📝");
        card.append(choices, element("small", "log-others", others.join(" ")));
      }
      grid.appendChild(card);
    });
    renderNoteEditor(lens);
  }

  function renderNoteEditor(lens) {
    const box = $("studentNoteBox"),
      s = app.state.students[noteSlot];
    box.hidden = lens !== "note" || !s || !s.name;
    if (box.hidden) return;
    const lesson = lessonFor(lens, false),
      row = lesson && rowFor(lesson, s, noteSlot, false);
    $("studentNoteLabel").textContent = "Observação sobre " + s.name;
    $("studentNote").value = row ? row.note : "";
    $("studentNote").focus();
  }

  function choose(lens, slot, value) {
    if (app.readOnly) return;
    const student = app.state.students[slot];
    if (!student || !student.name) return;
    const lesson = lessonFor(lens, true);
    if (!lesson) return;
    const row = rowFor(lesson, student, slot, true),
      def = MARKS[lens];
    def.set(row, value);
    dirty();
    onChange(
      "✓ " +
        student.name +
        " · " +
        def.label +
        ": " +
        def.options.find(([v]) => v === value)[2],
    );
    render(lens);
  }

  $("studentNote").oninput = function () {
    if (app.readOnly) return;
    const s = app.state.students[noteSlot];
    if (!s || !s.name) return;
    const lesson = lessonFor("note", true);
    if (!lesson) return;
    rowFor(lesson, s, noteSlot, true).note = this.value.slice(0, 1000);
    dirty();
    onChange("✓ Observação de " + s.name + " guardada");
    const button = $("logGrid").querySelector(
      `[data-slot="${noteSlot}"] .log-note`,
    );
    if (button)
      button.textContent = this.value
        ? "📝 " + this.value.slice(0, 40)
        : "＋ Observação";
  };
  $("studentNoteDone").onclick = () => {
    noteSlot = null;
    render("note");
  };

  return {
    render,
    reset() {
      noteSlot = null;
    },
  };
}
