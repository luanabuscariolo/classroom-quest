import { downloadBlob } from "./dom.js";
import {
  COMPONENTS,
  classGrades,
  classProgress,
  gradesCsv,
} from "./grading.js";
import { number } from "./grades-format.js";

/**
 * "Acompanhamento" (each part and its change in the last lesson) and "Notas
 * do período" (final grades, Inovar entry list and spreadsheet export).
 */
export function createPeriodGradesView(app, { explainOnClick }) {
  const { $, element } = app;
  let periodId = null,
    inovar = false;
  // Students already typed into Inovar (only while the window is open).
  const entered = new Set();
  const grading = () => app.workspace.grading;

  // ── Acompanhamento ────────────────────────────────────────────────────────
  /**
   * Value (0–100) with the change caused by the last lesson: ▼ lost,
   * ▲ recovered. `scale` 20 shows it on the 0–5 scale.
   */
  function trendCell(value, change, scale = 1) {
    const digits = scale === 1 ? 0 : 2,
      td = element(
        "td",
        value >= 90 ? "band-good" : value >= 70 ? "band-mid" : "band-low",
      );
    td.appendChild(element("span", "", number(value / scale, digits)));
    const step = Number((change / scale).toFixed(digits));
    if (step)
      td.appendChild(
        element(
          "small",
          step < 0 ? "trend down" : "trend up",
          (step < 0 ? " ▼" : " ▲") + number(Math.abs(step), digits),
        ),
      );
    return td;
  }
  function renderProgress() {
    const c = app.state,
      rows = classProgress(c, grading(), periodId),
      table = $("progressTable");
    table.textContent = "";
    $("progressNote").textContent =
      "Todos começam no máximo (100). Cada aula com uma ocorrência baixa a média dessa categoria; " +
      "as aulas seguintes sem ocorrências vão recuperando. ▼/▲ = efeito da última aula registada. " +
      "Nota máxima possível = a nota se tirar 100 em todos os trabalhos ainda sem nota.";
    const head = element("tr");
    [
      "N.º",
      "Aluno",
      "Comport.",
      "Particip.",
      "Assiduid.",
      "Trabalhos (média)",
      "Máxima possível (0–5)",
      "Atual (0–5)",
    ].forEach((h) => head.appendChild(element("th", "", h)));
    table.appendChild(head);
    rows.forEach((r) => {
      const tr = element("tr"),
        name = element("td", "", r.name);
      name.title = [
        r.counts.lessons + " aulas",
        r.counts.absent + " faltas",
        r.counts.late + " atrasos",
        r.counts.noMaterial + " sem material",
      ].join(" · ");
      tr.append(element("td", "", String(r.number)), name);
      tr.append(
        trendCell(r.behavior, r.change.behavior),
        trendCell(r.participation, r.change.participation),
        trendCell(r.attendance, r.change.attendance),
        element(
          "td",
          "",
          r.cognitive === null ? "sem notas" : number(r.cognitive, 0),
        ),
      );
      const best = trendCell(r.best, r.change.best, 20);
      best.classList.add("big");
      tr.append(best, element("td", "", number(r.final5, 2)));
      explainOnClick(tr, "progressExplain", r.number);
      table.appendChild(tr);
    });
  }

  // ── Notas do período ──────────────────────────────────────────────────────
  function renderSummary() {
    const c = app.state,
      rows = classGrades(c, grading(), periodId),
      table = $("summaryTable"),
      w = grading().weights;
    table.textContent = "";
    $("inovarMode").setAttribute("aria-pressed", String(inovar));
    table.classList.toggle("inovar", inovar);
    const incomplete = rows.filter((r) => r.missingScores.length).length;
    $("summaryNote").textContent = inovar
      ? "Lista pela ordem da turma. Marque cada aluno depois de o lançar no Inovar."
      : "Nota final = " +
        Object.entries(COMPONENTS)
          .map(([k, label]) => label + " " + w[k] + "%")
          .join(" + ") +
        ". Escala 0–5 = nota em 100 ÷ 20." +
        (incomplete
          ? " " +
            incomplete +
            " aluno(s) ainda sem todas as notas de trabalhos (*): a nota é provisória."
          : "");
    if (inovar) {
      rows.forEach((r) => {
        const tr = element("tr", entered.has(r.id) ? "entered" : "");
        const check = element("input");
        check.type = "checkbox";
        check.checked = entered.has(r.id);
        check.setAttribute("aria-label", "Lançado no Inovar: " + r.name);
        check.onchange = () => {
          if (check.checked) entered.add(r.id);
          else entered.delete(r.id);
          tr.classList.toggle("entered", check.checked);
        };
        const tdCheck = element("td");
        tdCheck.appendChild(check);
        tr.append(
          tdCheck,
          element("td", "", String(r.number)),
          element("td", "", r.name),
          element("td", "big", number(r.final5, 2)),
        );
        table.appendChild(tr);
      });
      return;
    }
    const head = element("tr");
    [
      "N.º",
      "Aluno",
      ...Object.keys(COMPONENTS).map((k) => shortLabel(k)),
      "Final (0–100)",
      "Final (0–5)",
    ].forEach((h) => head.appendChild(element("th", "", h)));
    table.appendChild(head);
    rows.forEach((r) => {
      const tr = element("tr"),
        name = element("td", "", r.name + (r.missingScores.length ? " *" : ""));
      name.title = [
        r.counts.lessons + " aulas",
        r.counts.absent + " faltas",
        r.counts.excused + " justificadas",
        r.counts.late + " atrasos",
        r.counts.noMaterial + " sem material",
        r.missingScores.length ? "Falta: " + r.missingScores.join(", ") : "",
      ]
        .filter(Boolean)
        .join(" · ");
      tr.append(element("td", "", String(r.number)), name);
      Object.keys(COMPONENTS).forEach((k) =>
        tr.appendChild(element("td", "", number(r[k], 0))),
      );
      tr.append(
        element("td", "", number(r.final, 1)),
        element("td", "big", number(r.final5, 2)),
      );
      explainOnClick(tr, "summaryExplain", r.number);
      table.appendChild(tr);
    });
    const avg = (key) => {
      const values = rows.map((r) => r[key]).filter((x) => x !== null);
      return values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    };
    const foot = element("tr", "average");
    foot.append(element("td"), element("td", "", "Média da turma"));
    Object.keys(COMPONENTS).forEach((k) =>
      foot.appendChild(element("td", "", number(avg(k), 0))),
    );
    foot.append(
      element("td", "", number(avg("final"), 1)),
      element("td", "big", number(avg("final5"), 2)),
    );
    table.appendChild(foot);
  }
  function shortLabel(k) {
    return {
      cognitive: "Cognitivo",
      behavior: "Comport.",
      participation: "Particip.",
      attendance: "Assiduid.",
    }[k];
  }

  $("inovarMode").onclick = () => {
    inovar = !inovar;
    renderSummary();
  };
  $("exportGrades").onclick = () => {
    const c = app.state,
      period = grading().periods.find((p) => p.id === periodId);
    downloadBlob(
      new Blob([gradesCsv(c, grading(), periodId)], {
        type: "text/csv;charset=utf-8",
      }),
      ("TIC_notas_" + c.className + "_" + (period ? period.name : "")).replace(
        /[^a-zA-Z0-9À-ÿ_-]+/g,
        "_",
      ) + ".csv",
    );
  };

  return {
    renderProgress(id) {
      periodId = id;
      renderProgress();
    },
    renderSummary(id) {
      periodId = id;
      renderSummary();
    },
    /** A new period or a new opening starts the Inovar checklist again. */
    resetEntered() {
      entered.clear();
    },
  };
}
