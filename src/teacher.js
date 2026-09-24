import { masterSprite } from "./avatars.js";
import { integer, uid } from "./utils.js";

/**
 * The active teacher profile: a display preference stored in the workspace,
 * not an account. Historical profiles remain in backups.
 */
export function createTeacher(app) {
  const { $, dirty, onChange } = app;

  function current() {
    const workspace = app.workspace,
      teacher = workspace?.teachers.find(
        (t) => t.id === workspace.activeTeacherId,
      );
    // IDs with this prefix belong to the old bundled demo profiles.
    return teacher && !teacher.id.startsWith("master-") ? teacher : null;
  }
  function displayName() {
    const t = current();
    return t
      ? (t.title === "Master" ? "Master " : "Prof. ") + t.name
      : "Professor";
  }
  function sprite(node) {
    masterSprite(node, current()?.avatar ?? 0);
  }
  function ensure() {
    if (current()) return true;
    $("teacherError").textContent =
      "Indica e guarda o teu nome antes de continuar.";
    $("teacherName").focus();
    return false;
  }
  function refresh() {
    const t = current();
    $("masterHeading").textContent =
      "♛ " +
      (t?.title === "Master"
        ? "MASTER"
        : (t?.title || "Professor").toUpperCase() + " MASTER");
    $("masterDisplayName").textContent = displayName();
    $("masterPortrait").setAttribute(
      "aria-label",
      displayName() + ": assumir o comando",
    );
    $("hubTeacherName").textContent = t
      ? displayName() + " · MASTER"
      : "O teu nome · MASTER";
    $("gameTeacherName").textContent = "♛ " + displayName();
    $("hubTeacherStatus").textContent = t
      ? "Nome guardado neste navegador"
      : "Começa por indicar o teu nome";
    $("teacherName").value = t?.name || "";
    $("teacherTitle").value = t?.title || "Professor";
    $("teacherAvatar").value = t?.avatar ?? 0;
    masterSprite($("teacherPreview"), t?.avatar ?? 0);
    masterSprite($("masterAvatar"), t?.avatar ?? 0);
    onChange();
  }

  $("teacherAvatar").onchange = function () {
    masterSprite($("teacherPreview"), Number(this.value));
  };
  $("teacherForm").onsubmit = function (e) {
    e.preventDefault();
    // The name can only be changed from the class hub.
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
    const workspace = app.workspace;
    let teacher = current();
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
    refresh();
    $("teacherError").textContent = app.storageOK
      ? ""
      : "O nome está nesta sessão, mas não foi possível guardá-lo no navegador. Exporta um backup.";
  };

  return { current, displayName, sprite, ensure, refresh };
}
