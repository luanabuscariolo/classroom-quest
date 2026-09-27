import { MARKS, markOf } from "./lesson-log.js";
import { studentGrade } from "./grading.js";
import { dateLabel } from "./utils.js";

const number = (x) => (x === null ? "—" : String(Math.round(x)));

/** Day after a YYYY-MM-DD date, to count lessons up to and including it. */
function nextDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10);
}

/**
 * "Desempenho": each student's history lesson by lesson (no averages), with a
 * choice of what to show: everything, one mark, one lesson, or the average up
 * to a chosen lesson.
 */
export function createPerformanceView(app) {
  const { $, element } = app;

  function periodLessons(periodId) {
    const period = app.workspace.grading.periods.find((p) => p.id === periodId);
    if (!period) return [];
    return app.state.diary.lessons
      .filter((l) => l.date >= period.start && l.date <= period.end)
      .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number);
  }
  const students = () =>
    app.state.students
      .map((s, slot) => ({ s, slot }))
      .filter(({ s }) => s.name);

  /** Emojis of one lesson row for the chosen view; faded when all is normal. */
  function cell(view, row) {
    const td = element("td", "perf-cell");
    if (!row) {
      td.title = "Sem registo nesta aula";
      return td;
    }
    let marks;
    if (view === "all") {
      marks = ["status", "behavior", "participation", "material"]
        .map((k) => markOf(k, row))
        .filter((m) => !m.normal);
      if (row.note)
        marks.push({ emoji: "📝", label: "Observação: " + row.note });
    } else if (view === "attendance") {
      marks = [markOf("status", row)];
      if (!row.material) marks.push(markOf("material", row));
    } else marks = [markOf(view, row)];
    const normal = !marks.length || marks.every((m) => m.normal);
    td.classList.toggle("normal", normal);
    td.textContent = marks.length ? marks.map((m) => m.emoji).join(" ") : "✓";
    td.title = marks.length
      ? marks.map((m) => m.label).join(" · ")
      : "Sem ocorrências";
    return td;
  }

  function legend(view) {
    const root = $("perfLegend");
    root.textContent = "";
    const keys =
      view === "all"
        ? ["status", "behavior", "participation", "material"]
        : view === "attendance"
          ? ["status", "material"]
          : MARKS[view]
            ? [view]
            : view === "lesson"
              ? Object.keys(MARKS)
              : [];
    keys.forEach((k) =>
      MARKS[k].options
        .filter((o, i) => view !== "all" || i > 0)
        .forEach(([, emoji, label]) =>
          root.appendChild(element("span", "", emoji + " " + label)),
        ),
    );
    if (view === "all") {
      root.appendChild(element("span", "", "📝 Observação"));
      root.appendChild(element("span", "", "✓ Sem ocorrências"));
    }
    root.hidden = !root.children.length;
  }

  function render(periodId) {
    const view = $("perfView").value,
      lessons = periodLessons(periodId),
      table = $("perfTable"),
      needsLesson = view === "lesson" || view === "average",
      select = $("perfLesson");
    $("perfLessonLabel").hidden = !needsLesson;
    select.hidden = !needsLesson;
    if (needsLesson) {
      const previous = select.value;
      select.textContent = "";
      lessons.forEach((l) => {
        const o = element(
          "option",
          "",
          dateLabel(l.date) + " · Aula " + l.number,
        );
        o.value = l.id;
        select.appendChild(o);
      });
      select.value = lessons.some((l) => l.id === previous)
        ? previous
        : lessons.at(-1)?.id || "";
    }
    legend(view);
    table.textContent = "";
    if (!lessons.length) {
      $("perfNote").textContent =
        "Ainda não há aulas registadas neste período.";
      return;
    }
    const chosen = lessons.find((l) => l.id === select.value);
    $("perfNote").textContent =
      view === "lesson"
        ? "Todas as marcações da aula escolhida."
        : view === "average"
          ? "Média de todas as aulas do período até " +
            dateLabel(chosen.date) +
            " (inclusive). Aulas sem ocorrência contam 100."
          : "Cada coluna é uma aula. Passe o dedo ou o rato por cima de um símbolo para ver o que significa.";
    const head = element("tr");
    head.append(element("th", "", "N.º"), element("th", "", "Aluno"));
    const body = students();
    if (view === "lesson") {
      Object.values(MARKS).forEach((m) =>
        head.appendChild(element("th", "", m.label)),
      );
      head.appendChild(element("th", "", "Observação"));
      table.appendChild(head);
      body.forEach(({ s, slot }) => {
        const tr = element("tr"),
          row = chosen.attendance.find((r) => r.studentId === s.id);
        tr.append(
          element("td", "", String(slot + 1)),
          element("td", "", s.name),
        );
        Object.keys(MARKS).forEach((k) => {
          const td = element("td", "perf-cell");
          if (row) {
            const m = markOf(k, row);
            td.textContent = m.emoji + " " + m.label;
            td.classList.toggle("normal", m.normal);
          }
          tr.appendChild(td);
        });
        tr.appendChild(element("td", "perf-note", row ? row.note : ""));
        table.appendChild(tr);
      });
      return;
    }
    if (view === "average") {
      [
        "Comport.",
        "Particip.",
        "Assiduid.",
        "Aulas",
        "Faltas",
        "Atrasos",
        "Sem material",
      ].forEach((h) => head.appendChild(element("th", "", h)));
      table.appendChild(head);
      body.forEach(({ s, slot }) => {
        const g = studentGrade(
            app.state,
            app.workspace.grading,
            periodId,
            s,
            nextDay(chosen.date),
          ),
          tr = element("tr");
        tr.append(
          element("td", "", String(slot + 1)),
          element("td", "", s.name),
        );
        ["behavior", "participation", "attendance"].forEach((k) =>
          tr.appendChild(
            element(
              "td",
              g[k] >= 90 ? "band-good" : g[k] >= 70 ? "band-mid" : "band-low",
              number(g[k]),
            ),
          ),
        );
        ["lessons", "absent", "late", "noMaterial"].forEach((k) =>
          tr.appendChild(element("td", "", String(g.counts[k]))),
        );
        table.appendChild(tr);
      });
      return;
    }
    // Lesson by lesson: one column per lesson, no averages.
    lessons.forEach((l) => {
      const th = element("th", "perf-day", dateLabel(l.date).slice(0, 5));
      th.title = "Aula " + l.number + " · " + dateLabel(l.date);
      head.appendChild(th);
    });
    table.appendChild(head);
    body.forEach(({ s, slot }) => {
      const tr = element("tr");
      tr.append(element("td", "", String(slot + 1)), element("td", "", s.name));
      lessons.forEach((l) =>
        tr.appendChild(
          cell(
            view,
            l.attendance.find((r) => r.studentId === s.id),
          ),
        ),
      );
      table.appendChild(tr);
    });
  }

  return { render };
}
