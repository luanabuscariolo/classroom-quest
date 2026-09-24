import { avatarFor, sprite } from "./avatars.js";
import { integer, uid } from "./utils.js";

/**
 * Points for an activity given to several students at once, plus the class
 * history of point events. The history is shown by day in the diary.
 */
export function createActivities(app) {
  const { $, element, dirty, syncAll, playSound, openOverlay, rankedIds } = app;
  const selection = new Set();

  /** Record a point event; the diary and undo depend on these entries. */
  function pushHistory(title, points, slots) {
    const state = app.state;
    if (state.history.length >= 10000) {
      alert(
        "O histórico atingiu o limite. Cria uma turma para o novo período.",
      );
      return false;
    }
    state.history.push({
      id: uid(),
      title,
      date: new Date().toISOString(),
      points,
      recipients: slots.map((i) => ({ slot: i, name: state.students[i].name })),
      undoneAt: null,
    });
    return true;
  }
  function renderPresets() {
    const root = $("activityPresets");
    root.textContent = "";
    app.workspace.presets.forEach((p) => {
      const o = element("option");
      o.value = p.name;
      root.appendChild(o);
    });
  }
  function updateButton() {
    const points = Number($("activityPoints").value),
      count = selection.size;
    $("applyActivity").disabled =
      !count || !$("activityName").value.trim() || !integer(points, 1, 1000);
    $("applyActivity").textContent =
      "Dar +" +
      (integer(points, 1, 1000) ? points : "?") +
      " a " +
      count +
      " aluno" +
      (count === 1 ? "" : "s");
  }
  function selectAll(all) {
    selection.clear();
    document.querySelectorAll("[data-activity-student]").forEach((c) => {
      c.checked = all;
      if (all) selection.add(Number(c.dataset.activityStudent));
    });
    updateButton();
  }
  function open() {
    const state = app.state;
    selection.clear();
    $("activityFeedback").textContent = "";
    $("activityName").value = "";
    $("activityPoints").value = 1;
    renderPresets();
    const root = $("activityStudents");
    root.textContent = "";
    rankedIds()
      .filter((i) => state.students[i].name)
      .forEach((i) => {
        const label = element("label"),
          input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.activityStudent = i;
        input.onchange = function () {
          if (this.checked) selection.add(i);
          else selection.delete(i);
          updateButton();
        };
        const avatar = element("span");
        sprite(avatar, avatarFor(state.students[i], i));
        label.append(
          input,
          avatar,
          element("span", "", state.students[i].name),
        );
        root.appendChild(label);
      });
    updateButton();
    openOverlay("activitiesOverlay", "activityName");
  }

  $("activitiesOpen").onclick = open;
  $("activityName").oninput = updateButton;
  $("activityName").onchange = function () {
    const p = app.workspace.presets.find(
      (p) => p.name === $("activityName").value,
    );
    if (p) $("activityPoints").value = p.points;
    updateButton();
  };
  $("activityPoints").oninput = updateButton;
  $("activityAll").onclick = function () {
    selectAll(true);
  };
  $("activityNone").onclick = function () {
    selectAll(false);
  };
  $("applyActivity").onclick = function () {
    const state = app.state,
      workspace = app.workspace,
      points = Number($("activityPoints").value),
      title = $("activityName").value.trim().slice(0, 100),
      ids = Array.from(selection);
    if (!title || !integer(points, 1, 1000) || !ids.length) return;
    if (
      ids.some((i) => !Number.isSafeInteger(state.students[i].points + points))
    ) {
      alert("Pontuação demasiado elevada.");
      return;
    }
    if (!pushHistory(title, points, ids)) return;
    ids.forEach((i) => {
      state.students[i].points += points;
    });
    if ($("rememberActivity").checked) {
      const preset = workspace.presets.find((p) => p.name === title);
      if (preset) preset.points = points;
      else if (workspace.presets.length < 200)
        workspace.presets.push({ name: title, points });
    }
    dirty();
    syncAll();
    selectAll(false);
    $("activityFeedback").textContent =
      "✓ " + title + " · +" + points + " para " + ids.length + " alunos";
    playSound("win");
    renderPresets();
  };

  return { pushHistory };
}
