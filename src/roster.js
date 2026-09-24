import { removeStudent, setStudentName } from "./students.js";
import {
  autoAvatar,
  avatarFor,
  cycleAvatar,
  setCharacter,
  sprite,
} from "./avatars.js";

/** Names and avatars editor. Changes stay in a draft until "Guardar". */
export function createRoster(app) {
  const {
    $,
    openOverlay,
    closeOverlay,
    dirty,
    syncAll,
    status,
    rankedIds,
    confirmRemoval,
  } = app;
  let draft = [];

  function fill() {
    const root = $("rosterList");
    root.textContent = "";
    rankedIds().forEach((id) => {
      const s = draft[id],
        row = document.createElement("div");
      row.className = "roster-row";
      const portrait = document.createElement("span");
      sprite(portrait, avatarFor(s, id));
      const input = document.createElement("input");
      input.className = "field";
      input.value = s.name;
      input.maxLength = 60;
      input.dataset.student = id;
      input.setAttribute("aria-label", "Nome do jogador " + (id + 1));
      input.oninput = function () {
        s.name = this.value.trim();
      };
      input.onchange = function () {
        autoAvatar(s, id);
        sprite(portrait, avatarFor(s, id));
      };
      const select = document.createElement("select");
      select.className = "field";
      select.dataset.gender = id;
      select.setAttribute("aria-label", "Personagem do jogador " + (id + 1));
      [
        ["auto", "Auto"],
        ["robot", "Robô"],
        ["f", "Feminino"],
        ["m", "Masculino"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      });
      select.value = s.avatarMode === "manual" ? s.gender || "robot" : "auto";
      select.onchange = function () {
        setCharacter(s, id, this.value);
        sprite(portrait, s.avatar);
      };
      const next = document.createElement("button");
      next.className = "button small";
      next.textContent = "↻";
      next.setAttribute("aria-label", "Trocar avatar do jogador " + (id + 1));
      next.onclick = function () {
        cycleAvatar(s, id);
        select.value = s.gender;
        sprite(portrait, s.avatar);
      };
      row.appendChild(portrait);
      row.appendChild(input);
      row.appendChild(select);
      row.appendChild(next);
      root.appendChild(row);
    });
  }

  $("editNames").onclick = function () {
    draft = app.state.students.map((s) => Object.assign({}, s));
    $("namesText").value = "";
    fill();
    openOverlay("namesOverlay");
    $("rosterList").querySelector("input").focus();
  };
  $("pasteNames").onclick = function () {
    const text = $("namesText").value.replace(/\r/g, "").trim(),
      names = text ? text.split("\n") : [];
    if (names.length > 30) {
      alert("Podes colocar até 30 nomes.");
      return;
    }
    draft.forEach((s, i) => {
      s.name = (names[i] || "").trim().slice(0, 60);
      autoAvatar(s, i);
    });
    fill();
  };
  $("applyNames").onclick = function () {
    const students = app.state.students,
      names = draft.map((d) => d.name.trim().slice(0, 60));
    // Emptied names remove students; changed names are corrections.
    const removed = students
      .map((s, i) => (s.name && !names[i] ? i : -1))
      .filter((i) => i >= 0);
    if (removed.length && !confirmRemoval(removed)) return;
    students.forEach((s, i) => {
      if (!names[i]) {
        removeStudent(s);
        return;
      }
      setStudentName(s, names[i]);
      s.inPool = true;
      s.gender = draft[i].gender || "robot";
      s.avatar = avatarFor(draft[i], i);
      s.avatarMode = draft[i].avatarMode || "auto";
    });
    dirty();
    syncAll();
    closeOverlay("namesOverlay");
    status("Guardado ✓");
  };
}
