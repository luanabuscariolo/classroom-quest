import { downloadBlob } from "./dom.js";
import {
  COMPONENTS,
  LESSON_MARKS,
  classGrades,
  classProgress,
  assessmentScore,
  criteriaTotal,
  defaultAssessments,
  defaultGrading,
  explainGrade,
  gradesCsv,
  periodFor,
  validateGrading,
} from "./grading.js";
import { createPerformanceView } from "./performance.js";
import { dateLabel, dayISO, integer, uid } from "./utils.js";

const number = (x, digits) =>
  x === null || x === undefined ? "—" : x.toFixed(digits).replace(".", ",");

/**
 * "Avaliação": assessment scores, period grades (with an Inovar entry list and
 * a spreadsheet export) and the editable grading rules.
 */
export function createGradesUI(app) {
  const { $, element, button, openOverlay, dirty, requireTeacher } = app;
  let periodId = null,
    tab = "performance",
    inovar = false;
  const entered = new Set(),
    performance = createPerformanceView(app);

  const grading = () => app.workspace.grading;
  const periodAssessments = () =>
    app.state.assessments.filter((a) => a.periodId === periodId);

  function setTab(name) {
    tab = name;
    [
      ["gradesTabPerformance", "gradesPerformance", "performance"],
      ["gradesTabProgress", "gradesProgress", "progress"],
      ["gradesTabScores", "gradesScores", "scores"],
      ["gradesTabSummary", "gradesSummary", "summary"],
      ["gradesTabRules", "gradesRules", "rules"],
    ].forEach(([tabId, paneId, key]) => {
      $(tabId).setAttribute("aria-pressed", String(key === tab));
      $(paneId).hidden = key !== tab;
    });
    render();
  }

  function render() {
    $("summaryExplain").hidden = true;
    $("progressExplain").hidden = true;
    if (tab === "performance") performance.render(periodId);
    else if (tab === "progress") renderProgress();
    else if (tab === "scores") renderScores();
    else if (tab === "summary") renderSummary();
    else renderRules();
  }

  function fillPeriods() {
    const select = $("gradesPeriod");
    select.textContent = "";
    grading().periods.forEach((p) => {
      const o = element("option", "", p.name);
      o.value = p.id;
      select.appendChild(o);
    });
    if (!grading().periods.some((p) => p.id === periodId))
      periodId = (
        periodFor(grading(), dayISO(new Date())) || grading().periods[0]
      ).id;
    select.value = periodId;
  }

  // ── Trabalhos ─────────────────────────────────────────────────────────────
  // "all": every trabalho of the period in one table (quick score entry);
  // an assessment id: that trabalho's sheet (date, description, criteria).
  let scoresView = "all";
  const score2 = (x) =>
    x === undefined ? "—" : number(x, Number.isInteger(x) ? 0 : 1);
  const namedStudents = () => app.state.students.filter((s) => s.name);

  function scoreInput(label, value, onValue) {
    const input = element("input", "field score");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = 0;
    input.max = 100;
    input.value = value ?? "";
    input.setAttribute("aria-label", label);
    input.onchange = () => {
      const raw = input.value.trim(),
        v = raw === "" ? undefined : Number(raw);
      if (v !== undefined && !integer(v, 0, 100)) {
        input.value = value ?? "";
        input.classList.add("invalid");
        return;
      }
      value = v;
      input.classList.remove("invalid");
      onValue(v);
      dirty();
    };
    return input;
  }

  function renderScores() {
    const c = app.state;
    if (!periodAssessments().length) {
      c.assessments.push(...defaultAssessments(periodId));
      dirty();
    }
    const list = periodAssessments();
    if (!list.some((a) => a.id === scoresView)) scoresView = "all";
    const select = $("scoresView");
    select.textContent = "";
    const all = element("option", "", "Todos os trabalhos do período");
    all.value = "all";
    select.appendChild(all);
    list.forEach((a) => {
      const o = element(
        "option",
        "",
        a.name + (a.date ? " · " + dateLabel(a.date) : ""),
      );
      o.value = a.id;
      select.appendChild(o);
    });
    select.value = scoresView;
    const a = list.find((x) => x.id === scoresView);
    if (a) renderAssessment(a);
    else renderAllScores(list);
  }

  function renderAllScores(list) {
    const c = app.state,
      table = $("scoresTable");
    $("assessmentForm").hidden = true;
    table.textContent = "";
    const total = list.reduce((n, a) => n + a.weight, 0);
    $("scoresNote").textContent =
      "Notas de 0 a 100; deixe em branco o que ainda não foi avaliado. " +
      "Toque no nome de um trabalho para ver a ficha (data, descrição e critérios). " +
      "Os pesos dos trabalhos somam " +
      total +
      "%" +
      (total === 100 ? "." : " (o cálculo usa a proporção entre eles).");
    const head = element("tr");
    head.append(element("th", "", "N.º"), element("th", "", "Aluno"));
    list.forEach((a) => {
      const th = element("th", "assessment-head"),
        open = button(a.name, () => showAssessment(a.id), "small");
      open.title = "Abrir a ficha deste trabalho";
      th.append(
        open,
        element(
          "div",
          "diary-hint",
          [
            a.date ? dateLabel(a.date) : "",
            "peso " + a.weight + "%",
            a.criteria.length ? a.criteria.length + " critérios" : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      head.appendChild(th);
    });
    table.appendChild(head);
    c.students.forEach((s, slot) => {
      if (!s.name) return;
      const tr = element("tr");
      tr.append(element("td", "", String(slot + 1)), element("td", "", s.name));
      list.forEach((a) => {
        const td = element("td");
        // With criteria the score is calculated: it is edited in the sheet.
        if (a.criteria.length) {
          td.className = "computed";
          td.textContent = score2(assessmentScore(a, s.id));
          td.title = "Calculada pelos critérios (toque no nome do trabalho)";
        } else
          td.appendChild(
            scoreInput(a.name + " de " + s.name, a.scores[s.id], (v) => {
              if (v === undefined) delete a.scores[s.id];
              else a.scores[s.id] = v;
            }),
          );
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
  }

  function showAssessment(id) {
    scoresView = id;
    renderScores();
    $("assessmentForm").scrollIntoView?.({ block: "nearest" });
  }

  function labelled(label, input) {
    const wrap = element("label", "rule-field", label + " ");
    wrap.appendChild(input);
    return wrap;
  }
  function weightInput(label, value, onValue) {
    const input = element("input", "field weight");
    input.type = "number";
    input.min = 0;
    input.max = 100;
    input.value = value;
    input.setAttribute("aria-label", label);
    input.onchange = () => {
      const w = Number(input.value);
      if (!integer(w, 0, 100)) {
        input.value = value;
        return;
      }
      value = w;
      onValue(w);
      dirty();
    };
    return input;
  }

  /** One trabalho: its sheet (editable) and the marks per criterion. */
  function renderAssessment(a) {
    const c = app.state,
      form = $("assessmentForm");
    form.hidden = false;
    form.textContent = "";
    const name = element("input", "field");
    name.value = a.name;
    name.maxLength = 60;
    name.onchange = () => {
      a.name = name.value.trim().slice(0, 60) || a.name;
      dirty();
      renderScores();
    };
    const date = element("input", "field");
    date.type = "date";
    date.value = a.date;
    date.onchange = () => {
      a.date = date.value;
      dirty();
      renderScores();
    };
    const description = element("textarea", "field");
    description.rows = 3;
    description.maxLength = 1000;
    description.placeholder =
      "O que os alunos têm de fazer. Ex.: criar uma pasta, criar um ficheiro .txt no Bloco de Notas, guardá-lo na pasta e escrever o texto pedido.";
    description.value = a.description;
    description.onchange = () => {
      a.description = description.value.slice(0, 1000);
      dirty();
    };
    const info = element("div", "assessment-info");
    info.append(
      labelled("Nome", name),
      labelled("Data", date),
      labelled(
        "Peso na nota do período (%)",
        weightInput("Peso de " + a.name + " (%)", a.weight, (w) => {
          a.weight = w;
        }),
      ),
      labelled("Descrição", description),
    );

    // Criteria: name and weight; the weights must add up to 100.
    const total = criteriaTotal(a),
      criteria = element("fieldset", "criteria");
    criteria.appendChild(
      element("legend", "", "Critérios de avaliação (os pesos somam 100%)"),
    );
    a.criteria.forEach((k) => {
      const row = element("div", "criterion-row"),
        kName = element("input", "field");
      kName.value = k.name;
      kName.maxLength = 80;
      kName.setAttribute("aria-label", "Nome do critério");
      kName.onchange = () => {
        k.name = kName.value.trim().slice(0, 80) || k.name;
        dirty();
        renderScores();
      };
      const remove = button(
        "×",
        () => {
          const filled = Object.values(a.marks).filter(
            (m) => m[k.id] !== undefined,
          ).length;
          if (
            filled &&
            !confirm(
              "Apagar o critério " +
                k.name +
                " e as " +
                filled +
                " notas lançadas nele?",
            )
          )
            return;
          a.criteria = a.criteria.filter((x) => x !== k);
          for (const [id, m] of Object.entries(a.marks)) {
            delete m[k.id];
            if (!Object.keys(m).length) delete a.marks[id];
          }
          dirty();
          renderScores();
        },
        "small",
      );
      remove.setAttribute("aria-label", "Apagar o critério " + k.name);
      row.append(
        kName,
        weightInput("Peso de " + k.name + " (%)", k.weight, (w) => {
          k.weight = w;
          renderScores();
        }),
        element("span", "", "%"),
        remove,
      );
      criteria.appendChild(row);
    });
    criteria.appendChild(
      element(
        "p",
        a.criteria.length && total !== 100
          ? "criteria-sum warn"
          : "criteria-sum",
        !a.criteria.length
          ? "Sem critérios: lança-se uma nota única de 0 a 100."
          : total === 100
            ? "✓ Soma dos pesos: 100%. Nota do trabalho = Σ (nota do critério × peso) ÷ 100."
            : "⚠ Soma dos pesos: " +
              total +
              "%. Tem de dar 100% para as notas deste trabalho serem calculadas.",
      ),
    );
    const addCriterion = button(
      "＋ Critério",
      () => {
        if (a.criteria.length >= 12) {
          alert("Limite de 12 critérios por trabalho.");
          return;
        }
        const typed = Object.keys(a.scores).length;
        if (
          typed &&
          !confirm(
            "Com critérios, a nota passa a ser calculada por eles e as " +
              typed +
              " notas lançadas diretamente são apagadas. Continuar?",
          )
        )
          return;
        a.scores = {};
        a.criteria.push({
          id: uid(),
          name: "Critério " + (a.criteria.length + 1),
          weight: Math.max(0, 100 - total),
        });
        dirty();
        renderScores();
      },
      "small",
    );
    const remove = button(
      "Apagar trabalho",
      () => {
        const filled = namedStudents().filter(
          (s) => assessmentScore(a, s.id) !== undefined,
        ).length;
        if (
          !confirm(
            "Apagar " +
              a.name +
              (filled ? " e as notas de " + filled + " aluno(s)" : "") +
              "?",
          )
        )
          return;
        c.assessments = c.assessments.filter((x) => x !== a);
        scoresView = "all";
        dirty();
        renderScores();
      },
      "small",
    );
    const actions = element("div", "actions");
    actions.append(addCriterion, remove);
    form.append(info, criteria, actions);

    $("scoresNote").textContent = a.criteria.length
      ? "Nota de 0 a 100 em cada critério (100 = fez tudo, 50 = em parte, 0 = não fez). " +
        "A nota do trabalho aparece quando todos os critérios têm nota."
      : "Nota de 0 a 100; deixe em branco o que ainda não foi avaliado.";
    renderAssessmentTable(a);
  }

  function renderAssessmentTable(a) {
    const c = app.state,
      table = $("scoresTable");
    table.textContent = "";
    const head = element("tr");
    head.append(element("th", "", "N.º"), element("th", "", "Aluno"));
    a.criteria.forEach((k) => {
      const th = element("th", "assessment-head");
      th.append(
        element("div", "", k.name),
        element("div", "diary-hint", "peso " + k.weight + "%"),
      );
      const fill = button(
        "Vazios → 100",
        () => {
          namedStudents().forEach((s) => {
            a.marks[s.id] ??= {};
            a.marks[s.id][k.id] ??= 100;
          });
          dirty();
          renderAssessmentTable(a);
        },
        "small",
      );
      fill.title = "Dar 100 neste critério a quem ainda não tem nota";
      th.appendChild(fill);
      head.appendChild(th);
    });
    head.appendChild(
      element("th", "", a.criteria.length ? "Nota do trabalho" : "Nota"),
    );
    table.appendChild(head);
    c.students.forEach((s, slot) => {
      if (!s.name) return;
      const tr = element("tr");
      tr.append(element("td", "", String(slot + 1)), element("td", "", s.name));
      if (!a.criteria.length) {
        const td = element("td");
        td.appendChild(
          scoreInput(a.name + " de " + s.name, a.scores[s.id], (v) => {
            if (v === undefined) delete a.scores[s.id];
            else a.scores[s.id] = v;
          }),
        );
        tr.appendChild(td);
        table.appendChild(tr);
        return;
      }
      const total = element("td", "big");
      const refresh = () =>
        (total.textContent = score2(assessmentScore(a, s.id)));
      a.criteria.forEach((k) => {
        const td = element("td");
        td.appendChild(
          scoreInput(k.name + " de " + s.name, a.marks[s.id]?.[k.id], (v) => {
            a.marks[s.id] ??= {};
            if (v === undefined) delete a.marks[s.id][k.id];
            else a.marks[s.id][k.id] = v;
            if (!Object.keys(a.marks[s.id]).length) delete a.marks[s.id];
            refresh();
          }),
        );
        tr.appendChild(td);
      });
      refresh();
      tr.appendChild(total);
      table.appendChild(tr);
    });
  }

  // ── "Como foi calculada": the numbers behind one student's grade ─────────
  function explain(boxId, studentNumber) {
    const box = $(boxId),
      s = app.state.students[studentNumber - 1];
    if (!s || !s.name) return;
    const e = explainGrade(app.state, grading(), periodId, s);
    box.textContent = "";
    box.hidden = false;
    const head = element("div", "modal-heading");
    head.append(
      element("h3", "", "Como foi calculada · " + s.name),
      button("Fechar", () => (box.hidden = true), "small"),
    );
    box.appendChild(head);
    box.appendChild(
      element(
        "p",
        "diary-hint",
        e.lessons + " aula(s) registada(s) neste período.",
      ),
    );
    const list = element("dl");
    e.parts.forEach((p) => {
      list.appendChild(
        element(
          "dt",
          "",
          p.label +
            " (peso " +
            p.weight +
            "%): " +
            (p.result === null ? "—" : number2(p.result)),
        ),
      );
      list.appendChild(element("dd", "", p.formula));
    });
    list.appendChild(
      element(
        "dt",
        "final",
        "Nota final: " +
          (e.grade.final === null
            ? "—"
            : number2(e.grade.final) +
              " em 100 · " +
              number(e.grade.final5, 2) +
              " em 5"),
      ),
    );
    list.appendChild(element("dd", "", e.final.formula));
    box.appendChild(list);
    box.scrollIntoView({ block: "nearest" });
  }
  const number2 = (x) =>
    number(Math.round(x * 100) / 100, Number.isInteger(x) ? 0 : 2);
  /** Clicking a row (not a checkbox) explains that student's grade. */
  function explainOnClick(tr, boxId, studentNumber) {
    tr.classList.add("explainable");
    tr.title = "Tocar para ver como foi calculada";
    tr.onclick = (e) => {
      if (e.target.closest("input")) return;
      explain(boxId, studentNumber);
    };
  }

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

  // ── Regras ────────────────────────────────────────────────────────────────
  function numberField(label, value, key, fixed = false) {
    const wrap = element("label", "rule-field", label + " ");
    const input = element("input", "field");
    input.type = "number";
    input.min = 0;
    input.max = 100;
    input.value = value;
    input.dataset.rule = key;
    // The normal mark is the starting point and always worth 100.
    if (fixed) {
      input.disabled = true;
      input.title = "Ponto de partida: vale sempre 100";
    }
    wrap.appendChild(input);
    return wrap;
  }
  function renderRules() {
    const g = grading(),
      form = $("rulesForm");
    form.textContent = "";
    $("rulesStatus").textContent = "";
    const weights = element("fieldset");
    weights.appendChild(
      element("legend", "", "Pesos na nota final (somam 100%)"),
    );
    Object.entries(COMPONENTS).forEach(([k, label]) =>
      weights.appendChild(
        numberField(label + " (%)", g.weights[k], "weights." + k),
      ),
    );
    const marks = element("fieldset");
    marks.appendChild(
      element("legend", "", "Valor de cada marcação por aula (0–100)"),
    );
    ["behavior", "participation"].forEach((group) =>
      Object.entries(LESSON_MARKS[group]).forEach(([k, label]) =>
        marks.appendChild(
          numberField(
            (group === "behavior" ? "Comportamento " : "Participação ") + label,
            g.values[group][k],
            group + "." + k,
            (group === "behavior" && k === "good") ||
              (group === "participation" && k === "normal"),
          ),
        ),
      ),
    );
    marks.appendChild(
      numberField("Desconto por atraso", g.values.late, "late"),
    );
    marks.appendChild(
      numberField(
        "Desconto por falta de material",
        g.values.noMaterial,
        "noMaterial",
      ),
    );
    marks.appendChild(
      element(
        "p",
        "diary-hint",
        "Cada aula vale 100 em assiduidade, menos os descontos; falta vale 0; falta justificada não conta.",
      ),
    );
    const periods = element("fieldset");
    periods.appendChild(element("legend", "", "Períodos"));
    g.periods.forEach((p, i) => {
      const row = element("div", "period-row");
      const name = element("input", "field");
      name.value = p.name;
      name.maxLength = 40;
      name.dataset.period = i + ".name";
      name.setAttribute("aria-label", "Nome do período");
      const start = element("input", "field");
      start.type = "date";
      start.value = p.start;
      start.dataset.period = i + ".start";
      start.setAttribute("aria-label", "Início de " + p.name);
      const end = element("input", "field");
      end.type = "date";
      end.value = p.end;
      end.dataset.period = i + ".end";
      end.setAttribute("aria-label", "Fim de " + p.name);
      row.append(name, start, element("span", "", "até"), end);
      periods.appendChild(row);
    });
    const actions = element("div", "actions");
    const save = element("button", "button gold", "Guardar regras");
    save.type = "submit";
    actions.append(
      save,
      button(
        "Repor valores sugeridos",
        () => {
          if (
            !confirm("Repor pesos e valores sugeridos? Os períodos mantêm-se.")
          )
            return;
          const d = defaultGrading();
          app.workspace.grading = { ...d, periods: g.periods };
          dirty();
          renderRules();
          $("rulesStatus").textContent = "✓ Valores sugeridos repostos.";
        },
        "small",
      ),
    );
    form.append(weights, marks, periods, actions);
  }
  $("rulesForm").onsubmit = function (e) {
    e.preventDefault();
    const g = grading(),
      next = JSON.parse(JSON.stringify(g));
    this.querySelectorAll("[data-rule]").forEach((input) => {
      const path = input.dataset.rule.split("."),
        v = Number(input.value);
      if (path.length === 1) next.values[path[0]] = v;
      else if (path[0] === "weights") next.weights[path[1]] = v;
      else next.values[path[0]][path[1]] = v;
    });
    this.querySelectorAll("[data-period]").forEach((input) => {
      const [i, key] = input.dataset.period.split(".");
      next.periods[i][key] = key === "name" ? input.value.trim() : input.value;
    });
    const sum = Object.values(next.weights).reduce((a, b) => a + b, 0);
    try {
      if (sum !== 100)
        throw Error("Os pesos somam " + sum + "%; têm de somar 100%.");
      app.workspace.grading = validateGrading(next);
    } catch (err) {
      $("rulesStatus").textContent =
        "⚠ " + err.message + " Verifique os valores (0–100) e as datas.";
      return;
    }
    dirty();
    fillPeriods();
    $("rulesStatus").textContent =
      "✓ Regras guardadas. As notas foram recalculadas.";
  };

  function open() {
    if (!requireTeacher()) return;
    fillPeriods();
    entered.clear();
    setTab(tab);
    openOverlay("gradesOverlay", "gradesPeriod");
  }

  $("gradesOpen").onclick = open;
  $("gradesPeriod").onchange = function () {
    periodId = this.value;
    entered.clear();
    render();
  };
  $("gradesTabPerformance").onclick = () => setTab("performance");
  $("perfView").onchange = render;
  $("perfLesson").onchange = render;
  $("gradesTabProgress").onclick = () => setTab("progress");
  $("gradesTabScores").onclick = () => setTab("scores");
  $("gradesTabSummary").onclick = () => setTab("summary");
  $("gradesTabRules").onclick = () => setTab("rules");
  $("scoresView").onchange = function () {
    scoresView = this.value;
    renderScores();
  };
  $("addAssessment").onclick = () => {
    const c = app.state;
    if (c.assessments.length >= 200) {
      alert("Limite de 200 avaliações por turma.");
      return;
    }
    const a = {
      id: uid(),
      periodId,
      name: "Trabalho " + (periodAssessments().length + 1),
      weight: 0,
      date: dayISO(new Date()),
      description: "",
      criteria: [],
      scores: {},
      marks: {},
    };
    c.assessments.push(a);
    dirty();
    showAssessment(a.id);
  };
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

  return { open };
}
