export const femaleNames = new Set(
  "adriana alice aline amanda amelia ana andrea beatriz bia bruna camila carla carolina catarina clara daniela diana elisa emilia eva fatima francisca gabriela helena ines iris isabel joana julia lara laura leonor leticia liana liliana luana lucia luisa luiza madalena margarida maria mariana marta matilde monica natalia patricia paula raquel renata rita sara sarah sofia susana talita teresa valentina vanessa vera vitoria viviane yasmin".split(
    " ",
  ),
);

export const maleNames = new Set(
  "afonso alex alexandre andre antonio arthur artur bernardo bruno caio carlos cesar daniel davi david diego diogo duarte eduardo enzo felipe francisco gabriel goncalo guilherme gustavo henrique hugo igor isaac joao jorge jose juliano leonardo lucas luciano luis manuel mario martim mateus matheus miguel murilo nuno otavio paulo pedro rafael renato ricardo rodrigo rui salvador samuel santiago sergio simao thiago tiago tomas victor vinicius vitor william ze zeca".split(
    " ",
  ),
);

export function autoAvatar(s, i) {
  if (s.avatarMode === "manual") return;
  const name = s.name
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  s.gender =
    Math.random() < 0.28
      ? "robot"
      : femaleNames.has(name)
        ? "f"
        : maleNames.has(name)
          ? "m"
          : "robot";
  const options =
    s.gender === "f"
      ? [28, 29, 30, 31]
      : s.gender === "m"
        ? [24, 25, 26, 27]
        : [16, 17, 18, 19, 20, 21, 22, 23];
  s.avatar = options[Math.floor(Math.random() * options.length)];
  s.avatarMode = "auto";
}

export function avatarChoices(gender) {
  return gender === "f"
    ? [28, 29, 30, 31, 8, 9, 10, 11, 14, 15]
    : gender === "m"
      ? [24, 25, 26, 27, 4, 5, 6, 7, 12, 13]
      : [16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3];
}

export function avatarFor(s, i) {
  const options = avatarChoices(s.gender);
  return Number.isInteger(s.avatar) && s.avatar >= 0 && s.avatar < 32
    ? s.avatar
    : options[i % options.length];
}

export function sprite(node, index) {
  node.dataset.sheet = index >= 16 ? "new" : "original";
  index = index % 16;
  node.textContent = "";
  node.classList.add("game-avatar");
  node.style.backgroundSize = "400% 400%";
  node.style.backgroundPosition =
    ((index % 4) * 100) / 3 + "% " + (Math.floor(index / 4) * 100) / 3 + "%";
  node.dataset.avatar = index + (node.dataset.sheet === "new" ? 16 : 0);
}

export function masterSprite(node, index) {
  node.textContent = "";
  node.classList.add("game-avatar");
  node.removeAttribute("data-avatar");
  node.dataset.masterAvatar = index;
  node.dataset.sheet = index === 0 ? "teacher" : "masters";
  if (index === 0) {
    node.style.backgroundSize = "contain";
    node.style.backgroundPosition = "center bottom";
    return;
  }
  const i = index - 1,
    col = i % 3,
    row = Math.floor(i / 3),
    xs = [50, 440, 840],
    ws = [380, 390, 385],
    ys = [0, 435, 850],
    hs = [435, 415, 404],
    x = xs[col],
    w = ws[col],
    y = ys[row],
    h = hs[row];
  node.style.setProperty(
    "--master-size",
    (1254 / w) * 100 + "% " + (1254 / h) * 100 + "%",
  );
  node.style.setProperty(
    "--master-position",
    (x / (1254 - w)) * 100 + "% " + (y / (1254 - h)) * 100 + "%",
  );
}

/** Next avatar of the same character type; the choice becomes manual. */
export function cycleAvatar(student, slot) {
  const options = avatarChoices(student.gender);
  student.avatar =
    options[(options.indexOf(avatarFor(student, slot)) + 1) % options.length];
  student.avatarMode = "manual";
}

/** Apply a "Personagem" choice: "auto" or a fixed character type. */
export function setCharacter(student, slot, value) {
  if (value === "auto") {
    student.avatarMode = "auto";
    autoAvatar(student, slot);
  } else {
    student.avatarMode = "manual";
    student.gender = value;
    const options = avatarChoices(student.gender);
    student.avatar = options[slot % options.length];
  }
}
