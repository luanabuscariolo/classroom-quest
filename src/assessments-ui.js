import {
  assessmentScore,
  criteriaTotal,
  defaultAssessments,
} from "./grading.js";
import { number } from "./grades-format.js";
import { dateLabel, dayISO, integer, uid } from "./utils.js";

/**
 * "Trabalhos": every trabalho of a period in one table, or one trabalho's
 * sheet (name, date, description, criteria with weights) with its marks.
 */
export function createAssessmentsView(app) {
  const { $, element, button, dirty } = app;
  let periodId = null;
  const periodAssessments = () =>
    app.state.assessments.filter((a) => a.periodId === periodId);

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

  return {
    render(id) {
      periodId = id;
      renderScores();
    },
  };
}
