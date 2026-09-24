import { uid, copy, dayISO, validDay, dateLabel, integer } from "./utils.js";
import { emptyDiary } from "./model.js";
import { canUndo } from "./points.js";
import { downloadText } from "./dom.js";
import { sameStudent } from "./students.js";
import {
  ATTENDANCE_LABELS,
  DELIVERY_LABELS,
  awardHomework,
  createLesson,
  dailyReport,
  dayDates,
  eventsOn,
  lessonReport,
  rewardableRows,
  wasRewarded,
} from "./diary-data.js";

/**
 * Diary screen: lessons, attendance, homework, private notes and daily
 * reports. Rules and report texts live in diary-data.js. Edits go to a draft
 * of the open class's diary until saveDayEdits() commits it.
 * Diary state is private; app getters follow class switches and restored backups.
 */
export function createDiary(app) {
  const {
    $,
    element,
    button,
    dirty,
    syncAll,
    playSound,
    openOverlay,
    closeOverlay,
    masterName,
  } = app;
  let diaryClassId = null,
    diaryLessonId = null,
    diaryTab = "lesson",
    calendarView = new Date(),
    reportDay = null;
  let dayDraft = null,
    dayDraftClass = null,
    dayPending = false,
    dayMode = "home";

  function diaryClass() {
    return app.workspace.classes.find((c) => c.id === diaryClassId);
  }
  function committedDiaryData(c) {
    if (!c.diary) c.diary = emptyDiary();
    return c.diary;
  }
  function lesson() {
    const c = diaryClass();
    return c && diaryData(c).lessons.find((l) => l.id === diaryLessonId);
  }

  function renderCalendar() {
    const c = diaryClass();
    if (!c) return;
    const year = calendarView.getFullYear(),
      month = calendarView.getMonth(),
      root = $("calendarGrid");
    root.textContent = "";
    $("calendarMonth").textContent = calendarView.toLocaleDateString("pt-PT", {
      month: "long",
      year: "numeric",
    });
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let n = 0; n < offset; n++) root.appendChild(element("span"));
    const dates = diaryData(c).lessons.map((l) => l.date);
    for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) {
      const date = dayISO(new Date(year, month, i));
      const b = button(
        String(i),
        function () {
          chooseDay(this.dataset.date);
        },
        "",
      );
      b.className =
        "calendar-day" +
        (dates.includes(date) ? " has-lesson" : "") +
        (date === $("lessonDate").value ? " chosen-date" : "") +
        (date === dayISO(new Date()) ? " today" : "");
      b.dataset.date = date;
      b.setAttribute(
        "aria-label",
        dateLabel(date) + (dates.includes(date) ? " · com aula" : ""),
      );
      b.setAttribute("aria-pressed", String(date === $("lessonDate").value));
      root.appendChild(b);
    }
    $("calendarStats").textContent =
      diaryData(c).lessons.length +
      " aulas registadas · dias com aula sublinhados a verde";
  }

  $("lessonDate").onchange = function () {
    if (!validDay(this.value)) {
      this.value = dayISO(new Date());
    }
    chooseDay(this.value);
  };
  $("calendarToday").onclick = function () {
    chooseDay(dayISO(new Date()));
  };
  $("monthPrev").onclick = function () {
    calendarView = new Date(
      calendarView.getFullYear(),
      calendarView.getMonth() - 1,
      1,
    );
    renderCalendar();
  };
  $("monthNext").onclick = function () {
    calendarView = new Date(
      calendarView.getFullYear(),
      calendarView.getMonth() + 1,
      1,
    );
    renderCalendar();
  };
  function loadDay() {
    const c = diaryClass();
    if (!c) return;
    const lessons = diaryData(c)
        .lessons.filter((l) => l.date === $("lessonDate").value)
        .sort((a, b) => a.number - b.number),
      root = $("lessonSelect");
    root.textContent = "";
    if (!lessons.length) {
      const o = element("option", "", "Sem aula registada");
      o.value = "";
      root.appendChild(o);
      diaryLessonId = null;
    } else {
      lessons.forEach((l) => {
        const o = element("option", "", "Aula " + l.number + " · " + l.teacher);
        o.value = l.id;
        root.appendChild(o);
      });
      if (!lessons.some((l) => l.id === diaryLessonId))
        diaryLessonId = lessons[0].id;
      root.value = diaryLessonId;
    }
    renderLesson();
  }
  $("lessonSelect").onchange = function () {
    diaryLessonId = this.value;
    renderLesson();
  };
  $("newDiaryLesson").onclick = function () {
    const c = diaryClass(),
      date = $("lessonDate").value;
    if (!c || !validDay(date)) return;
    const d = diaryData(c);
    if (d.lessons.length >= 2000) {
      alert("Limite de 2000 aulas por turma.");
      return;
    }
    if (
      d.lessons.some((l) => l.date === date) &&
      !confirm("Já existe uma aula nesta data. Criar outra aula?")
    )
      return;
    const l = createLesson(c, d, date, masterName());
    d.lessons.push(l);
    diaryLessonId = l.id;
    diaryTab = "lesson";
    saveDiary();
    loadDay();
    renderCalendar();
    $("lessonSummary").focus();
  };
  function switchDiaryTab(tab) {
    diaryTab = tab;
    const l = lesson();
    $("lessonPane").hidden = tab !== "lesson" || !l;
    $("homeworkPane").hidden = tab !== "homework" || !l;
    $("notesPane").hidden = tab !== "notes";
    $("lessonEmpty").hidden = !!l || tab === "notes";
    [
      ["tabLesson", "lesson"],
      ["tabHomework", "homework"],
      ["tabNotes", "notes"],
    ].forEach((pair) => {
      $(pair[0]).setAttribute("aria-pressed", String(tab === pair[1]));
    });
    if (tab === "notes") renderNotes();
  }
  $("tabLesson").onclick = function () {
    switchDiaryTab("lesson");
  };
  $("tabHomework").onclick = function () {
    switchDiaryTab("homework");
  };
  $("tabNotes").onclick = function () {
    switchDiaryTab("notes");
  };
  function renderLesson() {
    const l = lesson();
    $("homeworkFeedback").textContent = "";
    if (l) {
      $("lessonNumber").value = l.number;
      $("lessonTeacher").value = l.teacher;
      $("lessonSummary").value = l.summary;
      $("lessonActivities").value = l.activities;
      $("lessonHomework").value = l.homework;
      $("homeworkDue").value = l.due;
      renderAttendance();
      renderHomework();
    }
    switchDiaryTab(diaryTab);
  }
  [
    ["lessonSummary", "summary"],
    ["lessonActivities", "activities"],
    ["lessonHomework", "homework"],
  ].forEach((pair) => {
    $(pair[0]).oninput = function () {
      const l = lesson();
      if (!l) return;
      l[pair[1]] = this.value;
      saveDiary();
      if (pair[1] === "homework") updateRewardButton();
    };
  });
  $("lessonNumber").onchange = function () {
    const l = lesson(),
      v = Number(this.value);
    if (!l) return;
    if (!integer(v, 1, 10000)) {
      this.value = l.number;
      return;
    }
    l.number = v;
    saveDiary();
    loadDay();
  };
  $("homeworkDue").onchange = function () {
    const l = lesson();
    if (!l) return;
    if (this.value && !validDay(this.value)) {
      this.value = l.due;
      return;
    }
    l.due = this.value;
    saveDiary();
  };
  function selectOptions(options, value, fn) {
    const select = element("select", "field");
    options.forEach((pair) => {
      const o = element("option", "", pair[1]);
      o.value = pair[0];
      select.appendChild(o);
    });
    select.value = value;
    select.onchange = fn;
    return select;
  }
  function attendanceCounts() {
    const l = lesson();
    if (!l) return;
    $("attendanceCount").textContent = Object.keys(ATTENDANCE_LABELS)
      .map(
        (k) =>
          ATTENDANCE_LABELS[k] +
          ": " +
          l.attendance.filter((r) => r.status === k).length,
      )
      .join(" · ");
  }
  function renderAttendance() {
    const l = lesson(),
      root = $("attendanceList");
    root.textContent = "";
    l.attendance.forEach((r) => {
      const row = element("div", "attendance-row"),
        select = selectOptions(
          Object.entries(ATTENDANCE_LABELS),
          r.status,
          function () {
            r.status = this.value;
            saveDiary();
            attendanceCounts();
          },
        );
      select.dataset.attendance = r.slot;
      select.setAttribute("aria-label", "Presença de " + r.name);
      const note = element("input", "field");
      note.maxLength = 1000;
      note.value = r.note;
      note.placeholder = "Observação privada";
      note.setAttribute("aria-label", "Observação de " + r.name);
      note.oninput = function () {
        r.note = this.value;
        saveDiary();
      };
      row.append(element("strong", "", r.name), select, note);
      root.appendChild(row);
    });
    attendanceCounts();
  }
  $("allPresent").onclick = function () {
    const l = lesson();
    if (!l) return;
    const marked = l.attendance.some(
      (r) => r.status === "absent" || r.status === "late",
    );
    if (
      marked &&
      !confirm("Substituir também as faltas e os atrasos já marcados?")
    )
      return;
    l.attendance.forEach((r) => {
      r.status = "present";
    });
    saveDiary();
    renderAttendance();
  };
  function rewardable() {
    const c = diaryClass(),
      l = lesson();
    return c && l ? rewardableRows(c, l) : [];
  }
  function updateRewardButton() {
    const l = lesson(),
      n = rewardable().length,
      points = Number($("homeworkPoints").value);
    $("rewardHomework").textContent =
      "★ Dar +" +
      (integer(points, 1, 1000) ? points : "?") +
      " a " +
      n +
      " entrega" +
      (n === 1 ? "" : "s");
    $("rewardHomework").disabled =
      !l || !l.homework.trim() || !n || !integer(points, 1, 1000);
  }
  function renderHomework() {
    const c = diaryClass(),
      l = lesson(),
      root = $("homeworkList");
    root.textContent = "";
    l.attendance.forEach((r) => {
      const row = element("div", "attendance-row"),
        select = selectOptions(
          Object.entries(DELIVERY_LABELS),
          r.delivery,
          function () {
            r.delivery = this.value;
            saveDiary();
            renderHomework();
          },
        );
      select.dataset.delivery = r.slot;
      select.setAttribute("aria-label", "Entrega de " + r.name);
      const info = wasRewarded(c, r)
        ? "✓ Pontos atribuídos"
        : !sameStudent(c, r)
          ? "Aluno removido da turma; pontos bloqueados"
          : "";
      row.append(
        element("strong", "", r.name),
        select,
        element("small", "diary-hint", info),
      );
      root.appendChild(row);
    });
    updateRewardButton();
  }
  $("homeworkPoints").oninput = updateRewardButton;
  function awardDeliveredHomework() {
    const c = diaryClass(),
      l = lesson(),
      rows = rewardable(),
      points = Number($("homeworkPoints").value);
    if (!l || !l.homework.trim() || !rows.length || !integer(points, 1, 1000))
      return;
    if (!awardHomework(c, l, rows, points)) {
      alert("Não é possível adicionar este lançamento.");
      return;
    }
    saveDiary();
    if (app.state.id === c.id) syncAll();
    renderHomework();
    $("homeworkFeedback").textContent =
      "✓ " +
      rows.length +
      " entregas premiadas. Podes desfazer no Histórico por dia.";
    playSound("point");
  }
  function fillNoteTargets() {
    const c = diaryClass(),
      root = $("noteTarget");
    root.textContent = "";
    const o = element("option", "", "Turma · notas gerais");
    o.value = "class";
    root.appendChild(o);
    c.students.forEach((s, i) => {
      if (s.name) {
        const o = element("option", "", s.name);
        o.value = i;
        root.appendChild(o);
      }
    });
    const previousSlots = new Set(c.students.map((s, i) => (s.name ? i : -1)));
    diaryData(c).notes.forEach((n) => {
      if (n.slot !== null && !previousSlots.has(n.slot)) {
        const o = element("option", "", n.name + " · registo anterior");
        o.value = n.slot;
        root.appendChild(o);
        previousSlots.add(n.slot);
      }
    });
    renderNotes();
  }
  $("noteTarget").onchange = renderNotes;
  function renderNotes() {
    const c = diaryClass();
    if (!c) return;
    const target = $("noteTarget").value,
      slot = target === "class" ? null : Number(target),
      root = $("notesList");
    root.textContent = "";
    const notes = diaryData(c)
      .notes.filter((n) => n.slot === slot)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
    notes.forEach((n) => {
      const box = element("article", "private-note");
      box.appendChild(
        element(
          "small",
          "",
          dateLabel(n.date) + " · " + (n.slot === null ? "Turma" : n.name),
        ),
      );
      const text = element("textarea", "field");
      text.rows = 3;
      text.maxLength = 6000;
      text.value = n.text;
      text.setAttribute("aria-label", "Nota de " + dateLabel(n.date));
      text.oninput = function () {
        n.text = this.value;
        saveDiary();
      };
      box.appendChild(text);
      box.appendChild(
        button(
          "Eliminar nota",
          () => {
            if (!confirm("Eliminar esta anotação?")) return;
            diaryData(c).notes = diaryData(c).notes.filter(
              (x) => x.id !== n.id,
            );
            saveDiary();
            renderNotes();
          },
          "small",
        ),
      );
      root.appendChild(box);
    });
    if (!notes.length)
      root.appendChild(element("p", "diary-hint", "Sem anotações."));
  }
  $("noteForm").onsubmit = function (e) {
    e.preventDefault();
    const c = diaryClass(),
      text = $("noteText").value.trim(),
      date = $("noteDate").value;
    if (!c || !text || !validDay(date)) return;
    if (diaryData(c).notes.length >= 10000) {
      alert("Limite de notas atingido.");
      return;
    }
    const target = $("noteTarget").value,
      slot = target === "class" ? null : Number(target);
    diaryData(c).notes.push({
      id: uid(),
      date,
      text: text.slice(0, 6000),
      slot,
      studentId: slot === null ? null : c.students[slot].id,
      name: slot === null ? "" : c.students[slot].name,
    });
    $("noteText").value = "";
    saveDiary();
    renderNotes();
  };
  function copyForSchool(text) {
    if (!text) {
      $("diaryFeedback").textContent = "Ainda não há texto para copiar.";
      return;
    }
    function fallback() {
      openOverlay("copyOverlay", "copyText");
      $("copyText").value = text;
      $("copyText").select();
    }
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(() => {
        $("diaryFeedback").textContent = "✓ Texto copiado.";
      }, fallback);
    else fallback();
  }
  $("copySummary").onclick = function () {
    const l = lesson();
    if (l) copyForSchool(l.summary);
  };
  $("copyHomework").onclick = function () {
    const l = lesson();
    if (l)
      copyForSchool(
        l.homework + (l.due ? "\nEntrega: " + dateLabel(l.due) : ""),
      );
  };
  function currentLessonReport(privateNotes) {
    const c = diaryClass(),
      l = lesson();
    return l ? lessonReport(c, diaryData(c), l, privateNotes) : "";
  }
  $("exportLesson").onclick = function () {
    const l = lesson();
    if (!l) return;
    downloadText(
      currentLessonReport($("exportPrivate").checked),
      "TIC_Aula_" + l.date + "_" + l.number + ".txt",
    );
  };
  function diaryData(c) {
    return dayDraft && c.id === dayDraftClass
      ? dayDraft
      : committedDiaryData(c);
  }
  function saveDiary() {
    dayPending = true;
    $("diarySaved").textContent = "● Alterações por guardar";
    $("saveDiaryDay").disabled = false;
  }
  function prepareDayDraft() {
    const c = diaryClass();
    dayDraft = c ? copy(committedDiaryData(c)) : null;
    dayDraftClass = c ? c.id : null;
    dayPending = false;
    $("saveDiaryDay").disabled = true;
  }
  function saveDayEdits() {
    const c = diaryClass();
    if (!c) return;
    if ($("noteText").value.trim() && dayMode === "edit")
      $("noteForm").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    if (dayPending) {
      c.diary = copy(dayDraft);
      dirty();
      dayPending = false;
      $("saveDiaryDay").disabled = true;
    }
    $("diarySaved").textContent = app.storageOK
      ? "✓ Dia guardado no navegador · incluído no próximo backup"
      : "⚠ Sem gravação local. Exporta um backup antes de fechar.";
  }
  function leaveDraft() {
    if (!dayPending && !$("noteText").value.trim()) return true;
    if (!confirm("Guardar as alterações antes de continuar?")) return false;
    saveDayEdits();
    return true;
  }
  function setDayMode(mode) {
    dayMode = mode;
    $("diaryStart").hidden = mode !== "home";
    $("dailyHistory").hidden = mode !== "history";
    $("dailyReport").hidden = mode !== "report";
    $("diaryBody").hidden = mode !== "edit" || !diaryClass();
    $("dailyEditBar").hidden = mode !== "edit";
    $("dailyNavigation").hidden = !diaryClass();
    if (mode === "history") renderDailyHistory();
  }

  function openDiary() {
    if (!app.requireTeacher()) return;
    const options = $("diaryClass");
    options.textContent = "";
    app.workspace.classes.forEach((c) => {
      const o = element(
        "option",
        "",
        c.className + (c.archived ? " · arquivada" : ""),
      );
      o.value = c.id;
      options.appendChild(o);
    });
    diaryClassId = app.workspace.classes.some(
      (c) => c.id === app.workspace.activeClassId,
    )
      ? app.workspace.activeClassId
      : app.workspace.classes[0]?.id;
    options.value = diaryClassId || "";
    prepareDayDraft();
    $("lessonDate").value = dayISO(new Date());
    calendarView = new Date();
    diaryLessonId = null;
    diaryTab = "lesson";
    $("diaryFeedback").textContent = "";
    $("exportPrivate").checked = false;
    $("diaryEmpty").hidden = !!diaryClass();
    $("diaryBody").hidden = !diaryClass();
    $("noteText").value = "";
    $("diarySaved").textContent = app.storageOK
      ? "Escolhe anotar ou consultar um dia"
      : "⚠ Gravação local indisponível";
    if (diaryClass()) {
      renderCalendar();
      loadDay();
      fillNoteTargets();
      $("noteDate").value = $("lessonDate").value;
    }
    openOverlay("diaryOverlay", "diaryClass");

    setDayMode("home");
  }
  $("hubDiary").onclick = openDiary;
  $("gameDiary").onclick = openDiary;
  $("diaryClass").onchange = function () {
    const next = this.value;
    if (!leaveDraft()) {
      this.value = diaryClassId;
      return;
    }
    diaryClassId = next;
    prepareDayDraft();
    diaryLessonId = null;
    loadDay();
    renderCalendar();
    fillNoteTargets();
    $("noteText").value = "";
    setDayMode("home");
  };
  function startDailyEdit(date) {
    if (!leaveDraft()) return;
    chooseDay(date);
    setDayMode("edit");
    if (!lesson()) $("newDiaryLesson").click();
    $("noteDate").value = date;
    renderCalendar();
  }
  $("annotateToday").onclick = function () {
    startDailyEdit(dayISO(new Date()));
  };
  $("annotateDate").onclick = function () {
    const date = $("dailyDate").value;
    if (validDay(date)) startDailyEdit(date);
  };
  $("dailyDate").value = dayISO(new Date());
  $("dailyHome").onclick = function () {
    if (leaveDraft()) setDayMode("home");
  };
  $("showDailyHistory").onclick = function () {
    if (leaveDraft()) setDayMode("history");
  };
  $("startHistory").onclick = function () {
    if (leaveDraft()) setDayMode("history");
  };
  $("saveDiaryDay").onclick = saveDayEdits;
  $("showWholeDay").onclick = function () {
    saveDayEdits();
    renderWholeDay($("lessonDate").value);
  };

  $("rewardHomework").onclick = function () {
    saveDayEdits();
    awardDeliveredHomework();
    saveDayEdits();
  };
  function renderDailyHistory() {
    const c = diaryClass(),
      root = $("dailyHistoryList");
    root.textContent = "";
    if (!c) return;
    const filter = $("historyDateFilter").value;
    let dates = dayDates(c, diaryData(c));
    if (filter) dates = dates.filter((d) => d === filter);
    if (!dates.length) {
      root.appendChild(element("p", "", "Sem registos nesta data."));
      return;
    }
    dates.forEach((date) => {
      const d = diaryData(c),
        lessons = d.lessons.filter((l) => l.date === date),
        notes = d.notes.filter((n) => n.date === date),
        events = eventsOn(c, date),
        card = element("article", "daily-card");
      card.append(
        element("h3", "", dateLabel(date)),
        element(
          "p",
          "",
          lessons.length +
            " aulas · " +
            notes.length +
            " notas · " +
            events.length +
            " lançamentos de pontos",
        ),
      );
      card.appendChild(
        button(
          "Ver dia completo",
          () => {
            renderWholeDay(date);
          },
          "mint",
        ),
      );
      card.appendChild(
        button(
          "Editar anotações",
          () => {
            startDailyEdit(date);
          },
          "",
        ),
      );
      root.appendChild(card);
    });
  }
  $("historyDateFilter").oninput = renderDailyHistory;
  $("clearHistoryFilter").onclick = function () {
    $("historyDateFilter").value = "";
    renderDailyHistory();
  };
  function dailyPlainText(c, date) {
    return dailyReport(c, diaryData(c), date);
  }

  $("editReportDay").onclick = function () {
    startDailyEdit(reportDay);
  };
  $("dailyReportBack").onclick = function () {
    setDayMode("history");
  };
  $("copyWholeDay").onclick = function () {
    copyForSchool(dailyPlainText(diaryClass(), reportDay));
  };
  $("exportWholeDay").onclick = function () {
    downloadText(
      dailyPlainText(diaryClass(), reportDay),
      "TIC_Dia_" + reportDay + ".txt",
    );
  };
  // The points tool stays quick; its history routes to the same daily record.
  $("historyTab").onclick = function () {
    closeOverlay("activitiesOverlay");
    openDiary();
    setDayMode("history");
  };

  function renderWholeDay(date) {
    reportDay = date;
    setDayMode("report");
    $("dailyReportTitle").textContent =
      diaryClass().className + " · " + dateLabel(date);
    $("dailyReportText").textContent = dailyPlainText(diaryClass(), date);
    $("diaryOverlay").querySelector(".diary-modal").scrollTop = 0;

    const c = diaryClass(),
      root = $("dailyPointEvents");
    root.textContent = "";
    eventsOn(c, date)
      .filter((h) => !h.undoneAt)
      .forEach((h) => {
        const line = element("div", "daily-card");
        line.appendChild(
          element(
            "strong",
            "",
            h.title + " · " + (h.points > 0 ? "+" : "") + h.points + " ★",
          ),
        );
        line.appendChild(
          element("p", "", h.recipients.map((r) => r.name).join(", ")),
        );
        line.appendChild(
          button(
            "Desfazer pontos",
            () => {
              if (!confirm("Desfazer este lançamento de pontos?")) return;
              if (!canUndo(c, h)) {
                alert(
                  "Não é possível desfazer: o aluno mudou ou a pontuação excede o limite.",
                );
                return;
              }
              h.recipients.forEach((r) => {
                c.students[r.slot].points -= h.points;
              });
              h.undoneAt = new Date().toISOString();
              dirty();
              if (app.state.id === c.id) syncAll();
              renderWholeDay(date);
            },
            "small",
          ),
        );
        root.appendChild(line);
      });
  }
  $("noteText").addEventListener("input", function () {
    if (this.value.trim()) saveDiary();
  });

  function chooseDay(date) {
    if (!leaveDraft()) return;

    if (!validDay(date)) return;
    $("lessonDate").value = date;
    calendarView = new Date(date + "T12:00:00");
    diaryLessonId = null;
    loadDay();
    renderCalendar();
    $("noteDate").value = date;
    renderNotes();
  }

  window.addEventListener("beforeunload", (e) => {
    if (dayPending) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  return { leaveDraft, saveDayEdits };
}
