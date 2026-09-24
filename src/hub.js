import { packageBackup } from "./backup.js";
import { autoAvatar } from "./avatars.js";
import { downloadJSON } from "./dom.js";
import { emptyDiary, emptyWorkspace } from "./model.js";
import { copy, stamp, uid } from "./utils.js";

/** Class list: create, duplicate, archive and export classes. */
export function createHub(app) {
  const {
    $,
    element,
    button,
    dirty,
    openOverlay,
    teacher,
    enterClass,
    showHub,
    updateBackupStatus,
  } = app;

  function exportClass(c) {
    const w = emptyWorkspace(),
      current = teacher.current();
    w.classes = [copy(c)];
    w.activeClassId = c.id;
    w.presets = copy(app.workspace.presets);
    w.teachers = current ? [copy(current)] : [];
    w.activeTeacherId = current?.id ?? null;
    downloadJSON(
      packageBackup(w, "class"),
      "TIC_turma_" +
        c.className.replace(/[^a-zA-Z0-9À-ÿ_-]/g, "_") +
        "_" +
        stamp() +
        ".json",
    );
  }
  function duplicateClass(c) {
    const workspace = app.workspace;
    if (workspace.classes.length >= 200) {
      alert("Limite de 200 turmas.");
      return;
    }
    const cloned = copy(c);
    cloned.id = uid();
    cloned.className = (c.className + " · cópia").slice(0, 50);
    cloned.archived = false;
    workspace.classes.push(cloned);
    dirty();
    render();
  }
  function render() {
    const root = $("classGrid"),
      archived = $("showArchived").checked;
    root.textContent = "";
    const shown = app.workspace.classes.filter((c) => c.archived === archived);
    $("emptyHub").hidden = shown.length > 0;
    $("emptyHub").querySelector("h2").textContent = archived
      ? "Sem turmas arquivadas."
      : "A próxima missão começa aqui.";
    shown.forEach((c) => {
      const card = element(
        "article",
        "class-card" + (c.archived ? " archived" : ""),
      );
      card.appendChild(
        element(
          "div",
          "eyebrow pixel",
          c.archived ? "ARQUIVADA" : "MISSÃO ATIVA",
        ),
      );
      card.appendChild(element("h2", "", c.className));
      card.appendChild(
        element(
          "p",
          "class-meta",
          c.students.filter((s) => s.name).length +
            " alunos · " +
            c.history.length +
            " registos · ♥ " +
            c.lives +
            "/5",
        ),
      );
      card.appendChild(
        button("Entrar na turma →", () => enterClass(c.id), "gold class-enter"),
      );
      const actions = element("div", "actions");
      actions.appendChild(button("Duplicar", () => duplicateClass(c), "small"));
      actions.appendChild(
        button(
          c.archived ? "Reativar" : "Arquivar",
          () => {
            c.archived = !c.archived;
            dirty();
            render();
          },
          "small",
        ),
      );
      actions.appendChild(
        button("Exportar turma", () => exportClass(c), "small"),
      );
      card.appendChild(actions);
      root.appendChild(card);
    });
    updateBackupStatus();
  }

  $("createClass").onclick = function () {
    if (!teacher.ensure()) return;
    if (app.workspace.classes.length >= 200) {
      alert("Limite de 200 turmas.");
      return;
    }
    $("setupForm").reset();
    $("setupError").textContent = "";
    openOverlay("setupOverlay", "setupName");
  };
  $("setupForm").onsubmit = function (e) {
    e.preventDefault();
    if (!teacher.ensure()) return;
    const name = $("setupName").value.trim(),
      names = $("setupNames")
        .value.split(/\r?\n/)
        .map((n) => n.trim())
        .filter(Boolean);
    if (
      !name ||
      !names.length ||
      names.length > 30 ||
      names.some((n) => n.length > 60)
    ) {
      $("setupError").textContent =
        "Indica a turma e entre 1 e 30 nomes, até 60 caracteres cada.";
      return;
    }
    const c = {
      version: 6,
      id: uid(),
      className: name,
      lives: 5,
      students: [],
      groups: [],
      history: [],
      archived: false,
      diary: emptyDiary(),
    };
    for (let i = 0; i < 30; i++) {
      const s = {
        name: names[i] || "",
        points: 0,
        inPool: !!names[i],
        gender: "robot",
        avatarMode: "auto",
        avatar: 16,
      };
      autoAvatar(s, i);
      c.students.push(s);
    }
    app.workspace.classes.push(c);
    dirty();
    enterClass(c.id);
    // Continue straight to reviewing names and avatars.
    $("editNames").click();
  };
  $("showArchived").onchange = render;
  $("classesOpen").onclick = showHub;

  return { render };
}
