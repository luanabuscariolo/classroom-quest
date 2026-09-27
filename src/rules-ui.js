import {
  COMPONENTS,
  LESSON_MARKS,
  defaultGrading,
  validateGrading,
} from "./grading.js";

/** "Regras": weights, values of each mark and school periods. */
export function createRulesView(app, { onSaved }) {
  const { $, element, button, dirty } = app;
  const grading = () => app.workspace.grading;

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
    onSaved();
    $("rulesStatus").textContent =
      "✓ Regras guardadas. As notas foram recalculadas.";
  };

  return { render: renderRules };
}
