// Fictitious class "5ºX" used to try the app and to check the grade
// calculations (tests/demo.test.js). 30 students, 10 lessons, one scenario
// per student. All names and data are invented.
import { awardHomework, createLesson } from "../src/diary-data.js";
import { defaultAssessments } from "../src/grading.js";
import { emptyWorkspace, validateWorkspace } from "../src/model.js";
import { autoAvatar } from "../src/avatars.js";
import { emptyStudent, setStudentName, studentRef } from "../src/students.js";

export const DEMO_DATES = [
  "2026-09-11",
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-09-24",
];

/**
 * One entry per student: name, marks per lesson (1-based lesson number →
 * changes from the normal row) and scores of 1.º Trabalho, 2.º Trabalho and
 * Extra (null = not scored yet). `from` = first lesson (joined later).
 */
/** Criteria of the 1.º Trabalho (the Bloco de Notas exercise). */
export const DEMO_CRITERIA = [
  ["Criou a pasta", 20],
  ["Criou o ficheiro .txt", 20],
  ["Guardou o ficheiro na pasta", 20],
  ["Escreveu o texto pedido", 40],
];

/**
 * Marks for the four criteria that give exactly `score`: the basic steps
 * (weight 20 each) stay higher, the text (weight 40) lower — as usually
 * happens. (3 × b × 20 + t × 40) ÷ 100 = score, with t = score − 1,5 × x.
 */
export function criterionMarks(score) {
  let x = Math.floor(Math.min(100 - score, (2 * score) / 3));
  if (x % 2) x--;
  return [score + x, score + x, score + x, score - (3 * x) / 2];
}

export const DEMO_STUDENTS = [
  ["Ana Beatriz Costa", "Tudo perfeito", {}, [100, 100, 100]],
  [
    "Bruno Ferreira",
    "Linha de exemplo da planilha (trabalhos 50/40/90)",
    {},
    [50, 40, 90],
  ],
  [
    "Carla Mendes",
    "3 faltas",
    {
      2: { status: "absent" },
      5: { status: "absent" },
      8: { status: "absent" },
    },
    [72, 68, 80],
  ],
  [
    "Diogo Pires",
    "2 faltas justificadas (não contam)",
    { 3: { status: "excused" }, 4: { status: "excused" } },
    [65, 70, 75],
  ],
  [
    "Eva Santos",
    "2 atrasos",
    { 1: { status: "late" }, 6: { status: "late" } },
    [88, 84, 90],
  ],
  [
    "Filipe Rocha",
    "3 aulas sem material",
    { 2: { material: false }, 3: { material: false }, 7: { material: false } },
    [60, 55, 70],
  ],
  [
    "Gabriela Lima",
    "Atraso e sem material na mesma aula",
    { 5: { status: "late", material: false } },
    [78, 82, 85],
  ],
  [
    "Hugo Martins",
    "Comportamento regular 2 vezes",
    { 3: { behavior: "regular" }, 9: { behavior: "regular" } },
    [70, 74, 60],
  ],
  [
    "Inês Carvalho",
    "Comportamento a melhorar 1 vez, depois recuperou",
    { 1: { behavior: "poor" } },
    [90, 92, 95],
  ],
  [
    "João Almeida",
    "Participação ativa 5 vezes (não sobe acima de 100)",
    {
      1: { participation: "active" },
      3: { participation: "active" },
      5: { participation: "active" },
      7: { participation: "active" },
      9: { participation: "active" },
    },
    [82, 80, 88],
  ],
  [
    "Laura Sousa",
    "Participação fraca 4 vezes",
    {
      2: { participation: "low" },
      4: { participation: "low" },
      6: { participation: "low" },
      8: { participation: "low" },
    },
    [75, 70, 65],
  ],
  [
    "Miguel Ribeiro",
    "Sem nota no 2.º Trabalho (nota provisória)",
    {},
    [80, null, 70],
  ],
  ["Nádia Gomes", "Ainda sem nenhuma nota de trabalho", {}, [null, null, null]],
  [
    "Óscar Teixeira",
    "Faltou à verificação da Ficha 2; Ficha 1 não entregue",
    { 8: { status: "absent" } },
    [58, 62, 50],
  ],
  [
    "Patrícia Lopes",
    "Observações em 2 aulas",
    {
      3: { note: "Ajudou um colega com o exercício 2." },
      7: { note: "Pediu para repetir a explicação." },
    },
    [85, 88, 90],
  ],
  [
    "Rafael Moreira",
    "Um pouco de tudo: falta, regular, fraca, sem material",
    {
      2: { status: "absent" },
      4: { behavior: "regular" },
      6: { participation: "low" },
      9: { material: false },
    },
    [66, 64, 70],
  ],
  ["Sara Oliveira", "Tudo perfeito e trabalhos altos", {}, [98, 96, 100]],
  [
    "Tiago Nunes",
    "Comportamento a melhorar 3 vezes",
    {
      2: { behavior: "poor" },
      5: { behavior: "poor" },
      8: { behavior: "poor" },
    },
    [55, 60, 45],
  ],
  ["Vasco Antunes", "Atraso 1 vez", { 10: { status: "late" } }, [74, 78, 80]],
  ["Beatriz Rodrigues", "Sem ocorrências", {}, [91, 87, 93]],
  [
    "Duarte Marques",
    "Falta 1 e falta justificada 1",
    { 4: { status: "absent" }, 9: { status: "excused" } },
    [69, 71, 60],
  ],
  [
    "Leonor Fonseca",
    "Regular e ativa no mesmo dia",
    { 6: { behavior: "regular", participation: "active" } },
    [83, 85, 88],
  ],
  [
    "Martim Correia",
    "Sem material 1 vez",
    { 10: { material: false } },
    [77, 73, 70],
  ],
  ["Matilde Pinto", "Sem ocorrências", {}, [95, 91, 100]],
  [
    "Rodrigo Cardoso",
    "Fraca 1 vez e a melhorar 1 vez",
    { 3: { participation: "low" }, 7: { behavior: "poor" } },
    [62, 58, 65],
  ],
  ["Mariana Tavares", "Sem ocorrências", {}, [86, 90, 80]],
  [
    "Tomás Barbosa",
    "Faltas 2",
    { 6: { status: "absent" }, 7: { status: "absent" } },
    [68, 64, 72],
  ],
  ["Carolina Neves", "Sem ocorrências", {}, [79, 83, 85]],
  [
    "Afonso Faria",
    "Atrasos 3",
    { 2: { status: "late" }, 4: { status: "late" }, 8: { status: "late" } },
    [73, 70, 75],
  ],
  ["Gonçalo Cunha", "Entrou na turma na 5.ª aula", {}, [80, 76, 90], 5],
];

const TOPICS = [
  [
    "Regras da sala de informática e segurança",
    "Apresentação; regras; criação de contas.",
  ],
  ["Hardware e software", "Identificar componentes; ficha de exploração."],
  ["Pesquisa segura na internet", "Pesquisa guiada; fontes fiáveis."],
  ["Palavras-passe seguras", "Criar palavras-passe; jogo de pares."],
  ["Processador de texto: formatação", "Formatar um texto curto."],
  ["Processador de texto: imagens e tabelas", "Inserir imagem e tabela."],
  ["Cidadania digital", "Debate sobre pegada digital."],
  ["Folha de cálculo: células e fórmulas", "Primeiras fórmulas SOMA e MÉDIA."],
  ["Folha de cálculo: gráficos", "Gráfico de barras com dados da turma."],
  ["Revisões para o 1.º trabalho", "Exercícios de revisão em pares."],
];

export function buildDemoWorkspace() {
  const w = emptyWorkspace();
  w.teachers = [
    {
      id: "demo-teacher",
      name: "Demonstração",
      title: "Professora",
      avatar: 2,
    },
  ];
  w.activeTeacherId = "demo-teacher";
  const students = Array.from({ length: 30 }, () => emptyStudent());
  const c = {
    version: 6,
    id: "demo-5x",
    className: "5ºX",
    lives: 5,
    students,
    groups: [],
    history: [],
    archived: false,
    diary: { lessons: [], notes: [] },
    assessments: [],
  };
  DEMO_STUDENTS.forEach(([name, , , , from], i) => {
    if (from) return; // joins later
    setStudentName(students[i], name);
    autoAvatar(students[i], i);
  });
  DEMO_DATES.forEach((date, index) => {
    const number = index + 1;
    DEMO_STUDENTS.forEach(([name, , , , from], i) => {
      if (from === number) {
        setStudentName(students[i], name);
        autoAvatar(students[i], i);
      }
    });
    const lesson = createLesson(c, c.diary, date, "Prof. Demonstração");
    lesson.summary = TOPICS[index][0];
    lesson.activities = TOPICS[index][1];
    lesson.attendance.forEach((row) => {
      const marks = DEMO_STUDENTS[row.slot][2][number];
      if (marks) Object.assign(row, marks);
    });
    c.diary.lessons.push(lesson);
  });
  // TPC: Ficha 1 set in lesson 2 (due lesson 4), Ficha 2 in lesson 6 (due lesson 8).
  const byNumber = (n) => c.diary.lessons[n - 1];
  const tpc = [
    [
      2,
      "Ficha 1: componentes do computador",
      4,
      { 13: "missing", 17: "missing", 3: "excused" },
    ],
    [
      6,
      "Ficha 2: formatar um convite",
      8,
      { 13: "pending", 10: "missing", 26: "missing" },
    ],
  ];
  for (const [set, text, due, exceptions] of tpc) {
    const lesson = byNumber(set);
    lesson.homework = text;
    lesson.due = byNumber(due).date;
    lesson.attendance.forEach((row) => {
      row.delivery = exceptions[row.slot] || "delivered";
    });
    const rows = lesson.attendance.filter((r) => r.delivery === "delivered");
    const event = awardHomework(c, lesson, rows, 1);
    // Stamp the award on the day it was checked.
    event.date = byNumber(due).date + "T11:00:00.000Z";
  }
  // Some points from the game, and a general note on two days.
  const points = [
    [3, "Ajuste individual", 2, [0, 16]],
    [7, "Tarefa concluída na aula", 1, [4, 9, 23]],
  ];
  for (const [n, title, value, slots] of points) {
    c.history.push({
      id: "demo-points-" + n,
      title,
      date: byNumber(n).date + "T10:30:00.000Z",
      points: value,
      recipients: slots.map((s) => studentRef(c, s)),
      undoneAt: null,
    });
    slots.forEach((s) => (students[s].points += value));
  }
  c.diary.notes.push(
    {
      id: "demo-note-1",
      date: DEMO_DATES[0],
      text: "Primeira aula: turma curiosa e participativa.",
      slot: null,
      studentId: null,
      name: "",
    },
    {
      id: "demo-note-2",
      date: DEMO_DATES[7],
      text: "Barulho no início; melhorou com o Atenção, turma!",
      slot: null,
      studentId: null,
      name: "",
    },
  );
  // Trabalhos of the 1.º período. The 1.º Trabalho is evaluated by criteria.
  c.assessments = defaultAssessments("p1");
  const [first, second, extra] = c.assessments;
  Object.assign(first, {
    date: DEMO_DATES[4],
    description:
      "Bloco de Notas: criar uma pasta com o seu nome, criar um ficheiro .txt, guardá-lo nessa pasta e escrever o texto pedido.",
    criteria: DEMO_CRITERIA.map(([name, weight], k) => ({
      id: "demo-criterion-" + (k + 1),
      name,
      weight,
    })),
  });
  Object.assign(second, {
    date: DEMO_DATES[8],
    description: "Apresentação sobre segurança na Internet.",
  });
  Object.assign(extra, {
    date: DEMO_DATES[9],
    description: "Desafio extra de pesquisa.",
  });
  DEMO_STUDENTS.forEach(([, , , scores], i) =>
    scores.forEach((score, k) => {
      if (score === null) return;
      const id = students[i].id;
      if (k === 0)
        first.marks[id] = Object.fromEntries(
          criterionMarks(score).map((m, j) => [first.criteria[j].id, m]),
        );
      else c.assessments[k].scores[id] = score;
    }),
  );
  w.classes = [c];
  w.activeClassId = c.id;
  return validateWorkspace(JSON.parse(JSON.stringify(w)));
}
