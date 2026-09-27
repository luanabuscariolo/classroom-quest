import { packageBackup } from "./backup.js";
import { autoAvatar } from "./avatars.js";
import { downloadJSON } from "./dom.js";
import { emptyDiary, emptyWorkspace } from "./model.js";
import { emptyStudent, setStudentName } from "./students.js";
import { copy, dateLabel, dayISO, stamp, uid, validDay } from "./utils.js";

/** Class list: create, archive, export and delete classes. */
export function createHub(app) {
  const {
    $,
    element,
    button,
    dirty,
    openOverlay,
    teacher,
    enterClass,
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
  /** Delete a class for good; a copy of it is downloaded first. */
  function deleteClass(c) {
    if (
      !confirm(
        "Apagar a turma " +
          c.className +
          " com todos os registos, notas e pontos?\n\n" +
          "Não se pode desfazer. Antes de apagar, é descarregada uma cópia da turma " +
          "(pode voltar a importá-la).",
      )
    )
      return;
    exportClass(c);
    const w = app.workspace;
    w.classes = w.classes.filter((x) => x !== c);
    if (w.activeClassId === c.id) w.activeClassId = w.classes[0]?.id ?? null;
    dirty();
    render();
  }
  const QUOTES = [
    "Cada aula é uma nova missão.",
    "Pequenos progressos também contam.",
    "Uma turma curiosa é uma turma viva.",
    "Hoje alguém vai aprender algo pela primeira vez.",
    "Errar faz parte de aprender.",
    "Uma boa pergunta vale mais do que mil respostas.",
    "O seu entusiasmo é contagiante.",
    "Paciência também se ensina.",
  ];
  const MONTHS = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const WEEKDAYS = [
    "domingo",
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
  ];
  /** Greeting, today's date, what is due today and a phrase of the day. */
  function renderGreeting() {
    const now = new Date(),
      today = dayISO(now),
      t = teacher.current(),
      hour = now.getHours(),
      active = app.workspace.classes.filter((c) => !c.archived),
      due = active.reduce(
        (n, c) =>
          n +
          c.diary.lessons.filter((l) => l.due === today && l.homework.trim())
            .length,
        0,
      );
    $("hubHello").textContent = t
      ? (hour < 12 ? "Bom dia" : hour < 20 ? "Boa tarde" : "Boa noite") +
        ", " +
        teacher.displayName() +
        "!"
      : "Olá! Vamos começar?";
    $("hubToday").textContent =
      WEEKDAYS[now.getDay()] +
      ", " +
      now.getDate() +
      " de " +
      MONTHS[now.getMonth()] +
      " de " +
      now.getFullYear() +
      " · " +
      active.length +
      (active.length === 1 ? " turma" : " turmas") +
      (due
        ? " · 📘 " +
          due +
          (due === 1 ? " TPC para verificar hoje" : " TPC para verificar hoje")
        : "");
    const dayOfYear = Math.floor(
      (now - new Date(now.getFullYear(), 0, 0)) / 86400000,
    );
    $("hubQuote").textContent = "“" + QUOTES[dayOfYear % QUOTES.length] + "”";
  }
  function render() {
    renderGreeting();
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
      const today = dayISO(new Date()),
        last = c.diary.lessons
          .filter((l) => l.date <= today)
          .sort((a, b) => b.date.localeCompare(a.date))[0],
        dueToday = c.diary.lessons.filter(
          (l) => l.due === today && l.homework.trim(),
        );
      card.appendChild(
        element(
          "p",
          "class-last",
          last
            ? (last.date === today
                ? "✓ Aula de hoje já registada"
                : "Última aula: " + dateLabel(last.date)) +
                " · Aula " +
                last.number
            : "Ainda sem aulas registadas",
        ),
      );
      if (dueToday.length)
        card.appendChild(
          element(
            "p",
            "class-due",
            "📘 TPC para verificar hoje: " +
              dueToday.map((l) => l.homework.slice(0, 40)).join(", "),
          ),
        );
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
      // Today's lesson is the main way in; past lessons open read-only.
      const enter = element("div", "class-enter-row");
      enter.append(
        button(
          "▶ Aula de hoje · " + dateLabel(dayISO(new Date())).slice(0, 5),
          () => enterClass(c.id),
          "gold class-enter",
        ),
        button("📅 Aula passada", () => openPast(c), "class-past"),
      );
      card.appendChild(enter);
      const actions = element("div", "class-actions");
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
      actions.appendChild(button("Exportar", () => exportClass(c), "small"));
      actions.appendChild(
        button("🗑 Apagar", () => deleteClass(c), "small pink"),
      );
      card.appendChild(actions);
      root.appendChild(card);
    });
    updateBackupStatus();
  }

  // ── Past lessons ─────────────────────────────────────────────────────────
  let pastClass = null;
  function openPast(c) {
    if (!teacher.ensure()) return;
    pastClass = c;
    const today = dayISO(new Date()),
      list = $("pastList");
    list.textContent = "";
    const lessons = c.diary.lessons
      .filter((l) => l.date < today)
      .sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
    if (!lessons.length)
      list.appendChild(
        element(
          "p",
          "diary-hint",
          "Esta turma ainda não tem aulas passadas registadas.",
        ),
      );
    lessons.forEach((l) =>
      list.appendChild(
        button(
          dateLabel(l.date) +
            " · Aula " +
            l.number +
            (l.summary ? " · " + l.summary.slice(0, 60) : ""),
          () => enterClass(c.id, l.date),
          "past-item",
        ),
      ),
    );
    $("pastDate").value = "";
    $("pastError").textContent = "";
    openOverlay("pastOverlay", lessons.length ? null : "pastDate");
  }
  $("pastOpen").onclick = () => {
    const date = $("pastDate").value;
    if (!validDay(date) || date >= dayISO(new Date())) {
      $("pastError").textContent = "Escolha uma data anterior a hoje.";
      return;
    }
    enterClass(pastClass.id, date);
  };

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
      assessments: [],
    };
    for (let i = 0; i < 30; i++) {
      const s = emptyStudent();
      if (names[i]) {
        setStudentName(s, names[i]);
        autoAvatar(s, i);
      }
      c.students.push(s);
    }
    app.workspace.classes.push(c);
    dirty();
    enterClass(c.id);
    // Continue straight to reviewing names and avatars.
    $("editNames").click();
  };
  $("showArchived").onchange = render;

  return { render };
}
