import { createDiary } from "./diary.js";
import {
  STORE,
  PREVIOUS,
  writeWorkspace,
  StorageConflictError,
} from "./storage.js";
import { canUndo } from "./points.js";
import { MAX_BACKUP_BYTES, parseBackupText } from "./backup.js";
import { createAudio } from "./audio.js";
import { createPresentation } from "./presentation.js";
import {
  autoAvatar,
  avatarChoices,
  avatarFor,
  sprite,
  masterSprite,
} from "./avatars.js";
import { packageBackup } from "./backup.js";
import { emptyWorkspace, validateWorkspace, emptyDiary } from "./model.js";
import { pad, uid, copy, integer } from "./utils.js";
var $ = function (id) {
  return document.getElementById(id);
};
const { playSound } = createAudio(document, window);

var state = {
  version: 6,
  className: "6.º A",
  lives: 5,
  students: [],
  groups: [],
};
for (var i = 0; i < 30; i++)
  state.students.push({
    name: "Aluno " + pad(i + 1),
    points: 0,
    inPool: true,
    gender: "robot",
    avatar: 16 + (i % 8),
    avatarMode: "auto",
  });
var selected = -1,
  lastWinner = -1,
  rolling = false,
  drawTimer = null,
  cards = [],
  returnFocus = null,
  lifeToastTimer = null,
  pendingImport = null,
  attentionTimer = null,
  attentionPhase = "idle",
  attentionDeadline = 0,
  importReadToken = 0,
  wheelFrame = null,
  rosterDraft = [],
  rankById = [],
  collator = new Intl.Collator("pt-PT", { sensitivity: "base", numeric: true }),
  statusTimer = null,
  stageTimer = null;

function status(t) {
  $("status").textContent = t;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(function () {
    $("status").textContent = "";
  }, 3500);
}

function active() {
  return state.students
    .map(function (s, i) {
      return s.name.trim() ? i : -1;
    })
    .filter(function (i) {
      return i >= 0;
    });
}
function pool() {
  return rankedIds()
    .filter(function (i) {
      return !!state.students[i].name;
    })
    .filter(function (i) {
      return state.students[i].inPool;
    });
}

function sceneAvatar(s, i) {
  return avatarFor(s, i);
}
function renderScene(effect) {
  var s = state.students[selected],
    level = s ? Math.floor(Math.max(0, s.points) / 20) + 1 : 1,
    progress = s ? Math.max(0, s.points) % 20 : 0;
  $("stageName").textContent = s ? s.name || "—" : masterName().toUpperCase();
  $("stageLevel").textContent = s ? "FASE " + pad(level) : "♛ MASTER";
  if (s) sprite($("stageSprite"), sceneAvatar(s, selected));
  else teacherSprite($("stageSprite"));
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
  stageTimer = setTimeout(function () {
    $("stageMessage").textContent = "";
  }, 1500);
}

function rankedIds() {
  return state.students
    .map(function (s, i) {
      return i;
    })
    .sort(function (a, b) {
      var x = state.students[a],
        y = state.students[b];
      if (!!x.name !== !!y.name) return x.name ? -1 : 1;
      return y.points - x.points || collator.compare(x.name, y.name) || a - b;
    });
}
function renderRanking() {
  var root = $("players");
  rankedIds().forEach(function (id, index) {
    rankById[id] = index + 1;
    if (root.children[index] !== cards[id].card)
      root.insertBefore(cards[id].card, root.children[index] || null);
    cards[id].num.textContent = pad(index + 1);
    cards[id].card.dataset.rank = index + 1;
    cards[id].button.setAttribute(
      "aria-label",
      (state.students[id].name || "Sem nome") +
        ", posição " +
        (index + 1) +
        ", " +
        state.students[id].points +
        " pontos",
    );
  });
  $("selectedSeat").textContent =
    selected < 0 ? "" : "JOGADOR · POSIÇÃO " + pad(rankById[selected] || 1);
}
function buildCards() {
  var root = $("players");
  root.textContent = "";
  cards = [];
  state.students.forEach(function (s, i) {
    var card = document.createElement("article");
    card.className = "player";
    var b = document.createElement("button");
    b.type = "button";
    b.className = "player-button";
    b.dataset.seat = i;
    var num = document.createElement("span");
    num.className = "seat-num pixel";
    num.textContent = pad(i + 1);
    var avatar = document.createElement("span");
    avatar.className = "avatar";
    sprite(avatar, avatarFor(s, i));
    avatar.setAttribute("aria-hidden", "true");
    var name = document.createElement("span");
    name.className = "player-name";
    var points = document.createElement("span");
    points.className = "player-points";
    b.appendChild(num);
    b.appendChild(avatar);
    b.appendChild(name);
    b.appendChild(points);
    b.addEventListener("click", function () {
      selectStudent(i);
      if (window.innerWidth <= 850)
        document
          .querySelector(".character")
          .scrollIntoView({ block: "center", behavior: "auto" });
    });
    var label = document.createElement("label");
    label.className = "pool-label";
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.pool = i;
    checkbox.addEventListener("change", function () {
      state.students[i].inPool = checkbox.checked;
      dirty();
      updateCard(i);
      updateCounts();
    });
    var labelText = document.createElement("span");
    labelText.textContent = "NO SORTEIO";
    label.appendChild(checkbox);
    label.appendChild(labelText);
    card.appendChild(b);
    card.appendChild(label);
    root.appendChild(card);
    cards.push({
      card: card,
      button: b,
      name: name,
      points: points,
      checkbox: checkbox,
      avatar: avatar,
      num: num,
    });
    updateCard(i);
  });
}
function updateCard(i) {
  var s = state.students[i],
    c = cards[i];
  sprite(c.avatar, avatarFor(s, i));
  c.card.classList.toggle("chosen", selected === i);
  c.card.classList.toggle("excluded", !s.inPool);
  c.card.classList.toggle("empty", !s.name);
  c.name.textContent = s.name || "Sem nome";
  c.name.title = s.name;
  c.points.textContent = "★ " + s.points;
  c.button.setAttribute(
    "aria-label",
    (s.name || "Sem nome") +
      ", posição " +
      (rankById[i] || i + 1) +
      ", " +
      s.points +
      " pontos",
  );
  c.button.setAttribute("aria-pressed", selected === i ? "true" : "false");
  c.checkbox.checked = s.inPool && !!s.name;
  c.checkbox.disabled = !s.name;
  c.checkbox.setAttribute(
    "aria-label",
    "Incluir " + (s.name || "mesa " + (i + 1)) + " no sorteio",
  );
}
function updateCounts() {
  $("poolCount").textContent = pool().length + " no sorteio";
  $("playerCount").textContent = active().length + " JOGADORES";
  renderRanking();
}
function selectStudent(i) {
  playSound("select");
  selected = i;
  cards.forEach(function (c, j) {
    c.card.classList.toggle("chosen", i === j);
    c.button.setAttribute("aria-pressed", i === j ? "true" : "false");
  });
  updateEditor();
  status((state.students[i].name || "Mesa " + (i + 1)) + " selecionado");
}

function clearSelection() {
  if (selected < 0) return;
  selected = -1;
  cards.forEach(function (c) {
    c.card.classList.remove("chosen");
    c.button.setAttribute("aria-pressed", "false");
  });
  clearDrawHighlights();
  $("drawOutput").textContent = "";
  updateEditor();
  status(masterName() + " no comando");
}
function updateEditor() {
  var s = state.students[selected];
  $("masterProfile").hidden = !!s;
  $("studentProfile").hidden = !s;
  $("characterPanel").classList.toggle("master-mode", !s);
  if (!s) {
    $("selectedName").textContent = "";
    $("selectedScore").textContent = "";
    $("studentName").value = "";
    $("selectedSeat").textContent = "";
    $("selectedAvatar").removeAttribute("data-avatar");
    ["scoreMinus", "scorePlus", "scorePlusTwo"].forEach(function (id) {
      $(id).disabled = true;
    });
    renderScene();
    return;
  }
  $("selectedSeat").textContent =
    selected < 0 ? "" : "JOGADOR · POSIÇÃO " + pad(rankById[selected] || 1);
  sprite($("selectedAvatar"), avatarFor(s, selected));
  $("studentGender").value =
    s.avatarMode === "manual" ? s.gender || "robot" : "auto";
  $("selectedName").textContent = s.name || "Sem nome";
  $("selectedScore").textContent = "★ " + s.points;
  $("studentName").value = s.name;
  ["scoreMinus", "scorePlus", "scorePlusTwo"].forEach(function (id) {
    $(id).disabled = !s.name;
  });
  renderScene();
}
function updateHealth() {
  $("hpNumber").textContent = state.lives + " / 5";
  $("hpBlocks").setAttribute("aria-valuenow", state.lives);
  Array.prototype.forEach.call($("hpBlocks").children, function (b, i) {
    b.classList.toggle("lost", i >= state.lives);
    b.textContent = i < state.lives ? "♥" : "♡";
  });
}
function syncAll() {
  $("className").value = state.className;
  cards.forEach(function (c, i) {
    updateCard(i);
  });
  updateCounts();
  updateHealth();
  updateEditor();
  renderTeams();
  renderScene();
}

function openOverlay(id, focusId) {
  returnFocus = document.activeElement;
  $(id).hidden = false;
  var focusTarget = focusId ? $(focusId) : $(id).querySelector("button");
  if (focusTarget) focusTarget.focus();
}

Array.prototype.forEach.call(
  document.querySelectorAll("[data-close]"),
  function (b) {
    b.addEventListener("click", function () {
      closeOverlay(b.dataset.close);
    });
  },
);
document.addEventListener("keydown", function (e) {
  var overlays = Array.prototype.filter.call(
    document.querySelectorAll(".overlay"),
    function (o) {
      return !o.hidden;
    },
  );
  if (!overlays.length) return;
  var open = overlays[overlays.length - 1];
  if (e.key === "Escape") closeOverlay(open.id);
  if (e.key === "Tab") {
    var items = Array.prototype.filter.call(
        open.querySelectorAll("button,input,select,textarea"),
        function (el) {
          return !el.disabled && el.getClientRects().length;
        },
      ),
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
$("className").addEventListener("input", function () {
  state.className = this.value.slice(0, 50);
  dirty();
});
$("nameForm").addEventListener("submit", function (e) {
  e.preventDefault();
  if (selected < 0) return;
  var name = $("studentName").value.trim().slice(0, 60);
  var changedName = state.students[selected].name !== name;
  state.students[selected].name = name;
  if (changedName) autoAvatar(state.students[selected], selected);
  if (!name) state.students[selected].inPool = false;
  else if (
    !cards[selected].name.textContent ||
    cards[selected].name.textContent === "Sem nome"
  )
    state.students[selected].inPool = true;
  dirty();
  updateCard(selected);
  updateEditor();
  updateCounts();
  renderTeams();
  status("Nome guardado. Classificação atualizada.");
});
$("scoreMinus").onclick = function () {
  addPoints(selected, -1);
};
$("scorePlus").onclick = function () {
  addPoints(selected, 1);
};
$("scorePlusTwo").onclick = function () {
  addPoints(selected, 2);
};
function reducedMotion() {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
function replay(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}
function floatingPoints(element, n) {
  if (reducedMotion()) return;
  var box = element.getBoundingClientRect(),
    p = document.createElement("span");
  p.className = "points-float" + (n < 0 ? " negative" : "");
  p.textContent = (n > 0 ? "+" : "") + n + " ★";
  p.style.left =
    Math.max(
      12,
      Math.min(window.innerWidth - 90, box.left + box.width / 2 - 24),
    ) + "px";
  p.style.top = box.top + "px";
  document.body.appendChild(p);
  setTimeout(function () {
    p.remove();
  }, 1050);
}
function changeLife(amount) {
  var previous = state.lives;
  state.lives = Math.max(0, Math.min(5, state.lives + amount));
  var delta = state.lives - previous;
  if (!delta) {
    status(
      amount > 0 ? "A energia já está completa." : "A turma já está sem vidas.",
    );
    return;
  }
  dirty();
  updateHealth();
  var gain = delta > 0;
  renderScene(gain ? "heal" : "hurt");
  sceneMessage(gain ? "+ ♥" : "− ♥");
  playSound(gain ? "gain" : "loss");
  Array.prototype.forEach.call($("hpBlocks").children, function (block, i) {
    block.classList.remove("hp-gain", "hp-loss");
    if (
      i >= Math.min(previous, state.lives) &&
      i < Math.max(previous, state.lives)
    )
      replay(block, gain ? "hp-gain" : "hp-loss");
  });
  $("healthHud").classList.remove("hud-hit", "hud-heal");
  replay($("healthHud"), gain ? "hud-heal" : "hud-hit");
  var toast = $("lifeToast");
  toast.hidden = false;
  toast.classList.toggle("loss", !gain);
  $("lifeToastIcon").textContent = gain ? "♥" : "♡";
  $("lifeToastText").textContent =
    (gain ? "+" : "") + delta + " VIDA" + (Math.abs(delta) > 1 ? "S" : "");
  replay(toast, "toast-run");
  clearTimeout(lifeToastTimer);
  lifeToastTimer = setTimeout(function () {
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
$("selectAll").onclick = function () {
  state.students.forEach(function (s, i) {
    s.inPool = !!s.name;
    updateCard(i);
  });
  dirty();
  updateCounts();
};
$("selectNone").onclick = function () {
  state.students.forEach(function (s, i) {
    s.inPool = false;
    updateCard(i);
  });
  dirty();
  updateCounts();
};
function fillRoster() {
  var root = $("rosterList");
  root.textContent = "";
  rankedIds().forEach(function (id) {
    var draft = rosterDraft[id],
      row = document.createElement("div");
    row.className = "roster-row";
    var portrait = document.createElement("span");
    sprite(portrait, avatarFor(draft, id));
    var input = document.createElement("input");
    input.className = "field";
    input.value = draft.name;
    input.maxLength = 60;
    input.dataset.student = id;
    input.setAttribute("aria-label", "Nome do jogador " + (id + 1));
    input.oninput = function () {
      draft.name = this.value.trim();
    };
    input.onchange = function () {
      autoAvatar(draft, id);
      sprite(portrait, avatarFor(draft, id));
    };
    var select = document.createElement("select");
    select.className = "field";
    select.dataset.gender = id;
    select.setAttribute("aria-label", "Personagem do jogador " + (id + 1));
    [
      ["auto", "Auto"],
      ["robot", "Robô"],
      ["f", "Feminino"],
      ["m", "Masculino"],
    ].forEach(function (pair) {
      var option = document.createElement("option");
      option.value = pair[0];
      option.textContent = pair[1];
      select.appendChild(option);
    });
    select.value =
      draft.avatarMode === "manual" ? draft.gender || "robot" : "auto";
    select.onchange = function () {
      if (this.value === "auto") {
        draft.avatarMode = "auto";
        autoAvatar(draft, id);
      } else {
        draft.avatarMode = "manual";
        draft.gender = this.value;
        var options = avatarChoices(draft.gender);
        draft.avatar = options[id % options.length];
      }
      sprite(portrait, draft.avatar);
    };
    var next = document.createElement("button");
    next.className = "button small";
    next.textContent = "↻";
    next.setAttribute("aria-label", "Trocar avatar do jogador " + (id + 1));
    next.onclick = function () {
      var options = avatarChoices(draft.gender);
      draft.avatar =
        options[(options.indexOf(avatarFor(draft, id)) + 1) % options.length];
      draft.avatarMode = "manual";
      select.value = draft.gender;
      sprite(portrait, draft.avatar);
    };
    row.appendChild(portrait);
    row.appendChild(input);
    row.appendChild(select);
    row.appendChild(next);
    root.appendChild(row);
  });
}
$("editNames").onclick = function () {
  rosterDraft = state.students.map(function (s) {
    return Object.assign({}, s);
  });
  $("namesText").value = "";
  fillRoster();
  openOverlay("namesOverlay");
  $("rosterList").querySelector("input").focus();
};
$("pasteNames").onclick = function () {
  var text = $("namesText").value.replace(/\r/g, "").trim(),
    names = text ? text.split("\n") : [];
  if (names.length > 30) {
    alert("Podes colocar até 30 nomes.");
    return;
  }
  rosterDraft.forEach(function (s, i) {
    s.name = (names[i] || "").trim().slice(0, 60);
    autoAvatar(s, i);
  });
  fillRoster();
};
$("studentGender").onchange = function () {
  if (selected < 0) return;
  var s = state.students[selected];
  if (this.value === "auto") {
    s.avatarMode = "auto";
    autoAvatar(s, selected);
  } else {
    s.avatarMode = "manual";
    s.gender = this.value;
    var options = avatarChoices(s.gender);
    s.avatar = options[selected % options.length];
  }
  dirty();
  updateCard(selected);
  updateEditor();
};
$("nextAvatar").onclick = function () {
  if (selected < 0) return;
  var s = state.students[selected],
    options = avatarChoices(s.gender);
  s.avatar =
    options[(options.indexOf(avatarFor(s, selected)) + 1) % options.length];
  s.avatarMode = "manual";
  dirty();
  updateCard(selected);
  updateEditor();
};
$("applyNames").onclick = function () {
  state.students.forEach(function (s, i) {
    s.name = rosterDraft[i].name.trim().slice(0, 60);
    s.gender = rosterDraft[i].gender || "robot";
    s.avatar = avatarFor(rosterDraft[i], i);
    s.avatarMode = rosterDraft[i].avatarMode || "auto";
    s.inPool = !!s.name;
  });
  dirty();
  syncAll();
  closeOverlay("namesOverlay");
  status("Guardado ✓");
};
function clearDrawHighlights() {
  cards.forEach(function (c) {
    c.card.classList.remove("flash", "winner");
  });
}
function confetti() {
  var holder = $("confetti");
  holder.textContent = "";
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  ["#ffd354", "#70f2be", "#ff78b0", "#8fceff"].forEach(function (color, k) {
    for (var j = 0; j < 7; j++) {
      var bit = document.createElement("i");
      bit.style.left = Math.random() * 100 + "%";
      bit.style.background = color;
      bit.style.animationDelay = Math.random() * 0.45 + "s";
      bit.style.transform = "rotate(" + k * 40 + "deg)";
      holder.appendChild(bit);
    }
  });
  setTimeout(function () {
    holder.textContent = "";
  }, 2700);
}
function cancelRaffle() {
  if (wheelFrame) cancelWheelFrame();
  wheelFrame = null;
  if (drawTimer) clearTimeout(drawTimer);
  drawTimer = null;
  rolling = false;
  clearDrawHighlights();
  $("drawOverlay").hidden = true;
  $("draw").disabled = false;
  $("draw").textContent = "🎲 SORTEAR";
  $("drawOutput").textContent = "Cancelado";
  $("draw").focus();
}
$("cancelDraw").onclick = cancelRaffle;
function paintWheel(choices, rotation, highlight) {
  var canvas = $("nameWheel"),
    ctx = canvas.getContext("2d"),
    size = 900,
    center = size / 2,
    radius = 432,
    arc = (Math.PI * 2) / choices.length;
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  var palette = [
    "#ffd269",
    "#ae91ec",
    "#70dec5",
    "#ff9aa9",
    "#8dbff3",
    "#efaf71",
  ];
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(rotation);
  for (var i = 0; i < choices.length; i++) {
    var start = -Math.PI / 2 + i * arc,
      end = start + arc,
      mid = start + arc / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = palette[i % palette.length];
    ctx.fill();
    ctx.strokeStyle = "#39234e";
    ctx.lineWidth = 3;
    ctx.stroke();
    if (highlight === i) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#fff6be66";
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(mid);
    ctx.beginPath();
    ctx.rect(95, -radius, 330, radius * 2);
    ctx.clip();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#211331";
    ctx.font =
      "800 " +
      (choices.length > 24 ? 28 : choices.length > 14 ? 30 : 34) +
      "px system-ui";
    var name = state.students[choices[i]].name;
    while (ctx.measureText(name).width > 250 && name.length > 1)
      name = name.slice(0, -1);
    if (name !== state.students[choices[i]].name)
      name = name.slice(0, -1) + "…";
    ctx.fillText(name, 410, 0);
    ctx.restore();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#ffedb0";
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(center, center, radius + 10, 0, Math.PI * 2);
  ctx.strokeStyle = "#a47ac4";
  ctx.lineWidth = 6;
  ctx.stroke();
  canvas.dataset.segments = choices.length;
}
$("draw").onclick = function () {
  if (rolling) return;
  var choices = pool();
  if (!choices.length) {
    $("drawOutput").textContent = "Marca pelo menos um jogador para o sorteio.";
    status("Usa as caixas «NO SORTEIO» ou clica em «✓ Todos».");
    return;
  }
  rolling = true;
  this.disabled = true;
  this.textContent = "A SORTEAR…";
  $("drawOutput").textContent = "A roleta está a girar…";
  clearDrawHighlights();
  var finalIndex = Math.floor(Math.random() * choices.length),
    finalChoice = choices[finalIndex],
    tau = Math.PI * 2,
    arc = tau / choices.length,
    target = tau * 8 + (tau - (finalIndex + 0.5) * arc),
    duration = reducedMotion() ? 600 : 8500,
    started = null,
    previous = -1,
    lastTick = 0;
  playSound("start");
  $("drawLabel").textContent = "✦ ROLETA DA TURMA ✦";
  $("drawProgressFill").style.width = "0%";
  $("drawProgress").setAttribute("aria-valuenow", "0");
  $("drawNote").textContent = choices.length + " jogadores";
  $("nameWheel").setAttribute(
    "aria-label",
    "Roleta com " +
      choices
        .map(function (i) {
          return state.students[i].name;
        })
        .join(", "),
  );
  openOverlay("drawOverlay", "cancelDraw");
  function finish() {
    drawTimer = null;
    clearDrawHighlights();
    lastWinner = finalChoice;
    selectStudent(lastWinner);
    cards[lastWinner].card.classList.add("winner");
    $("drawOutput").textContent =
      "★ " +
      state.students[lastWinner].name +
      " · Posição " +
      rankById[lastWinner];
    sprite(
      $("winnerAvatar"),
      avatarFor(state.students[lastWinner], lastWinner),
    );
    $("winnerName").textContent = state.students[lastWinner].name;
    $("winnerSeat").textContent = "POSIÇÃO " + pad(rankById[lastWinner]);
    $("winnerPoint").disabled = false;
    $("winnerPoint").textContent = "★ Dar +1 ponto";
    $("draw").disabled = false;
    $("draw").textContent = "🎲 SORTEAR";
    rolling = false;
    $("drawOverlay").hidden = true;
    openOverlay("winnerOverlay", "winnerPoint");
    returnFocus = $("draw");
    playSound("win");
    confetti();
  }
  function frame(time) {
    if (!rolling) return;
    if (started === null) started = time;
    var progress = Math.min(1, (time - started) / duration),
      rotation = reducedMotion()
        ? target
        : target * (1 - Math.pow(1 - progress, 3)),
      relative = ((-rotation % tau) + tau) % tau,
      index = Math.min(choices.length - 1, Math.floor(relative / arc));
    if (progress === 1) index = finalIndex;
    paintWheel(choices, rotation, progress === 1 ? finalIndex : -1);
    $("nameWheel").dataset.pointerIndex = index;
    $("drawName").textContent = state.students[choices[index]].name;
    $("drawSeat").textContent = "POSIÇÃO " + pad(rankById[choices[index]]);
    if (index !== previous) {
      clearDrawHighlights();
      cards[choices[index]].card.classList.add("flash");
      if (!reducedMotion() && time - lastTick > 55) {
        playSound("tick");
        replay($("wheelPointer"), "wheel-tick");
        lastTick = time;
      }
      previous = index;
    }
    $("drawProgressFill").style.width = Math.round(progress * 100) + "%";
    $("drawProgress").setAttribute("aria-valuenow", Math.round(progress * 100));
    if (progress > 0.7) $("drawNote").textContent = "A roleta está a parar…";
    if (progress < 1) {
      wheelFrame = scheduleWheelFrame(frame);
    } else {
      wheelFrame = null;
      $("drawNote").textContent = "★ " + state.students[finalChoice].name + "!";
      drawTimer = setTimeout(finish, reducedMotion() ? 150 : 1400);
    }
  }
  wheelFrame = scheduleWheelFrame(frame);
};
$("winnerPoint").onclick = function () {
  if (lastWinner < 0) return;
  addPoints(lastWinner, 1);
  this.disabled = true;
  this.textContent = "✓ Ponto atribuído";
};
$("teamsOpen").onclick = function () {
  renderTeams();
  openOverlay("teamsOverlay", "teamCount");
};
$("makeTeams").onclick = function () {
  var ids = active(),
    n = Number($("teamCount").value);
  if (ids.length < n) {
    alert("São necessários pelo menos " + n + " alunos com nome.");
    return;
  }
  if (
    state.groups.length &&
    !confirm("Voltar a sortear as equipas apaga os seus pontos. Continuar?")
  )
    return;
  for (var i = ids.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)),
      tmp = ids[i];
    ids[i] = ids[j];
    ids[j] = tmp;
  }
  state.groups = [];
  for (var k = 0; k < n; k++) state.groups.push({ members: [], points: 0 });
  ids.forEach(function (id, i) {
    state.groups[i % n].members.push(id);
  });
  dirty();
  renderTeams();
  playSound("win");
};
function renderTeams() {
  var root = $("teamList");
  root.textContent = "";
  state.groups.forEach(function (g, i) {
    var box = document.createElement("article");
    box.className = "team";
    var h = document.createElement("h3");
    h.className = "pixel";
    h.textContent = "EQUIPA " + (i + 1);
    var names = document.createElement("p");
    names.textContent = g.members
      .map(function (j) {
        return state.students[j].name;
      })
      .filter(Boolean)
      .join(" · ");
    var points = document.createElement("div");
    points.className = "team-score";
    points.textContent = "★ " + g.points;
    var row = document.createElement("div");
    row.className = "row";
    [-1, 1].forEach(function (n) {
      var b = document.createElement("button");
      b.className = "button small";
      b.textContent = (n > 0 ? "+" : "") + n;
      b.setAttribute(
        "aria-label",
        (n > 0 ? "Dar" : "Retirar") + " um ponto à equipa " + (i + 1),
      );
      b.onclick = function () {
        if (!Number.isSafeInteger(g.points + n)) {
          alert("Pontuação fora do limite.");
          return;
        }
        g.points += n;
        dirty();
        points.textContent = "★ " + g.points;
      };
      row.appendChild(b);
    });
    box.appendChild(h);
    box.appendChild(names);
    box.appendChild(points);
    box.appendChild(row);
    root.appendChild(box);
  });
}

function importMessage(text, error) {
  $("importStatus").textContent = text;
  $("importStatus").classList.toggle("error", !!error);
}

$("loadFile").addEventListener("change", function () {
  var f = this.files && this.files[0];
  if (!f) return;
  var token = ++importReadToken;
  pendingImport = null;
  $("applyImport").disabled = true;
  if (f.size > MAX_BACKUP_BYTES) {
    importMessage("Ficheiro demasiado grande. O limite é 20 MB.", true);
    return;
  }
  importMessage("A ler " + f.name + "…", false);
  var reader = new FileReader();
  reader.onload = function () {
    if (token === importReadToken) inspectSave(reader.result, f.name);
  };
  reader.onerror = function () {
    if (token === importReadToken)
      importMessage(
        "Não foi possível ler o ficheiro. Tenta a alternativa de colar o conteúdo.",
        true,
      );
  };
  reader.readAsText(f);
});
$("readPastedSave").onclick = function () {
  importReadToken++;
  inspectSave($("importText").value, "texto colado");
};

$("attention").onclick = function () {
  document.body.classList.add("silence-active");
  playSound("alert");
  clearTimeout(attentionTimer);
  attentionPhase = "countdown";
  attentionDeadline = Date.now() + 10000;
  $("attentionDecisions").hidden = true;
  $("attentionResult").hidden = true;
  $("attentionNoisy").disabled = false;
  $("attentionTitle").textContent = "SILÊNCIO";
  $("attentionPrompt").textContent = "";
  $("attentionCancel").textContent = "Cancelar";
  openOverlay("attentionOverlay", "attentionCancel");
  var previous = -1;
  function tick() {
    if (attentionPhase !== "countdown") return;
    var remaining = Math.max(0, attentionDeadline - Date.now()),
      seconds = Math.ceil(remaining / 1000);
    $("attentionFill").style.width = remaining / 100 + "%";
    $("attentionProgress").setAttribute("aria-valuenow", seconds);
    if (seconds !== previous) {
      $("attentionOverlay").dataset.level =
        seconds <= 5 ? "urgent" : seconds <= 7 ? "warning" : "ready";
      if (seconds < 10)
        playSound(seconds === 0 ? "timeup" : seconds <= 5 ? "urgent" : "count");
      $("attentionNumber").textContent = seconds;
      replay($("attentionNumber"), "attention-beat");
      previous = seconds;
    }
    if (remaining === 0) {
      attentionPhase = "decision";
      attentionTimer = null;
      $("attentionTitle").textContent = "TEMPO ESGOTADO";
      $("attentionPrompt").textContent = "A turma já está em silêncio?";
      $("attentionDecisions").hidden = false;
      $("attentionQuiet").focus();
      return;
    }
    attentionTimer = setTimeout(tick, 80);
  }
  tick();
};
$("attentionQuiet").onclick = function () {
  if (attentionPhase !== "decision") return;
  playSound("quiet");
  closeOverlay("attentionOverlay");
  status("✓ A turma ficou em silêncio. Vamos continuar!");
};
$("attentionNoisy").onclick = function () {
  if (attentionPhase !== "decision") return;
  attentionPhase = "resolved";
  this.disabled = true;
  var before = state.lives;
  changeLife(-1);
  $("attentionDecisions").hidden = true;
  $("attentionTitle").textContent = before > 0 ? "−1 VIDA" : "SEM VIDAS";
  $("attentionResult").hidden = false;
  $("attentionResult").textContent = "♥ " + before + " → " + state.lives;
  $("attentionCancel").textContent = "Continuar";
  $("attentionCancel").focus();
};
$("clearStudent").onclick = clearSelection;
var masterTimer = null;
function masterRally() {
  playSound("win");
  replay($("masterAvatar"), "master-salute");
  renderScene("jump");
  sceneMessage("MASTER NO COMANDO!");
  $("masterCommand").textContent = "MISSÃO: ARRASAR!";
  clearTimeout(masterTimer);
  masterTimer = setTimeout(function () {
    $("masterCommand").textContent = "NO COMANDO";
  }, 2600);
}
$("masterPortrait").onclick = masterRally;
$("masterRally").onclick = masterRally;
$("masterAttention").onclick = function () {
  $("attention").click();
};
document.addEventListener(
  "click",
  function (e) {
    if (
      selected < 0 ||
      e.target.closest(
        ".player, .character, .overlay, #gameDiary, #gameProject",
      )
    )
      return;
    clearSelection();
  },
  true,
);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !document.querySelector(".overlay:not([hidden])"))
    clearSelection();
});
// Portable classroom workspace, version 8. Student slots remain stable for undo and teams.
var workspace = null,
  storageOK = true,
  storageBlocked = false,
  localSnapshot = null,
  backupPending = null,
  activitySelection = new Set();

function when(date) {
  return date ? new Date(date).toLocaleString("pt-PT") : "Nunca";
}

function dirtyBackup() {
  return (
    !workspace.lastBackup ||
    workspace.lastBackup.revision !== workspace.revision
  );
}
function backupText() {
  var last = workspace.lastBackup;
  return (
    (dirtyBackup()
      ? "● Alterações sem backup confirmado"
      : "✓ Backup confirmado") +
    " · Última cópia: " +
    when(last && last.date)
  );
}
function updateBackupStatus() {
  var text =
    (storageOK ? "" : "⚠ Gravação local suspensa — exporta um backup. ") +
    backupText();
  ["hubBackupStatus", "gameBackupStatus", "backupDetail"].forEach(
    function (id) {
      $(id).textContent = text;
      $(id).classList.toggle("safe", storageOK && !dirtyBackup());
    },
  );

  $("ready").textContent = storageOK
    ? "Gravação automática no navegador · O backup protege todas as turmas."
    : "Gravação local indisponível · Exporta o backup antes de fechar.";
  $("storageWarning").hidden = storageOK;
  $("storageWarning").textContent = storageBlocked
    ? "Existem dados locais que não foram carregados. Não serão substituídos automaticamente. Usa “Restaurar / importar” ou guarda um backup antes de continuar."
    : "Não foi possível guardar no navegador. Mantém esta página aberta e descarrega um backup.";
}
function persist() {
  if (!workspace) return;
  if (storageBlocked) {
    storageOK = false;
    updateBackupStatus();
    return;
  }
  try {
    localSnapshot = writeWorkspace(localStorage, workspace, localSnapshot);
    storageOK = true;
  } catch (e) {
    if (e instanceof StorageConflictError) storageBlocked = true;
    storageOK = false;
  }
  updateBackupStatus();
}
function dirty() {
  workspace.revision++;
  persist();
}
function downloadJSON(data, name) {
  var blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 30000);
}
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
function stopSession() {
  document.body.classList.remove("silence-active");
  if (rolling) cancelRaffle();
  clearTimeout(attentionTimer);
  attentionPhase = "idle";
  clearTimeout(stageTimer);
  $("stageMessage").textContent = "";
  clearTimeout(lifeToastTimer);
  $("lifeToast").hidden = true;
  document.querySelectorAll(".overlay").forEach(function (o) {
    o.hidden = true;
  });
  selected = -1;
  lastWinner = -1;
  clearDrawHighlights();
  $("drawOutput").textContent = "";
}
function showHub() {
  stopSession();
  refreshTeacher();
  $("gameMain").hidden = true;
  $("classHub").hidden = false;
  renderHub();
  $(currentTeacher() ? "createClass" : "teacherName").focus();
}
function enterClass(id) {
  if (!requireTeacher()) return;
  var c = workspace.classes.find(function (c) {
    return c.id === id;
  });
  if (!c) return;
  stopSession();
  state = c;
  workspace.activeClassId = id;
  persist();
  $("classHub").hidden = true;
  $("gameMain").hidden = false;
  buildCards();
  syncAll();
  refreshTeacher();
  updateBackupStatus();
  window.scrollTo(0, 0);
}
function element(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(text, fn, cls) {
  var b = element("button", "button " + (cls || ""), text);
  b.type = "button";
  b.onclick = fn;
  return b;
}
function renderHub() {
  var root = $("classGrid");
  root.textContent = "";
  var shown = workspace.classes.filter(function (c) {
    return c.archived === $("showArchived").checked;
  });
  $("emptyHub").hidden = shown.length > 0;
  $("emptyHub").querySelector("h2").textContent = $("showArchived").checked
    ? "Sem turmas arquivadas."
    : "A próxima missão começa aqui.";
  shown.forEach(function (c) {
    var card = element(
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
        c.students.filter(function (s) {
          return s.name;
        }).length +
          " alunos · " +
          c.history.length +
          " registos · ♥ " +
          c.lives +
          "/5",
      ),
    );
    card.appendChild(
      button(
        "Entrar na turma →",
        function () {
          enterClass(c.id);
        },
        "gold class-enter",
      ),
    );
    var actions = element("div", "actions");
    actions.appendChild(
      button(
        "Duplicar",
        function () {
          if (workspace.classes.length >= 200) {
            alert("Limite de 200 turmas.");
            return;
          }
          var cloned = copy(c);
          cloned.id = uid();
          cloned.className = (c.className + " · cópia").slice(0, 50);
          cloned.archived = false;
          workspace.classes.push(cloned);
          dirty();
          renderHub();
        },
        "small",
      ),
    );
    actions.appendChild(
      button(
        c.archived ? "Reativar" : "Arquivar",
        function () {
          c.archived = !c.archived;
          dirty();
          renderHub();
        },
        "small",
      ),
    );
    actions.appendChild(
      button(
        "Exportar turma",
        function () {
          var w = emptyWorkspace();
          w.classes = [copy(c)];
          w.activeClassId = c.id;
          w.presets = copy(workspace.presets);
          w.teachers = currentTeacher() ? [copy(currentTeacher())] : [];
          w.activeTeacherId = currentTeacher()?.id ?? null;
          downloadJSON(
            packageBackup(w, "class"),
            "TIC_turma_" +
              c.className.replace(/[^a-zA-Z0-9À-ÿ_-]/g, "_") +
              "_" +
              stamp() +
              ".json",
          );
        },
        "small",
      ),
    );
    card.appendChild(actions);
    root.appendChild(card);
  });
  updateBackupStatus();
}
$("createClass").onclick = function () {
  if (!requireTeacher()) return;
  if (workspace.classes.length >= 200) {
    alert("Limite de 200 turmas.");
    return;
  }
  $("setupForm").reset();
  $("setupError").textContent = "";
  openOverlay("setupOverlay", "setupName");
};
$("setupForm").onsubmit = function (e) {
  e.preventDefault();
  if (!requireTeacher()) return;
  var name = $("setupName").value.trim(),
    names = $("setupNames")
      .value.split(/\r?\n/)
      .map(function (n) {
        return n.trim();
      })
      .filter(Boolean);
  if (
    !name ||
    !names.length ||
    names.length > 30 ||
    names.some(function (n) {
      return n.length > 60;
    })
  ) {
    $("setupError").textContent =
      "Indica a turma e entre 1 e 30 nomes, até 60 caracteres cada.";
    return;
  }
  var c = {
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
  for (var i = 0; i < 30; i++) {
    var s = {
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
  workspace.classes.push(c);
  dirty();
  enterClass(c.id);
  $("editNames").click();
};
$("showArchived").onchange = renderHub;
$("classesOpen").onclick = showHub;
function renderPresets() {
  var root = $("activityPresets");
  root.textContent = "";
  workspace.presets.forEach(function (p) {
    var o = element("option");
    o.value = p.name;
    root.appendChild(o);
  });
}
function updateActivityButton() {
  var points = Number($("activityPoints").value),
    count = activitySelection.size;
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
function activityTab(history) {
  $("activityEditor").hidden = history;
  $("activityHistory").hidden = !history;
  $("activityTab").setAttribute("aria-pressed", String(!history));
  $("historyTab").setAttribute("aria-pressed", String(history));
  if (history) renderHistory();
}
function openActivities() {
  activitySelection.clear();
  $("activityFeedback").textContent = "";
  $("activityName").value = "";
  $("activityPoints").value = 1;
  renderPresets();
  var root = $("activityStudents");
  root.textContent = "";
  rankedIds()
    .filter(function (i) {
      return state.students[i].name;
    })
    .forEach(function (i) {
      var label = element("label"),
        input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.activityStudent = i;
      input.onchange = function () {
        if (this.checked) activitySelection.add(i);
        else activitySelection.delete(i);
        updateActivityButton();
      };
      var avatar = element("span");
      sprite(avatar, avatarFor(state.students[i], i));
      label.append(input, avatar, element("span", "", state.students[i].name));
      root.appendChild(label);
    });
  activityTab(false);
  updateActivityButton();
  openOverlay("activitiesOverlay", "activityName");
}
$("activitiesOpen").onclick = openActivities;
$("activityTab").onclick = function () {
  activityTab(false);
};
$("historyTab").onclick = function () {
  activityTab(true);
};
$("activityName").oninput = updateActivityButton;
$("activityName").onchange = function () {
  var p = workspace.presets.find(function (p) {
    return p.name === $("activityName").value;
  });
  if (p) $("activityPoints").value = p.points;
  updateActivityButton();
};
$("activityPoints").oninput = updateActivityButton;
function selectActivities(all) {
  activitySelection.clear();
  document.querySelectorAll("[data-activity-student]").forEach(function (c) {
    c.checked = all;
    if (all) activitySelection.add(Number(c.dataset.activityStudent));
  });
  updateActivityButton();
}
$("activityAll").onclick = function () {
  selectActivities(true);
};
$("activityNone").onclick = function () {
  selectActivities(false);
};
function pushHistory(title, points, slots) {
  if (state.history.length >= 10000) {
    alert("O histórico atingiu o limite. Cria uma turma para o novo período.");
    return false;
  }
  state.history.push({
    id: uid(),
    title: title,
    date: new Date().toISOString(),
    points: points,
    recipients: slots.map(function (i) {
      return { slot: i, name: state.students[i].name };
    }),
    undoneAt: null,
  });
  return true;
}
$("applyActivity").onclick = function () {
  var points = Number($("activityPoints").value),
    title = $("activityName").value.trim().slice(0, 100),
    ids = Array.from(activitySelection);
  if (!title || !integer(points, 1, 1000) || !ids.length) return;
  if (
    ids.some(function (i) {
      return !Number.isSafeInteger(state.students[i].points + points);
    })
  ) {
    alert("Pontuação demasiado elevada.");
    return;
  }
  if (!pushHistory(title, points, ids)) return;
  ids.forEach(function (i) {
    state.students[i].points += points;
  });
  if ($("rememberActivity").checked) {
    var preset = workspace.presets.find(function (p) {
      return p.name === title;
    });
    if (preset) preset.points = points;
    else if (workspace.presets.length < 200)
      workspace.presets.push({ name: title, points: points });
  }
  dirty();
  syncAll();
  selectActivities(false);
  $("activityFeedback").textContent =
    "✓ " + title + " · +" + points + " para " + ids.length + " alunos";
  playSound("win");
  renderPresets();
};
function renderHistory() {
  var root = $("activityHistory");
  root.textContent = "";
  if (!state.history.length) {
    root.appendChild(element("p", "", "Ainda não há atividades registadas."));
    return;
  }
  state.history
    .slice()
    .reverse()
    .forEach(function (entry) {
      var box = element(
        "article",
        "history-entry" + (entry.undoneAt ? " undone" : ""),
      );
      box.appendChild(
        element(
          "h3",
          "",
          entry.title +
            " · " +
            (entry.points > 0 ? "+" : "") +
            entry.points +
            " ★",
        ),
      );
      box.appendChild(
        element(
          "p",
          "",
          when(entry.date) + " · " + entry.recipients.length + " alunos",
        ),
      );
      box.appendChild(
        element(
          "p",
          "",
          entry.recipients
            .map(function (r) {
              return r.name;
            })
            .join(" · "),
        ),
      );
      if (entry.undoneAt)
        box.appendChild(element("p", "", "Anulado em " + when(entry.undoneAt)));
      else
        box.appendChild(
          button(
            "Desfazer lançamento",
            function () {
              if (entry.undoneAt) return;
              if (
                !confirm(
                  "Desfazer “" +
                    entry.title +
                    "” para " +
                    entry.recipients.length +
                    " alunos?",
                )
              )
                return;
              if (!canUndo(state, entry)) {
                alert(
                  "Não é possível desfazer: o aluno mudou ou a pontuação excede o limite.",
                );
                return;
              }
              entry.recipients.forEach(function (r) {
                state.students[r.slot].points -= entry.points;
              });
              entry.undoneAt = new Date().toISOString();
              dirty();
              syncAll();
              renderHistory();
              playSound("minus");
            },
            "small",
          ),
        );
      root.appendChild(box);
    });
}

function addPoints(i, n) {
  if (
    i < 0 ||
    !state.students[i] ||
    !Number.isSafeInteger(state.students[i].points + n)
  )
    return;
  if (!pushHistory("Ajuste individual", n, [i])) return;

  if (i < 0 || !state.students[i]) return;
  var previousLevel = Math.floor(Math.max(0, state.students[i].points) / 20);
  playSound(n > 0 ? "point" : "minus");
  state.students[i].points += n;
  dirty();
  updateCard(i);
  updateCounts();
  if (selected === i) {
    $("selectedScore").textContent = "★ " + state.students[i].points;
    replay($("selectedScore"), "score-pop");
  }
  var target = !$("winnerOverlay").hidden
    ? $("winnerPoint")
    : $("selectedScore");
  floatingPoints(target, n);
  renderScene(n > 0 ? "jump" : "hurt");
  if (
    n > 0 &&
    Math.floor(Math.max(0, state.students[i].points) / 20) > previousLevel
  ) {
    sceneMessage("NOVA FASE!");
    playSound("win");
  }
  status(
    (n > 0 ? "+" : "") +
      n +
      " ponto" +
      (Math.abs(n) > 1 ? "s" : "") +
      " para " +
      state.students[i].name +
      "!",
  );
}
function openBackup() {
  backupPending = null;
  $("backupReceipt").hidden = true;
  $("backupError").textContent = "";
  var count = workspace.classes.length,
    students = workspace.classes.reduce(function (n, c) {
      return (
        n +
        c.students.filter(function (s) {
          return s.name;
        }).length
      );
    }, 0);
  $("backupSummary").textContent =
    workspace.teachers.length +
    " professores · " +
    count +
    " turmas · " +
    students +
    " alunos · inclui arquivadas, vidas, avatares, equipas, histórico, aulas, presenças, TPC e notas privadas.";
  $("downloadBackup").disabled = false;
  $("backupExit").disabled = false;
  updateBackupStatus();
  openOverlay("backupOverlay", "downloadBackup");
}
$("save").onclick = openBackup;
$("hubBackup").onclick = openBackup;
$("quickBackup").onclick = openBackup;
function startBackup(exit) {
  try {
    var data = packageBackup(workspace),
      name = "TIC_BACKUP_COMPLETO_" + stamp() + ".json";
    downloadJSON(data, name);
    backupPending = {
      revision: workspace.revision,
      date: data.exportedAt,
      exit: exit,
    };
    $("backupReceipt").hidden = false;
    $("backupReceiptText").textContent =
      "Confirma que “" + name + "” ficou guardado na pasta escolhida.";
    $("confirmBackup").focus();
  } catch (e) {
    $("backupError").textContent =
      "Não foi possível gerar o backup: " + e.message;
  }
}
$("downloadBackup").onclick = function () {
  startBackup(false);
};
$("backupExit").onclick = function () {
  startBackup(true);
};
$("confirmBackup").onclick = function () {
  if (!backupPending) return;
  var pending = backupPending;
  backupPending = null;
  workspace.lastBackup = { revision: pending.revision, date: pending.date };
  persist();
  $("backupReceipt").hidden = true;
  if (pending.exit) {
    closeOverlay("backupOverlay");
    showHub();
  } else {
    $("backupError").textContent = "✓ Backup confirmado.";
    updateBackupStatus();
  }
};
function inspectSave(text, label) {
  pendingImport = null;
  $("applyImport").disabled = true;
  $("importPreview").textContent = "";
  $("replaceConfirm").checked = false;
  try {
    pendingImport = parseBackupText(text);

    var w = pendingImport.workspace;
    importMessage(
      (pendingImport.legacy ? "Save antigo compatível" : "Backup validado") +
        " · " +
        w.teachers.length +
        " professores · " +
        w.classes.length +
        " turma(s) · " +
        (pendingImport.date
          ? when(pendingImport.date)
          : "sem data de exportação"),
      false,
    );
    w.teachers.forEach(function (t) {
      $("importPreview").appendChild(
        element("div", "", t.title + " " + t.name + " · Master"),
      );
    });
    w.classes.forEach(function (c) {
      $("importPreview").appendChild(
        element(
          "div",
          "",
          c.className +
            " · " +
            c.students.filter(function (s) {
              return s.name;
            }).length +
            " alunos · " +
            c.history.length +
            " registos · " +
            (c.diary || emptyDiary()).lessons.length +
            " aulas" +
            (c.archived ? " · arquivada" : ""),
        ),
      );
    });
    document.querySelector(
      'input[name=importMode][value="' +
        (workspace.classes.length ? "copies" : "replace") +
        '"]',
    ).checked = true;
    updateImportMode();
  } catch (e) {
    pendingImport = null;
    importMessage("Não foi possível ler este backup. " + e.message, true);
  }
}
function updateImportMode() {
  var replace =
    document.querySelector("input[name=importMode]:checked").value ===
    "replace";
  $("replaceWarning").hidden =
    !replace || (!workspace.classes.length && workspace.revision === 0);
  $("applyImport").disabled =
    !pendingImport ||
    (replace &&
      (workspace.classes.length > 0 || workspace.revision > 0) &&
      !$("replaceConfirm").checked);
  $("applyImport").textContent = replace
    ? "Restaurar todas as turmas"
    : "Importar como novas turmas";
}
document.querySelectorAll("input[name=importMode]").forEach(function (r) {
  r.onchange = updateImportMode;
});
$("replaceConfirm").onchange = updateImportMode;
$("load").onclick = function () {
  pendingImport = null;
  importReadToken++;
  $("applyImport").disabled = true;
  $("loadFile").value = "";
  $("importText").value = "";
  $("importPreview").textContent = "";
  $("replaceConfirm").checked = false;
  $("replaceWarning").hidden = true;
  importMessage(
    "Seleciona um backup completo, uma turma exportada ou um save antigo.",
    false,
  );
  openOverlay("importOverlay", "loadFile");
};
$("hubImport").onclick = function () {
  $("load").click();
};
$("applyImport").onclick = function () {
  if (!pendingImport || this.disabled) return;
  var imported = copy(pendingImport.workspace),
    replace =
      document.querySelector("input[name=importMode]:checked").value ===
      "replace";
  if (
    !replace &&
    workspace.teachers.length +
      imported.teachers.filter(function (t) {
        return !workspace.teachers.some(function (x) {
          return (
            x.name === t.name && x.title === t.title && x.avatar === t.avatar
          );
        });
      }).length >
      100
  ) {
    importMessage("O limite total é de 100 professores.", true);
    return;
  }
  if (!replace && workspace.classes.length + imported.classes.length > 200) {
    importMessage("O limite total é de 200 turmas.", true);
    return;
  }
  try {
    if (replace) {
      if (workspace.classes.length || workspace.teachers.length)
        downloadJSON(
          packageBackup(workspace),
          "TIC_ANTES_DE_RESTAURAR_" + stamp() + ".json",
        );
      imported.revision = workspace.revision + 1;
      imported.lastBackup = null;
      workspace = imported;
      storageBlocked = false;
      try {
        localSnapshot = localStorage.getItem(STORE);
      } catch (e) {
        storageBlocked = true;
      }
      persist();
    } else {
      mergeTeachers(imported);
      imported.classes.forEach(function (c) {
        c.id = uid();
        c.className = (c.className + " · importada").slice(0, 50);
        workspace.classes.push(c);
      });
      imported.presets.forEach(function (p) {
        if (
          workspace.presets.length < 200 &&
          !workspace.presets.some(function (x) {
            return x.name === p.name;
          })
        )
          workspace.presets.push(p);
      });
      dirty();
    }
    pendingImport = null;
    showHub();
    $("hubBackupStatus").textContent = "✓ Dados importados. " + backupText();
  } catch (e) {
    importMessage("Não foi possível concluir a importação: " + e.message, true);
  }
};
window.addEventListener("beforeunload", function (e) {
  if (workspace && workspace.revision > 0 && dirtyBackup()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("storage", function (e) {
  if ((e.key === STORE || e.key === null) && e.storageArea === localStorage) {
    storageBlocked = true;
    storageOK = false;
    updateBackupStatus();
    $("storageWarning").textContent =
      "Outra janela alterou as turmas. Guarda um backup desta janela e recarrega antes de continuar.";
  }
});
function initWorkspace() {
  var raw;
  try {
    raw = localStorage.getItem(STORE);
    localSnapshot = raw;
    if (raw) {
      var parsed = JSON.parse(raw);
      workspace = validateWorkspace(parsed);
    }
  } catch (e) {
    try {
      var prev = localStorage.getItem(PREVIOUS);
      if (prev) {
        workspace = validateWorkspace(JSON.parse(prev));
        workspace.lastBackup = null;
        storageBlocked = true;
        storageOK = false;
      }
    } catch (ignore) {
      /* Recovery failed; the warning below keeps writes blocked. */
    }
    if (!workspace) {
      storageBlocked = true;
      storageOK = false;
    }
  }
  if (!workspace) workspace = emptyWorkspace();
  showHub();
  if (storageBlocked) {
    $("storageWarning").hidden = false;
    $("storageWarning").textContent =
      "A gravação local não pôde ser recuperada por completo. Se disponível, foi aberta a cópia anterior. Exporta estes dados ou restaura o teu backup; a gravação automática está suspensa.";
  }
  updateBackupStatus();
}
// Historical profiles remain in backups; only the active, user-named profile is used.
function currentTeacher() {
  const teacher = workspace?.teachers.find(
    (t) => t.id === workspace.activeTeacherId,
  );
  // IDs with this prefix belong to the old bundled demo profiles.
  return teacher && !teacher.id.startsWith("master-") ? teacher : null;
}
function masterName() {
  const t = currentTeacher();
  return t
    ? (t.title === "Master" ? "Master " : "Prof. ") + t.name
    : "Professor";
}
function teacherSprite(node) {
  masterSprite(node, currentTeacher()?.avatar ?? 0);
}
function requireTeacher() {
  if (currentTeacher()) return true;
  $("teacherError").textContent =
    "Indica e guarda o teu nome antes de continuar.";
  $("teacherName").focus();
  return false;
}
function refreshTeacher() {
  const t = currentTeacher();
  $("masterHeading").textContent =
    "♛ " +
    (t?.title === "Master"
      ? "MASTER"
      : (t?.title || "Professor").toUpperCase() + " MASTER");
  $("masterDisplayName").textContent = masterName();
  $("masterPortrait").setAttribute(
    "aria-label",
    masterName() + ": assumir o comando",
  );
  $("hubTeacherName").textContent = t
    ? masterName() + " · MASTER"
    : "O teu nome · MASTER";
  $("gameTeacherName").textContent = "♛ " + masterName();
  $("hubTeacherStatus").textContent = t
    ? "Nome guardado neste navegador"
    : "Começa por indicar o teu nome";
  $("teacherName").value = t?.name || "";
  $("teacherTitle").value = t?.title || "Professor";
  $("teacherAvatar").value = t?.avatar ?? 0;
  masterSprite($("teacherPreview"), t?.avatar ?? 0);
  masterSprite($("masterAvatar"), t?.avatar ?? 0);
  if (selected < 0) renderScene();
}
$("teacherAvatar").onchange = function () {
  masterSprite($("teacherPreview"), Number(this.value));
};
$("teacherForm").onsubmit = function (e) {
  e.preventDefault();
  if ($("classHub").hidden) return;
  const name = $("teacherName").value.trim();
  if (!name || name.length > 60) {
    $("teacherError").textContent = "Indica um nome com até 60 caracteres.";
    return;
  }
  const title = $("teacherTitle").value,
    avatar = Number($("teacherAvatar").value);
  if (
    !["Professor", "Professora", "Master"].includes(title) ||
    !integer(avatar, 0, 9)
  )
    return;
  let teacher = currentTeacher();
  if (!teacher) {
    if (workspace.teachers.length >= 100) {
      $("teacherError").textContent =
        "O backup atingiu o limite de perfis de professor.";
      return;
    }
    teacher = { id: uid() };
    workspace.teachers.push(teacher);
  }
  Object.assign(teacher, { name, title, avatar });
  workspace.activeTeacherId = teacher.id;
  dirty();
  refreshTeacher();
  $("teacherError").textContent = storageOK
    ? ""
    : "O nome está nesta sessão, mas não foi possível guardá-lo no navegador. Exporta um backup.";
};
function mergeTeachers(imported) {
  imported.teachers.forEach(function (t) {
    var same = workspace.teachers.find(function (x) {
      return x.name === t.name && x.title === t.title && x.avatar === t.avatar;
    });
    if (!same) {
      if (
        workspace.teachers.some(function (x) {
          return x.id === t.id;
        })
      )
        t.id = uid();
      workspace.teachers.push(t);
    }
  });
}

// Public presentation controls forward only a fixed allow-list of game actions.

var wheelTimerWindow = window,
  wheelNextCallback = null,
  lastWheelMirror = 0;
function cancelWheelFrame() {
  wheelTimerWindow.clearTimeout(wheelFrame);
  wheelNextCallback = null;
}
function scheduleWheelFrame(callback) {
  wheelNextCallback = callback;
  wheelTimerWindow =
    presentation.window && !presentation.window.closed
      ? presentation.window
      : window;
  return wheelTimerWindow.setTimeout(function () {
    if (!rolling) return;
    callback(Date.now());
    if (presentation.window && !presentation.window.closed) {
      if (Date.now() - lastWheelMirror > 60) {
        presentation.mirror();
        lastWheelMirror = Date.now();
      }
      var dest = presentation.window.document.getElementById("nameWheel");
      if (dest) dest.getContext("2d").drawImage($("nameWheel"), 0, 0);
    }
  }, 16);
}

function closeOverlay(id) {
  if (id === "diaryOverlay" && !diary.leaveDraft()) return;
  if (id === "attentionOverlay") {
    clearTimeout(attentionTimer);
    attentionTimer = null;
    attentionPhase = "idle";
  }
  if (id === "drawOverlay") {
    cancelRaffle();
    return;
  }
  $(id).hidden = true;
  if (returnFocus && returnFocus.focus) returnFocus.focus();

  if (id === "attentionOverlay" && $("attentionOverlay").hidden)
    document.body.classList.remove("silence-active");
}

const presentation = createPresentation({
  $,
  element,
  selectStudent,
  clearSelection,
  closeOverlay,
  get state() {
    return state;
  },
  onClose() {
    if (rolling && wheelNextCallback) {
      const callback = wheelNextCallback;
      cancelWheelFrame();
      wheelTimerWindow = window;
      wheelFrame = window.setTimeout(() => {
        if (rolling) wheelFrame = scheduleWheelFrame(callback);
      }, 50);
    }
  },
});
const diary = createDiary({
  $,
  element,
  button,
  dirty,
  syncAll,
  playSound,
  openOverlay,
  closeOverlay,
  masterName,
  requireTeacher,
  get workspace() {
    return workspace;
  },
  get state() {
    return state;
  },
  get storageOK() {
    return storageOK;
  },
});
initWorkspace();
$("bootWarning").hidden = true;
