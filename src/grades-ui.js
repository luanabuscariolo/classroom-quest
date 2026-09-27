import { createAssessmentsView } from "./assessments-ui.js";
import { createGradeExplain } from "./grade-explain.js";
import { periodFor } from "./grading.js";
import { createPerformanceView } from "./performance.js";
import { createPeriodGradesView } from "./period-grades-ui.js";
import { createRulesView } from "./rules-ui.js";
import { dayISO } from "./utils.js";

/**
 * "Avaliação": the window, its period and its tabs. Each tab has its own
 * module: Desempenho (performance.js), Acompanhamento and Notas do período
 * (period-grades-ui.js), Trabalhos (assessments-ui.js), Regras (rules-ui.js).
 */
export function createGradesUI(app) {
  const { $, element, openOverlay, requireTeacher } = app;
  let periodId = null,
    tab = "performance";
  const grading = () => app.workspace.grading;
  const performance = createPerformanceView(app),
    explainer = createGradeExplain(app, () => periodId),
    periodGrades = createPeriodGradesView(app, explainer),
    assessments = createAssessmentsView(app),
    rules = createRulesView(app, { onSaved: () => fillPeriods() });

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
    explainer.hide();
    if (tab === "performance") performance.render(periodId);
    else if (tab === "progress") periodGrades.renderProgress(periodId);
    else if (tab === "scores") assessments.render(periodId);
    else if (tab === "summary") periodGrades.renderSummary(periodId);
    else rules.render();
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

  function open() {
    if (!requireTeacher()) return;
    fillPeriods();
    periodGrades.resetEntered();
    setTab(tab);
    openOverlay("gradesOverlay", "gradesPeriod");
  }

  $("gradesOpen").onclick = open;
  $("gradesPeriod").onchange = function () {
    periodId = this.value;
    periodGrades.resetEntered();
    render();
  };
  $("gradesTabPerformance").onclick = () => setTab("performance");
  $("perfView").onchange = render;
  $("perfLesson").onchange = render;
  $("gradesTabProgress").onclick = () => setTab("progress");
  $("gradesTabScores").onclick = () => setTab("scores");
  $("gradesTabSummary").onclick = () => setTab("summary");
  $("gradesTabRules").onclick = () => setTab("rules");

  return { open };
}
