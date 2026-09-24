import test from "node:test";
import assert from "node:assert/strict";
import { validateWorkspace, emptyWorkspace } from "../src/model.js";
import { packageBackup, parseBackup } from "../src/backup.js";
import { canUndo } from "../src/points.js";
import { rewardableRows } from "../src/diary-data.js";
import {
  removeStudent,
  sameStudent,
  setStudentName,
  studentRef,
} from "../src/students.js";
import { autoAvatar, guessGender } from "../src/avatars.js";

/** A version 10 workspace: students without ids, records without studentId. */
function version10() {
  const w = { ...emptyWorkspace(), version: 10 };
  const now = new Date().toISOString();
  w.classes = [
    {
      version: 6,
      id: "c1",
      className: "7.º B",
      lives: 5,
      students: [
        { name: "Ana", points: 3 },
        { name: "Bruno", points: 1 },
      ],
      groups: [],
      history: [
        {
          id: "h1",
          title: "TPC",
          date: now,
          points: 1,
          recipients: [
            { slot: 0, name: "Ana" },
            { slot: 1, name: "Beto" }, // slot 1 now holds someone else
          ],
          undoneAt: null,
        },
      ],
      diary: {
        lessons: [
          {
            id: "l1",
            date: now.slice(0, 10),
            number: 1,
            teacher: "Prof.",
            summary: "",
            activities: "",
            homework: "Ficha",
            due: "",
            attendance: [
              {
                slot: 0,
                name: "Ana",
                status: "present",
                note: "",
                delivery: "delivered",
                awardId: "h1",
              },
            ],
          },
        ],
        notes: [
          { id: "n1", date: now.slice(0, 10), text: "x", slot: 0, name: "Ana" },
          { id: "n2", date: now.slice(0, 10), text: "y", slot: null, name: "" },
        ],
      },
    },
  ];
  return w;
}

test("migration gives students ids and links records whose name still matches", () => {
  const w = validateWorkspace(version10());
  assert.equal(w.version, 11);
  const c = w.classes[0],
    [ana, bruno] = c.students;
  assert.ok(ana.id && bruno.id && ana.id !== bruno.id);
  assert.equal(c.students[2].id, null);
  const [toAna, toBeto] = c.history[0].recipients;
  assert.equal(toAna.studentId, ana.id);
  assert.equal(toBeto.studentId, null);
  assert.equal(c.diary.lessons[0].attendance[0].studentId, ana.id);
  assert.equal(c.diary.notes[0].studentId, ana.id);
  assert.equal(c.diary.notes[1].studentId, null);

  // Ids survive a backup round trip unchanged.
  const again = parseBackup(packageBackup(w)).workspace;
  assert.deepEqual(again, w);
});

test("renaming keeps history and homework links; removing breaks them", () => {
  const c = validateWorkspace(version10()).classes[0];
  const event = {
    points: 2,
    recipients: [studentRef(c, 0)],
    undoneAt: null,
  };
  const lesson = c.diary.lessons[0];
  lesson.attendance[0].awardId = null;

  assert.equal(setStudentName(c.students[0], "Ana Sofia"), "renamed");
  assert.equal(canUndo(c, event), true);
  assert.equal(rewardableRows(c, lesson).length, 1);

  removeStudent(c.students[0]);
  assert.deepEqual(
    [c.students[0].id, c.students[0].name, c.students[0].points],
    [null, "", 0],
  );
  assert.equal(canUndo(c, event), false);

  // A new student in the same slot, even with the old name, is someone else.
  assert.equal(setStudentName(c.students[0], "Ana Sofia"), "new");
  assert.equal(sameStudent(c, event.recipients[0]), false);
  assert.equal(rewardableRows(c, lesson).length, 0);
});

test("repeated student ids are rejected", () => {
  const w = validateWorkspace(version10());
  w.classes[0].students[1].id = w.classes[0].students[0].id;
  assert.throws(() => validateWorkspace(w), /aluno repetidos/);
});

/** Run `fn` with Math.random returning the given values in turn. */
function withRandom(values, fn) {
  const real = Math.random;
  let i = 0;
  Math.random = () => values[i++ % values.length];
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}
const fresh = (name) => ({
  name,
  avatarMode: "auto",
  gender: "robot",
  avatar: null,
});

test("the name suggests a gender; unknown names give no hint", () => {
  assert.equal(guessGender("Ana Silva"), "f");
  assert.equal(guessGender("João Costa"), "m");
  assert.equal(guessGender("Inês"), "f");
  // Not in the lists: Portuguese ending.
  assert.equal(guessGender("Lorena"), "f");
  assert.equal(guessGender("Gilberto"), "m");
  assert.equal(guessGender("Luca"), "m");
  assert.equal(guessGender("Kim"), null);
});

test("any student can get a robot; unknown names are not singled out", () => {
  // A low first draw gives a robot, whatever the name.
  for (const name of ["Mariana", "Pedro", "Kim"]) {
    const s = fresh(name);
    withRandom([0.1, 0], () => autoAvatar(s, 0));
    assert.equal(s.gender, "robot");
  }
  // Otherwise known names follow the name...
  const m = fresh("Mariana");
  withRandom([0.9, 0.9, 0], () => autoAvatar(m, 0));
  assert.equal(m.gender, "f");
  // ...and unknown names get a random gender, never a forced robot.
  const a = fresh("Kim"),
    b = fresh("Kim");
  withRandom([0.9, 0.2, 0], () => autoAvatar(a, 0));
  withRandom([0.9, 0.7, 0], () => autoAvatar(b, 0));
  assert.deepEqual([a.gender, b.gender], ["f", "m"]);
});

test("fixing a name keeps the avatar unless it now points to the other gender", () => {
  const s = fresh("Joana");
  withRandom([0.9, 0], () => autoAvatar(s, 0));
  const avatar = s.avatar;
  s.name = "Joanna";
  autoAvatar(s, 0);
  assert.equal(s.avatar, avatar);
  s.name = "Pedro";
  withRandom([0.9, 0], () => autoAvatar(s, 0));
  assert.equal(s.gender, "m");

  // A robot stays a robot when the name is corrected.
  const robot = fresh("Rui");
  withRandom([0.1, 0], () => autoAvatar(robot, 0));
  robot.name = "Rui Mota";
  autoAvatar(robot, 0);
  assert.equal(robot.gender, "robot");

  const manual = {
    name: "Pedro",
    avatarMode: "manual",
    gender: "robot",
    avatar: 3,
  };
  autoAvatar(manual, 0);
  assert.deepEqual([manual.gender, manual.avatar], ["robot", 3]);
});
