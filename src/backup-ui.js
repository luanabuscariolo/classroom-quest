import { STORE } from "./storage.js";
import { MAX_BACKUP_BYTES, packageBackup, parseBackupText } from "./backup.js";
import { emptyDiary } from "./model.js";
import { downloadJSON } from "./dom.js";
import { copy, stamp, uid, when } from "./utils.js";

/** Backup download, import/restore and the storage status shown on every screen. */
export function createBackupUI(app) {
  const { $, element, openOverlay, closeOverlay, persistence, showHub } = app;
  let backupPending = null,
    pendingImport = null,
    importReadToken = 0;

  function backupText() {
    const last = persistence.workspace.lastBackup;
    return (
      (persistence.needsBackup()
        ? "● Alterações sem backup confirmado"
        : "✓ Backup confirmado") +
      " · Última cópia: " +
      when(last && last.date)
    );
  }
  function updateStatus() {
    const { storageOK, storageBlocked } = persistence;
    const text =
      (storageOK ? "" : "⚠ Gravação local suspensa — exporta um backup. ") +
      backupText();
    ["hubBackupStatus", "gameBackupStatus", "backupDetail"].forEach((id) => {
      $(id).textContent = text;
      $(id).classList.toggle("safe", storageOK && !persistence.needsBackup());
    });

    $("ready").textContent = storageOK
      ? "Gravação automática no navegador · O backup protege todas as turmas."
      : "Gravação local indisponível · Exporta o backup antes de fechar.";
    $("storageWarning").hidden = storageOK;
    $("storageWarning").textContent = storageBlocked
      ? "Existem dados locais que não foram carregados. Não serão substituídos automaticamente. Usa “Restaurar / importar” ou guarda um backup antes de continuar."
      : "Não foi possível guardar no navegador. Mantém esta página aberta e descarrega um backup.";
  }

  // Backup download with an explicit confirmation that the file was saved.
  function openBackup() {
    const workspace = persistence.workspace;
    backupPending = null;
    $("backupReceipt").hidden = true;
    $("backupError").textContent = "";
    const count = workspace.classes.length,
      students = workspace.classes.reduce(
        (n, c) => n + c.students.filter((s) => s.name).length,
        0,
      );
    $("backupSummary").textContent =
      workspace.teachers.length +
      " professores · " +
      count +
      " turmas · " +
      students +
      " alunos · inclui arquivadas, vidas, avatares, equipas, histórico, aulas, presenças, TPC e notas privadas.";
    $("downloadBackup").disabled = false;
    $("backupExit").disabled = false;
    updateStatus();
    openOverlay("backupOverlay", "downloadBackup");
  }
  function startBackup(exit) {
    try {
      const data = packageBackup(persistence.workspace),
        name = "TIC_BACKUP_COMPLETO_" + stamp() + ".json";
      downloadJSON(data, name);
      backupPending = {
        revision: persistence.workspace.revision,
        date: data.exportedAt,
        exit,
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
  $("save").onclick = openBackup;
  $("hubBackup").onclick = openBackup;
  $("quickBackup").onclick = openBackup;
  $("downloadBackup").onclick = function () {
    startBackup(false);
  };
  $("backupExit").onclick = function () {
    startBackup(true);
  };
  $("confirmBackup").onclick = function () {
    if (!backupPending) return;
    const pending = backupPending;
    backupPending = null;
    persistence.confirmBackup(pending.revision, pending.date);
    $("backupReceipt").hidden = true;
    if (pending.exit) {
      closeOverlay("backupOverlay");
      showHub();
    } else {
      $("backupError").textContent = "✓ Backup confirmado.";
      updateStatus();
    }
  };

  // Import: read and validate first, then copy or replace after confirmation.
  function importMessage(text, error) {
    $("importStatus").textContent = text;
    $("importStatus").classList.toggle("error", !!error);
  }
  function importMode() {
    return document.querySelector("input[name=importMode]:checked").value;
  }
  function inspectSave(text, label) {
    pendingImport = null;
    $("applyImport").disabled = true;
    $("importPreview").textContent = "";
    $("replaceConfirm").checked = false;
    try {
      pendingImport = parseBackupText(text);

      const w = pendingImport.workspace;
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
      w.teachers.forEach((t) => {
        $("importPreview").appendChild(
          element("div", "", t.title + " " + t.name + " · Master"),
        );
      });
      w.classes.forEach((c) => {
        $("importPreview").appendChild(
          element(
            "div",
            "",
            c.className +
              " · " +
              c.students.filter((s) => s.name).length +
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
          (persistence.workspace.classes.length ? "copies" : "replace") +
          '"]',
      ).checked = true;
      updateImportMode();
    } catch (e) {
      pendingImport = null;
      importMessage("Não foi possível ler este backup. " + e.message, true);
    }
  }
  function updateImportMode() {
    const workspace = persistence.workspace,
      replace = importMode() === "replace",
      hasData = workspace.classes.length > 0 || workspace.revision > 0;
    $("replaceWarning").hidden = !replace || !hasData;
    $("applyImport").disabled =
      !pendingImport || (replace && hasData && !$("replaceConfirm").checked);
    $("applyImport").textContent = replace
      ? "Restaurar todas as turmas"
      : "Importar como novas turmas";
  }
  function mergeTeachers(imported) {
    const workspace = persistence.workspace;
    imported.teachers.forEach((t) => {
      const same = workspace.teachers.find(
        (x) =>
          x.name === t.name && x.title === t.title && x.avatar === t.avatar,
      );
      if (!same) {
        if (workspace.teachers.some((x) => x.id === t.id)) t.id = uid();
        workspace.teachers.push(t);
      }
    });
  }
  $("loadFile").addEventListener("change", function () {
    const f = this.files && this.files[0];
    if (!f) return;
    const token = ++importReadToken;
    pendingImport = null;
    $("applyImport").disabled = true;
    if (f.size > MAX_BACKUP_BYTES) {
      importMessage("Ficheiro demasiado grande. O limite é 20 MB.", true);
      return;
    }
    importMessage("A ler " + f.name + "…", false);
    const reader = new FileReader();
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
  document.querySelectorAll("input[name=importMode]").forEach((r) => {
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
    const workspace = persistence.workspace,
      imported = copy(pendingImport.workspace),
      replace = importMode() === "replace";
    if (
      !replace &&
      workspace.teachers.length +
        imported.teachers.filter(
          (t) =>
            !workspace.teachers.some(
              (x) =>
                x.name === t.name &&
                x.title === t.title &&
                x.avatar === t.avatar,
            ),
        ).length >
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
        // Keep a copy of the data about to be replaced.
        if (workspace.classes.length || workspace.teachers.length)
          downloadJSON(
            packageBackup(workspace),
            "TIC_ANTES_DE_RESTAURAR_" + stamp() + ".json",
          );
        persistence.replace(imported);
      } else {
        mergeTeachers(imported);
        imported.classes.forEach((c) => {
          c.id = uid();
          c.className = (c.className + " · importada").slice(0, 50);
          workspace.classes.push(c);
        });
        imported.presets.forEach((p) => {
          if (
            workspace.presets.length < 200 &&
            !workspace.presets.some((x) => x.name === p.name)
          )
            workspace.presets.push(p);
        });
        persistence.dirty();
      }
      pendingImport = null;
      showHub();
      $("hubBackupStatus").textContent = "✓ Dados importados. " + backupText();
    } catch (e) {
      importMessage(
        "Não foi possível concluir a importação: " + e.message,
        true,
      );
    }
  };

  window.addEventListener("beforeunload", (e) => {
    const workspace = persistence.workspace;
    if (workspace && workspace.revision > 0 && persistence.needsBackup()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("storage", (e) => {
    if ((e.key === STORE || e.key === null) && e.storageArea === localStorage) {
      persistence.block();
      updateStatus();
      $("storageWarning").textContent =
        "Outra janela alterou as turmas. Guarda um backup desta janela e recarrega antes de continuar.";
    }
  });

  return { updateStatus };
}
