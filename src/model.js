import { uid, validDate, integer, textField, validDay } from "./utils.js";
const validateLegacy = validate;
export function validate(raw) {
  if (
    !raw ||
    [1, 2, 3, 4, 5, 6].indexOf(raw.version) < 0 ||
    typeof raw.className !== "string" ||
    raw.className.length > 100 ||
    !Number.isInteger(raw.lives) ||
    raw.lives < 0 ||
    raw.lives > 5 ||
    !Array.isArray(raw.students) ||
    raw.students.length > 30 ||
    !Array.isArray(raw.groups) ||
    raw.groups.length > 6
  )
    throw Error("Formato de save inválido.");
  var students = raw.students.map(function (s) {
    if (
      !s ||
      typeof s.name !== "string" ||
      s.name.length > 70 ||
      !Number.isSafeInteger(s.points)
    )
      throw Error("Dados de aluno inválidos.");
    return {
      name: s.name.trim().slice(0, 60),
      points: s.points,
      inPool: typeof s.inPool === "boolean" ? s.inPool : !!s.name.trim(),
      gender: ["f", "m", "robot"].indexOf(s.gender) >= 0 ? s.gender : "robot",
      avatar:
        Number.isInteger(s.avatar) && s.avatar >= 0 && s.avatar < 32
          ? s.avatar
          : null,
      avatarMode:
        s.avatarMode === "auto" ? "auto" : s.gender ? "manual" : "auto",
    };
  });
  while (students.length < 30)
    students.push({
      name: "",
      points: 0,
      inPool: false,
      gender: "robot",
      avatar: null,
      avatarMode: "auto",
    });
  var groups = raw.groups.map(function (g) {
    if (!g || !Number.isSafeInteger(g.points))
      throw Error("Dados de equipa inválidos.");
    var members;
    if (raw.version === 1) {
      if (!Array.isArray(g.memberIds)) throw Error("Membros inválidos.");
      members = g.memberIds.map(function (id) {
        return raw.students.findIndex(function (s) {
          return s.id === id;
        });
      });
    } else members = g.members;
    if (
      !Array.isArray(members) ||
      members.length > 30 ||
      new Set(members).size !== members.length ||
      members.some(function (i) {
        return !Number.isInteger(i) || i < 0 || i >= 30;
      })
    )
      throw Error("Membros inválidos.");
    return { points: g.points, members: members.slice() };
  });
  return {
    version: 6,
    className: raw.className.slice(0, 50),
    lives: raw.lives,
    students: students,
    groups: groups,
  };
}

export function defaultPresets() {
  return [
    { name: "TPC entregue", points: 1 },
    { name: "Trabalho entregue", points: 2 },
    { name: "Tarefa concluída na aula", points: 1 },
  ];
}

export function emptyWorkspace() {
  return {
    format: "tic-quest-workspace",
    version: 10,
    revision: 0,
    teachers: defaultTeachers(),
    activeTeacherId: null,
    activeClassId: null,
    classes: [],
    presets: defaultPresets(),
    lastBackup: null,
  };
}

export function validClass(raw) {
  var c = validateLegacy(raw);
  c.id = typeof raw.id === "string" && raw.id.length <= 100 ? raw.id : uid();
  c.archived = raw.archived === true;
  c.history = [];
  if (raw.history !== undefined) {
    if (!Array.isArray(raw.history) || raw.history.length > 10000)
      throw Error("Histórico inválido ou demasiado extenso.");
    var ids = new Set();
    c.history = raw.history.map(function (e) {
      if (
        !e ||
        typeof e.id !== "string" ||
        e.id.length > 100 ||
        ids.has(e.id) ||
        typeof e.title !== "string" ||
        e.title.length > 100 ||
        !validDate(e.date) ||
        !integer(e.points, -1000, 1000) ||
        !Array.isArray(e.recipients) ||
        !e.recipients.length ||
        e.recipients.length > 30
      )
        throw Error("Lançamento de atividade inválido.");
      ids.add(e.id);
      var slots = new Set();
      var recipients = e.recipients.map(function (r) {
        if (
          !r ||
          !integer(r.slot, 0, 29) ||
          slots.has(r.slot) ||
          typeof r.name !== "string" ||
          r.name.length > 70
        )
          throw Error("Alunos do histórico inválidos.");
        slots.add(r.slot);
        return { slot: r.slot, name: r.name };
      });
      if (
        e.undoneAt !== null &&
        e.undoneAt !== undefined &&
        !validDate(e.undoneAt)
      )
        throw Error("Data de anulação inválida.");
      return {
        id: e.id,
        title: e.title,
        date: e.date,
        points: e.points,
        recipients: recipients,
        undoneAt: e.undoneAt || null,
      };
    });
  }
  c.diary = validateDiary(raw.diary);
  c.diary.lessons.forEach(function (l) {
    l.attendance.forEach(function (r) {
      if (
        r.awardId &&
        !c.history.some(function (h) {
          return (
            h.id === r.awardId &&
            h.recipients.some(function (p) {
              return p.slot === r.slot;
            })
          );
        })
      )
        throw Error("Ligação de pontos do TPC inválida.");
    });
  });
  return c;
}

export function validateWorkspace(raw) {
  if (
    !raw ||
    raw.format !== "tic-quest-workspace" ||
    [8, 9, 10].indexOf(raw.version) < 0
  )
    throw Error(
      "Versão não suportada. Usa uma versão compatível do TIC Quest.",
    );
  if (
    !Array.isArray(raw.classes) ||
    raw.classes.length > 200 ||
    !Array.isArray(raw.presets) ||
    raw.presets.length > 200 ||
    !integer(raw.revision, 0, Number.MAX_SAFE_INTEGER)
  )
    throw Error("Estrutura do backup inválida.");
  var w = emptyWorkspace(),
    ids = new Set();
  w.classes = raw.classes.map(function (c) {
    var item = validClass(c);
    if (ids.has(item.id)) throw Error("Identificadores de turma repetidos.");
    ids.add(item.id);
    return item;
  });
  w.presets = raw.presets.map(function (p) {
    if (
      !p ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 100 ||
      !integer(p.points, 1, 1000)
    )
      throw Error("Atividade frequente inválida.");
    return { name: p.name, points: p.points };
  });
  validateTeachers(raw, w);
  w.revision = raw.revision;
  w.activeClassId = ids.has(raw.activeClassId) ? raw.activeClassId : null;
  if (raw.lastBackup) {
    if (
      !validDate(raw.lastBackup.date) ||
      !integer(raw.lastBackup.revision, 0, w.revision)
    )
      throw Error("Metadados do backup inválidos.");
    w.lastBackup = {
      date: raw.lastBackup.date,
      revision: raw.lastBackup.revision,
    };
  }
  return w;
}

export function defaultTeachers() {
  return [];
}

export function validateTeachers(raw, w) {
  if (raw.version === 8) {
    w.teachers = defaultTeachers();
    w.activeTeacherId = null;
    return;
  }
  if (!Array.isArray(raw.teachers) || raw.teachers.length > 100)
    throw Error("Perfis de professores inválidos.");
  var ids = new Set();
  w.teachers = raw.teachers.map(function (t) {
    if (
      !t ||
      typeof t.id !== "string" ||
      !t.id ||
      t.id.length > 100 ||
      ids.has(t.id) ||
      typeof t.name !== "string" ||
      !t.name.trim() ||
      t.name.length > 60 ||
      ["Professor", "Professora", "Master"].indexOf(t.title) < 0 ||
      !integer(t.avatar, 0, 9)
    )
      throw Error("Perfil Master inválido.");
    ids.add(t.id);
    return { id: t.id, name: t.name.trim(), title: t.title, avatar: t.avatar };
  });
  if (!w.teachers.length && raw.activeTeacherId === null) {
    w.activeTeacherId = null;
    return;
  }
  if (!ids.has(raw.activeTeacherId)) throw Error("Professor ativo inválido.");
  w.activeTeacherId = raw.activeTeacherId;
}

export function emptyDiary() {
  return { lessons: [], notes: [] };
}

export function validateDiary(raw) {
  if (raw === undefined) return emptyDiary();
  if (
    !raw ||
    !Array.isArray(raw.lessons) ||
    raw.lessons.length > 2000 ||
    !Array.isArray(raw.notes) ||
    raw.notes.length > 10000
  )
    throw Error("Diário inválido.");
  var ids = new Set(),
    out = emptyDiary();
  out.lessons = raw.lessons.map(function (l) {
    if (
      !l ||
      !textField(l.id, 100) ||
      !l.id ||
      ids.has(l.id) ||
      !validDay(l.date) ||
      !integer(l.number, 1, 10000) ||
      !textField(l.teacher, 80) ||
      !textField(l.summary, 20000) ||
      !textField(l.activities, 20000) ||
      !textField(l.homework, 20000) ||
      (l.due !== "" && !validDay(l.due)) ||
      !Array.isArray(l.attendance) ||
      l.attendance.length > 30
    )
      throw Error("Registo de aula inválido.");
    ids.add(l.id);
    var slots = new Set(),
      a = l.attendance.map(function (r) {
        if (
          !r ||
          !integer(r.slot, 0, 29) ||
          slots.has(r.slot) ||
          !textField(r.name, 60) ||
          !["unmarked", "present", "absent", "late"].includes(r.status) ||
          !textField(r.note, 1000) ||
          !["pending", "delivered", "missing", "excused"].includes(
            r.delivery,
          ) ||
          (r.awardId !== null && !textField(r.awardId, 100))
        )
          throw Error("Presença ou entrega inválida.");
        slots.add(r.slot);
        return {
          slot: r.slot,
          name: r.name,
          status: r.status,
          note: r.note,
          delivery: r.delivery,
          awardId: r.awardId,
        };
      });
    return {
      id: l.id,
      date: l.date,
      number: l.number,
      teacher: l.teacher,
      summary: l.summary,
      activities: l.activities,
      homework: l.homework,
      due: l.due,
      attendance: a,
    };
  });
  ids.clear();
  out.notes = raw.notes.map(function (n) {
    if (
      !n ||
      !textField(n.id, 100) ||
      !n.id ||
      ids.has(n.id) ||
      !validDay(n.date) ||
      !textField(n.text, 6000) ||
      !(n.slot === null || integer(n.slot, 0, 29)) ||
      !textField(n.name, 60)
    )
      throw Error("Nota privada inválida.");
    ids.add(n.id);
    return { id: n.id, date: n.date, text: n.text, slot: n.slot, name: n.name };
  });
  return out;
}
