/**
 * Entry point. Owns the open class and the game board (cards, ranking,
 * selected student, lives and points) and wires the other controllers.
 * Each controller receives its dependencies explicitly; getters are used for
 * values that change, because opening a class or restoring a backup replaces
 * the objects.
 */
import { createActivities } from "./activities.js";
import { createAttention } from "./attention.js";
import { createAudio } from "./audio.js";
import {
  autoAvatar,
  avatarFor,
  cycleAvatar,
  setCharacter,
  sprite,
} from "./avatars.js";
import { createBackupUI } from "./backup-ui.js";
import { createDiary } from "./diary.js";
import { $, button, element, reducedMotion, replay } from "./dom.js";
import { createGradesUI } from "./grades-ui.js";
import { createHub } from "./hub.js";
import { createPersistence } from "./persistence.js";
import { connectRoom, isRoom } from "./room.js";
import { createPresentation } from "./presentation.js";
import { createRaffle } from "./raffle.js";
import { createRoster } from "./roster.js";
import { createTeacher } from "./teacher.js";
import { createTeams } from "./teams.js";
import { THEMES, THEME_KEY, applyTheme } from "./theme.js";
import { removeStudent, setStudentName } from "./students.js";
import { dateLabel, dayISO, pad, stampOn, validDay } from "./utils.js";

const { playSound } = createAudio(document, window);

// Placeholder until enterClass() opens a class from the workspace.
let state = { version: 6, className: "", lives: 5, students: [], groups: [] };
// Day of the lesson being taught: chosen on the class list, used by every
// record made while the class is open (Registo, points).
let sessionDay = dayISO(new Date()),
  // A past lesson opens read-only; "Editar esta aula" allows changes until
  // "Terminar edição" (or leaving the class).
  readOnly = false;
let selected = -1,
  cards = [],
  returnFocus = null,
  lifeToastTimer = null,
  statusTimer = null,
  stageTimer = null,
  masterTimer = null;
const rankById = [],
  collator = new Intl.Collator("pt-PT", { sensitivity: "base", numeric: true });

function status(t) {
  $("status").textContent = t;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    $("status").textContent = "";
  }, 3500);
}

// ── Students and ranking ────────────────────────────────────────────────────

/** Slots with a named student. */
function activeSlots() {
  return state.students
    .map((s, i) => (s.name.trim() ? i : -1))
    .filter((i) => i >= 0);
}
/** Named students marked "no sorteio", in ranking order. */
function pool() {
  return rankedIds().filter(
    (i) => !!state.students[i].name && state.students[i].inPool,
  );
}
/** Slots ordered by points, then name; empty slots last. */
function rankedIds() {
  return state.students
    .map((s, i) => i)
    .sort((a, b) => {
      const x = state.students[a],
        y = state.students[b];
      if (!!x.name !== !!y.name) return x.name ? -1 : 1;
      return y.points - x.points || collator.compare(x.name, y.name) || a - b;
    });
}
function cardLabel(s, position) {
  return (
    (s.name || "Sem nome") +
    ", posição " +
    position +
    ", " +
    s.points +
    " pontos"
  );
}
function renderRanking() {
  const root = $("players");
  rankedIds().forEach((id, index) => {
    rankById[id] = index + 1;
    if (root.children[index] !== cards[id].card)
      root.insertBefore(cards[id].card, root.children[index] || null);
    cards[id].num.textContent = pad(index + 1);
    cards[id].card.dataset.rank = index + 1;
    cards[id].button.setAttribute(
      "aria-label",
      cardLabel(state.students[id], index + 1),
    );
  });
  $("selectedSeat").textContent =
    selected < 0 ? "" : "JOGADOR · POSIÇÃO " + pad(rankById[selected] || 1);
}
function buildCards() {
  const root = $("players");
  root.textContent = "";
  cards = [];
  state.students.forEach((s, i) => {
    const card = element("article", "player");
    const b = element("button", "player-button");
    b.type = "button";
    b.dataset.seat = i;
    const num = element("span", "seat-num pixel", pad(i + 1));
    const avatar = element("span", "avatar");
    sprite(avatar, avatarFor(s, i));
    avatar.setAttribute("aria-hidden", "true");
    const name = element("span", "player-name");
    const points = element("span", "player-points");
    b.append(num, avatar, name, points);
    b.addEventListener("click", () => {
      selectStudent(i);
      if (window.innerWidth <= 850)
        document
          .querySelector(".character")
          .scrollIntoView({ block: "center", behavior: "auto" });
    });
    const label = element("label", "pool-label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.pool = i;
    checkbox.addEventListener("change", () => {
      state.students[i].inPool = checkbox.checked;
      dirty();
      updateCard(i);
      updateCounts();
    });
    label.append(checkbox, element("span", "", "NO SORTEIO"));
    card.append(b, label);
    root.appendChild(card);
    cards.push({ card, button: b, name, points, checkbox, avatar, num });
    updateCard(i);
  });
}
function updateCard(i) {
  const s = state.students[i],
    c = cards[i];
  sprite(c.avatar, avatarFor(s, i));
  c.card.classList.toggle("chosen", selected === i);
  c.card.classList.toggle("excluded", !s.inPool);
  c.card.classList.toggle("empty", !s.name);
  c.name.textContent = s.name || "Sem nome";
  c.name.title = s.name;
  c.points.textContent = "★ " + s.points;
  c.button.setAttribute("aria-label", cardLabel(s, rankById[i] || i + 1));
  c.button.setAttribute("aria-pressed", selected === i ? "true" : "false");
  c.checkbox.checked = s.inPool && !!s.name;
  c.checkbox.disabled = !s.name || readOnly;
  c.checkbox.setAttribute(
    "aria-label",
    "Incluir " + (s.name || "mesa " + (i + 1)) + " no sorteio",
  );
}
function updateCounts() {
  $("poolCount").textContent = pool().length + " no sorteio";
  $("playerCount").textContent = activeSlots().length + " JOGADORES";
  renderRanking();
}
function setPoolAll(included) {
  state.students.forEach((s, i) => {
    s.inPool = included && !!s.name;
    updateCard(i);
  });
  dirty();
  updateCounts();
}
$("selectAll").onclick = function () {
  setPoolAll(true);
};
$("selectNone").onclick = function () {
  setPoolAll(false);
};

// ── Selected student and stage ──────────────────────────────────────────────

function selectStudent(i) {
  playSound("select");
  selected = i;
  cards.forEach((c, j) => {
    c.card.classList.toggle("chosen", i === j);
    c.button.setAttribute("aria-pressed", i === j ? "true" : "false");
  });
  updateEditor();
  status((state.students[i].name || "Mesa " + (i + 1)) + " selecionado");
}
function clearSelection() {
  if (selected < 0) return;
  selected = -1;
  cards.forEach((c) => {
    c.card.classList.remove("chosen");
    c.button.setAttribute("aria-pressed", "false");
  });
  raffle.clearHighlights();
  $("drawOutput").textContent = "";
  updateEditor();
  status(teacher.displayName() + " no comando");
}
/** Side panel: the selected student, or the teacher when nobody is selected. */
function updateEditor() {
  const s = state.students[selected];
  $("masterProfile").hidden = !!s;
  $("studentProfile").hidden = !s;
  $("characterPanel").classList.toggle("master-mode", !s);
  [
    "scoreMinus",
    "scorePlus",
    "scorePlusTwo",
    "scorePlusFive",
    "scorePlusTen",
    "removeStudent",
  ].forEach((id) => {
    $(id).disabled = !s || !s.name || readOnly;
  });
  if (!s) {
    $("selectedName").textContent = "";
    $("selectedScore").textContent = "";
    $("studentName").value = "";
    $("selectedSeat").textContent = "";
    $("selectedAvatar").removeAttribute("data-avatar");
    renderScene();
    return;
  }
  $("selectedSeat").textContent =
    "JOGADOR · POSIÇÃO " + pad(rankById[selected] || 1);
  sprite($("selectedAvatar"), avatarFor(s, selected));
  $("studentGender").value =
    s.avatarMode === "manual" ? s.gender || "robot" : "auto";
  $("selectedName").textContent = s.name || "Sem nome";
  $("selectedScore").textContent = "★ " + s.points;
  $("studentName").value = s.name;
  renderScene();
}
/** Stage: the selected student walks forward as points grow (20 per level). */
function renderScene(effect) {
  const s = state.students[selected],
    level = s ? Math.floor(Math.max(0, s.points) / 20) + 1 : 1,
    progress = s ? Math.max(0, s.points) % 20 : 0;
  $("stageName").textContent = s
    ? s.name || "—"
    : teacher.displayName().toUpperCase();
  $("stageLevel").textContent = s ? "FASE " + pad(level) : "♛ MASTER";
  if (s) sprite($("stageSprite"), avatarFor(s, selected));
  else teacher.sprite($("stageSprite"));
  $("stageActor").style.left = 8 + progress * 4.2 + "%";
  $("stage").classList.toggle("dead", state.lives === 0);
  $("stageGameOver").hidden = state.lives > 0;
  if (effect) {
    $("stageActor").classList.remove("jump", "hurt", "heal");
    replay($("stageActor"), effect);
    if (effect === "hurt") replay($("stage"), "hit");
  }
}
function sceneMessage(text) {
  clearTimeout(stageTimer);
  $("stageMessage").textContent = text;
  stageTimer = setTimeout(() => {
    $("stageMessage").textContent = "";
  }, 1500);
}
function syncAll() {
  $("className").value = state.className;
  cards.forEach((c, i) => {
    updateCard(i);
  });
  updateCounts();
  updateHealth();
  updateEditor();
  teams.render();
  renderScene();
}

$("className").addEventListener("input", function () {
  state.className = this.value.slice(0, 50);
  dirty();
});
/** Remove the students in these slots (after confirmation) and free the slots. */
function confirmRemoval(slots) {
  const names = slots.map((i) => state.students[i].name);
  if (
    !names.length ||
    !confirm(
      "Remover da turma: " +
        names.join(", ") +
        "?\nA pontuação atual é apagada. O histórico e o diário mantêm os registos antigos.",
    )
  )
    return false;
  slots.forEach((i) => {
    removeStudent(state.students[i]);
    state.groups.forEach((g) => {
      g.members = g.members.filter((m) => m !== i);
    });
  });
  return true;
}
function afterStudentChange(message) {
  dirty();
  syncAll();
  status(message);
}
$("nameForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (selected < 0) return;
  const s = state.students[selected],
    name = $("studentName").value.trim().slice(0, 60);
  if (!name) {
    // Clearing the name means removing the student.
    if (s.name && confirmRemoval([selected])) {
      clearSelection();
      afterStudentChange("Aluno removido da turma.");
    } else $("studentName").value = s.name;
    return;
  }
  const change = setStudentName(s, name);
  if (change === "same") return;
  autoAvatar(s, selected);
  afterStudentChange(
    change === "new"
      ? "Aluno adicionado."
      : "Nome corrigido. O histórico do aluno mantém-se.",
  );
});
$("removeStudent").onclick = function () {
  if (selected < 0 || !state.students[selected].name) return;
  if (!confirmRemoval([selected])) return;
  clearSelection();
  afterStudentChange("Aluno removido da turma.");
};
$("studentGender").onchange = function () {
  if (selected < 0) return;
  setCharacter(state.students[selected], selected, this.value);
  dirty();
  updateCard(selected);
  updateEditor();
};
$("nextAvatar").onclick = function () {
  if (selected < 0) return;
  cycleAvatar(state.students[selected], selected);
  dirty();
  updateCard(selected);
  updateEditor();
};
$("clearStudent").onclick = clearSelection;
// Clicking outside the board or pressing Escape returns to the teacher.
document.addEventListener(
  "click",
  (e) => {
    if (
      selected < 0 ||
      e.target.closest(
        ".player, .character, .overlay, #registoOpen, #gameProject",
      )
    )
      return;
    clearSelection();
  },
  true,
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.querySelector(".overlay:not([hidden])"))
    clearSelection();
});

function masterRally() {
  playSound("win");
  replay($("masterAvatar"), "master-salute");
  renderScene("jump");
  sceneMessage("MASTER NO COMANDO!");
  $("masterCommand").textContent = "MISSÃO: ARRASAR!";
  clearTimeout(masterTimer);
  masterTimer = setTimeout(() => {
    $("masterCommand").textContent = "NO COMANDO";
  }, 2600);
}
$("masterPortrait").onclick = masterRally;
$("masterRally").onclick = masterRally;

// ── Points and lives ────────────────────────────────────────────────────────

function floatingPoints(target, n) {
  if (reducedMotion()) return;
  const box = target.getBoundingClientRect(),
    p = element(
      "span",
      "points-float" + (n < 0 ? " negative" : ""),
      (n > 0 ? "+" : "") + n + " ★",
    );
  p.style.left =
    Math.max(
      12,
      Math.min(window.innerWidth - 90, box.left + box.width / 2 - 24),
    ) + "px";
  p.style.top = box.top + "px";
  document.body.appendChild(p);
  setTimeout(() => {
    p.remove();
  }, 1050);
}
function addPoints(i, n) {
  if (readOnly) return;
  const s = state.students[i];
  if (i < 0 || !s || !Number.isSafeInteger(s.points + n)) return;
  if (!activities.pushHistory("Ajuste individual", n, [i])) return;
  const previousLevel = Math.floor(Math.max(0, s.points) / 20);
  playSound(n > 0 ? "point" : "minus");
  s.points += n;
  dirty();
  updateCard(i);
  updateCounts();
  if (selected === i) {
    $("selectedScore").textContent = "★ " + s.points;
    replay($("selectedScore"), "score-pop");
  }
  const target = !$("winnerOverlay").hidden
    ? $("winnerPoint")
    : $("selectedScore");
  floatingPoints(target, n);
  renderScene(n > 0 ? "jump" : "hurt");
  if (n > 0 && Math.floor(Math.max(0, s.points) / 20) > previousLevel) {
    sceneMessage("NOVA FASE!");
    playSound("win");
  }
  status(
    (n > 0 ? "+" : "") +
      n +
      " ponto" +
      (Math.abs(n) > 1 ? "s" : "") +
      " para " +
      s.name +
      "!",
  );
}
$("scoreMinus").onclick = function () {
  addPoints(selected, -1);
};
$("scorePlus").onclick = function () {
  addPoints(selected, 1);
};
$("scorePlusTwo").onclick = function () {
  addPoints(selected, 2);
};
$("scorePlusFive").onclick = function () {
  addPoints(selected, 5);
};
$("scorePlusTen").onclick = function () {
  addPoints(selected, 10);
};

function updateHealth() {
  $("hpNumber").textContent = state.lives + " / 5";
  $("hpBlocks").setAttribute("aria-valuenow", state.lives);
  Array.from($("hpBlocks").children).forEach((b, i) => {
    b.classList.toggle("lost", i >= state.lives);
    b.textContent = i < state.lives ? "♥" : "♡";
  });
}
function changeLife(amount) {
  if (readOnly) return;
  const previous = state.lives;
  state.lives = Math.max(0, Math.min(5, state.lives + amount));
  const delta = state.lives - previous;
  if (!delta) {
    status(
      amount > 0 ? "A energia já está completa." : "A turma já está sem vidas.",
    );
    return;
  }
  dirty();
  updateHealth();
  const gain = delta > 0;
  renderScene(gain ? "heal" : "hurt");
  sceneMessage(gain ? "+ ♥" : "− ♥");
  playSound(gain ? "gain" : "loss");
  Array.from($("hpBlocks").children).forEach((block, i) => {
    block.classList.remove("hp-gain", "hp-loss");
    if (
      i >= Math.min(previous, state.lives) &&
      i < Math.max(previous, state.lives)
    )
      replay(block, gain ? "hp-gain" : "hp-loss");
  });
  $("healthHud").classList.remove("hud-hit", "hud-heal");
  replay($("healthHud"), gain ? "hud-heal" : "hud-hit");
  const toast = $("lifeToast");
  toast.hidden = false;
  toast.classList.toggle("loss", !gain);
  $("lifeToastIcon").textContent = gain ? "♥" : "♡";
  $("lifeToastText").textContent =
    (gain ? "+" : "") + delta + " VIDA" + (Math.abs(delta) > 1 ? "S" : "");
  replay(toast, "toast-run");
  clearTimeout(lifeToastTimer);
  lifeToastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 1700);
  status(
    gain
      ? "Energia recuperada! " + state.lives + " de 5 vidas."
      : "A turma perdeu uma vida. Restam " + state.lives + " de 5.",
  );
}
$("lifeMinus").onclick = function () {
  changeLife(-1);
};
$("lifePlus").onclick = function () {
  changeLife(1);
};
$("newLesson").onclick = function () {
  if (
    confirm(
      "Repor as 5 vidas para uma nova aula? Os pontos dos alunos e das equipas mantêm-se.",
    )
  ) {
    changeLife(5 - state.lives);
    status("♥ ♥ ♥ ♥ ♥");
  }
};

// ── Overlays ────────────────────────────────────────────────────────────────

function openOverlay(id, focusId) {
  returnFocus = document.activeElement;
  $(id).hidden = false;
  const focusTarget = focusId ? $(focusId) : $(id).querySelector("button");
  if (focusTarget) focusTarget.focus();
}
function closeOverlay(id) {
  if (id === "roomOverlay") return; // the room code is required
  if (id === "registoOverlay" && !diary.beforeClose()) return;
  if (id === "drawOverlay") {
    raffle.cancel();
    return;
  }
  if (id === "attentionOverlay") {
    attention.stop();
    document.body.classList.remove("silence-active");
    share("attention-close");
  }
  if (id === "winnerOverlay") share("winner-close");
  $(id).hidden = true;
  if (returnFocus && returnFocus.focus) returnFocus.focus();
}
document.querySelectorAll("[data-close]").forEach((b) => {
  b.addEventListener("click", () => {
    closeOverlay(b.dataset.close);
  });
});
// Escape closes the top overlay; Tab stays inside it.
document.addEventListener("keydown", (e) => {
  const overlays = Array.from(document.querySelectorAll(".overlay")).filter(
    (o) => !o.hidden,
  );
  if (!overlays.length) return;
  const open = overlays[overlays.length - 1];
  if (e.key === "Escape") closeOverlay(open.id);
  if (e.key === "Tab") {
    const items = Array.from(
        open.querySelectorAll("button,input,select,textarea"),
      ).filter((el) => !el.disabled && el.getClientRects().length),
      first = items[0],
      last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

// ── Session: class hub ↔ open class ─────────────────────────────────────────

function dirty() {
  persistence.dirty();
}
function stopSession() {
  document.body.classList.remove("silence-active");
  raffle.stop();
  attention.stop();
  clearTimeout(stageTimer);
  $("stageMessage").textContent = "";
  clearTimeout(lifeToastTimer);
  $("lifeToast").hidden = true;
  document.querySelectorAll(".overlay").forEach((o) => {
    o.hidden = true;
  });
  selected = -1;
  $("drawOutput").textContent = "";
}
function showHub() {
  stopSession();
  teacher.refresh();
  $("gameMain").hidden = true;
  $("classHub").hidden = false;
  hub.render();
  $(teacher.current() ? "createClass" : "teacherName").focus();
}
// Controls that change data; disabled while a past lesson is read-only.
const EDIT_CONTROLS = [
  "className",
  "editNames",
  "activitiesOpen",
  "lifeMinus",
  "lifePlus",
  "newLesson",
  "draw",
  "attention",
  "masterAttention",
  "studentName",
  "studentGender",
  "nextAvatar",
  "selectAll",
  "selectNone",
  "makeTeams",
];
/** Open a day: today is editable; a past day starts read-only. */
function setSessionDay(day) {
  sessionDay = validDay(day) ? day : dayISO(new Date());
  setReadOnly(sessionDay !== dayISO(new Date()));
}
function setReadOnly(flag) {
  readOnly = flag;
  const isToday = sessionDay === dayISO(new Date());
  $("gameSessionDay").textContent =
    "AULA DE " + dateLabel(sessionDay) + (isToday ? "" : " ⚠");
  $("gameSessionDay").classList.toggle("not-today", !isToday);
  $("sessionBanner").hidden = isToday;
  $("sessionBanner").classList.toggle("editing", !readOnly);
  $("sessionBannerText").textContent = readOnly
    ? "📅 Aula de " + dateLabel(sessionDay) + " · só leitura"
    : "✎ A editar a aula de " +
      dateLabel(sessionDay) +
      " · as alterações ficam nesse dia";
  $("sessionEdit").hidden = !readOnly;
  $("sessionEndEdit").hidden = readOnly || isToday;
  EDIT_CONTROLS.forEach((id) => ($(id).disabled = readOnly));
  $("nameForm").querySelector("button").disabled = readOnly;
  $("gameMain").classList.toggle("read-only", readOnly);
  if (cards.length) syncAll();
}
function startEditing() {
  if (
    !readOnly ||
    !confirm(
      "Editar a aula de " +
        dateLabel(sessionDay) +
        "?\nO que alterar fica gravado nesse dia.",
    )
  )
    return false;
  setReadOnly(false);
  status("✎ A editar a aula de " + dateLabel(sessionDay));
  return true;
}
$("sessionEdit").onclick = startEditing;
$("sessionEndEdit").onclick = () => {
  setReadOnly(true);
  status("✓ Edição terminada. A aula voltou a ficar só de leitura.");
};
// ── Colour theme (a preference of this device, not part of backups) ──────
let theme = "roxo";
try {
  theme = THEMES[localStorage.getItem(THEME_KEY)]
    ? localStorage.getItem(THEME_KEY)
    : "roxo";
} catch {
  // Storage blocked: keep the default theme.
}
function renderThemePicker() {
  const root = $("themePicker");
  root.textContent = "";
  root.appendChild(element("span", "theme-label", "Tema"));
  Object.entries(THEMES).forEach(([key, t]) => {
    const b = element("button", "theme-choice");
    b.type = "button";
    b.setAttribute("aria-pressed", String(key === theme));
    b.setAttribute("aria-label", "Tema " + t.label);
    b.title = t.label;
    t.swatch.forEach((color) => {
      const dot = element("span", "theme-dot");
      dot.style.background = color;
      b.appendChild(dot);
    });
    b.appendChild(element("span", "", t.label));
    b.onclick = () => setTheme(key);
    root.appendChild(b);
  });
}
function setTheme(key) {
  theme = key;
  try {
    localStorage.setItem(THEME_KEY, key);
  } catch {
    // Not saved: the theme still applies now.
  }
  applyTheme(document, key);
  if (presentation.window && !presentation.window.closed)
    applyTheme(presentation.window.document, key);
  renderThemePicker();
}

// Leaving a class: everything is already saved; offer a backup first.
$("classesOpen").onclick = () => openOverlay("exitOverlay", "exitBackup");
$("exitBackup").onclick = () => {
  backupUI.backupNow();
  showHub();
};
$("exitNoBackup").onclick = showHub;
function enterClass(id, day = dayISO(new Date())) {
  if (!teacher.ensure()) return;
  const workspace = persistence.workspace,
    c = workspace.classes.find((c) => c.id === id);
  if (!c) return;
  stopSession();
  state = c;
  workspace.activeClassId = id;
  persistence.persist();
  $("classHub").hidden = true;
  $("gameMain").hidden = false;
  buildCards();
  syncAll();
  teacher.refresh();
  backupUI.updateStatus();
  setSessionDay(day);
  window.scrollTo(0, 0);
}

/**
 * Room mode: another device changed the data. Show it here, keeping the open
 * class and selection. The PC (projector) also follows the class opened on
 * the tablet.
 */
function reloadWorkspace() {
  persistence.load();
  const w = persistence.workspace;
  teacher.refresh();
  backupUI.updateStatus();
  if ($("gameMain").hidden) {
    hub.render();
    return;
  }
  const followed = room && room.isHost ? w.activeClassId : null,
    c =
      w.classes.find((x) => x.id === followed) ||
      w.classes.find((x) => x.id === state.id);
  if (!c) {
    showHub();
    return;
  }
  if (c.id !== state.id) selected = -1;
  state = c;
  buildCards();
  syncAll();
}
/**
 * Changes from the PC wait while a window (Registo, Avaliação…) is open. The
 * roleta and "Atenção, turma!" do not hold them back.
 */
const LIVE_OVERLAYS = ["drawOverlay", "winnerOverlay", "attentionOverlay"];
const noOpenWindow = () =>
  [...document.querySelectorAll(".overlay:not([hidden])")].every((o) =>
    LIVE_OVERLAYS.includes(o.id),
  );
/** Room mode: tell the other devices (the projector) what just happened. */
const share = (type, details) => room?.send(type, details);

// ── Controllers ─────────────────────────────────────────────────────────────

// Values that are replaced while the app runs (opening a class, restoring a
// backup), so controllers read them through getters instead of copies.
const live = {
  get state() {
    return state;
  },
  get cards() {
    return cards;
  },
  get workspace() {
    return persistence.workspace;
  },
  get storageOK() {
    return persistence.storageOK;
  },
  get sessionDay() {
    return sessionDay;
  },
  get readOnly() {
    return readOnly;
  },
  get theme() {
    return theme;
  },
};
function withLive(dependencies) {
  return Object.assign(Object.create(live), dependencies);
}

// Created in dependency order. Arrow functions defer calls to controllers
// that are created further down; none of them run before initialisation.
// Room mode ("TIC Quest · Sala"): the data lives on the teacher's PC.
let room = null;
const persistence = createPersistence(
  () => (room ? room.storage : localStorage),
  () => backupUI.updateStatus(),
);
const teacher = createTeacher(
  withLive({
    $,
    dirty,
    onSaved: () => hub.render(),
    onChange() {
      if (selected < 0) renderScene();
    },
  }),
);
const backupUI = createBackupUI({
  $,
  element,
  openOverlay,
  closeOverlay,
  persistence,
  showHub,
});
const presentation = createPresentation(
  withLive({
    $,
    element,
    selectStudent,
    clearSelection,
    closeOverlay,
    onClose: () => raffle.onPresentationClose(),
  }),
);
const raffle = createRaffle(
  withLive({
    $,
    playSound,
    openOverlay,
    selectStudent,
    addPoints,
    pool,
    rankById,
    presentation,
    reducedMotion,
    replay,
    status,
    share,
    setReturnFocus(node) {
      returnFocus = node;
    },
  }),
);
const attention = createAttention(
  withLive({
    $,
    playSound,
    openOverlay,
    closeOverlay,
    replay,
    changeLife,
    status,
    share,
  }),
);
const teams = createTeams(
  withLive({ $, dirty, playSound, openOverlay, activeSlots }),
);
const activities = createActivities(
  withLive({
    $,
    stamp: () => stampOn(sessionDay),
    element,
    dirty,
    syncAll,
    playSound,
    openOverlay,
    rankedIds,
  }),
);
createRoster(
  withLive({
    $,
    openOverlay,
    closeOverlay,
    dirty,
    syncAll,
    status,
    rankedIds,
    confirmRemoval,
  }),
);
const hub = createHub(
  withLive({
    $,
    element,
    button,
    dirty,
    openOverlay,
    teacher,
    enterClass,
    showHub,
    updateBackupStatus: () => backupUI.updateStatus(),
  }),
);
createGradesUI(
  withLive({
    $,
    element,
    button,
    openOverlay,
    dirty,
    requireTeacher: teacher.ensure,
  }),
);
const diary = createDiary(
  withLive({
    $,
    element,
    button,
    dirty,
    syncAll,
    playSound,
    openOverlay,
    closeOverlay,
    masterName: teacher.displayName,
    requireTeacher: teacher.ensure,
    setSessionDay,
    startEditing,
  }),
);

if (isRoom()) {
  // Nothing behind the room code while it connects.
  $("bootWarning").hidden = true;
  $("gameMain").hidden = true;
  room = await connectRoom({
    $,
    canApply: noOpenWindow,
    onRemoteChange: reloadWorkspace,
    onEvent(e) {
      raffle.fromRoom(e);
      attention.fromRoom(e);
    },
  });
}
persistence.load();
applyTheme(document, theme);
renderThemePicker();
// Installed app: works offline, and asks the browser not to clear the data.
// (Not in room mode: the PC always serves the current version.)
if (
  !room &&
  "serviceWorker" in navigator &&
  location.protocol.startsWith("http")
)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
navigator.storage?.persist?.().catch(() => {});
showHub();
backupUI.updateStatus();
if (persistence.storageBlocked)
  $("storageWarning").textContent =
    "A gravação local não pôde ser recuperada por completo. Se disponível, foi aberta a cópia anterior. Exporta estes dados ou restaura o teu backup; a gravação automática está suspensa.";
$("bootWarning").hidden = true;
