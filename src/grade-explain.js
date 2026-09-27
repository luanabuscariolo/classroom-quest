import { explainGrade } from "./grading.js";
import { number, number2 } from "./grades-format.js";

/**
 * "Como foi calculada": tapping a student in Acompanhamento or Notas do
 * período shows every number behind the grade. `periodId` is a getter.
 */
export function createGradeExplain(app, periodId) {
  const { $, element, button } = app;

  // ── "Como foi calculada": the numbers behind one student's grade ─────────
  function explain(boxId, studentNumber) {
    const box = $(boxId),
      s = app.state.students[studentNumber - 1];
    if (!s || !s.name) return;
    const e = explainGrade(app.state, app.workspace.grading, periodId(), s);
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
  /** Clicking a row (not a checkbox) explains that student's grade. */
  function explainOnClick(tr, boxId, studentNumber) {
    tr.classList.add("explainable");
    tr.title = "Tocar para ver como foi calculada";
    tr.onclick = (e) => {
      if (e.target.closest("input")) return;
      explain(boxId, studentNumber);
    };
  }

  function hide() {
    $("summaryExplain").hidden = true;
    $("progressExplain").hidden = true;
  }

  return { explainOnClick, hide };
}
