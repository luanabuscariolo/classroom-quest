import { uid, copy, dayISO, validDay, dateLabel, integer } from "./utils.js";
import { emptyDiary } from "./model.js";
import { canUndo } from "./points.js";
/** Diary state is private; app getters follow class switches and restored backups. */
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
  var diaryClassId = null,
    diaryLessonId = null,
    diaryTab = "lesson",
    calendarView = new Date();

  function diaryClass() {
    return app.workspace.classes.find(function (c) {
      return c.id === diaryClassId;
    });
  }
  function committedDiaryData(c) {
    if (!c.diary) c.diary = emptyDiary();
    return c.diary;
  }
  function lesson() {
    var c = diaryClass();
    return (
      c &&
      diaryData(c).lessons.find(function (l) {
        return l.id === diaryLessonId;
      })
    );
  }

  function renderCalendar() {
    var c = diaryClass();
    if (!c) return;
    var year = calendarView.getFullYear(),
      month = calendarView.getMonth(),
      root = $("calendarGrid");
    root.textContent = "";
    $("calendarMonth").textContent = calendarView.toLocaleDateString("pt-PT", {
      month: "long",
      year: "numeric",
    });
    var offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for (var n = 0; n < offset; n++) root.appendChild(element("span"));
    var dates = diaryData(c).lessons.map(function (l) {
      return l.date;
    });
    for (var i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) {
      var date = dayISO(new Date(year, month, i));
      var b = button(
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
    var c = diaryClass();
    if (!c) return;
    var lessons = diaryData(c)
        .lessons.filter(function (l) {
          return l.date === $("lessonDate").value;
        })
        .sort(function (a, b) {
          return a.number - b.number;
        }),
      root = $("lessonSelect");
    root.textContent = "";
    if (!lessons.length) {
      var o = element("option", "", "Sem aula registada");
      o.value = "";
      root.appendChild(o);
      diaryLessonId = null;
    } else {
      lessons.forEach(function (l) {
        var o = element("option", "", "Aula " + l.number + " · " + l.teacher);
        o.value = l.id;
        root.appendChild(o);
      });
      if (
        !lessons.some(function (l) {
          return l.id === diaryLessonId;
        })
      )
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
    var c = diaryClass(),
      date = $("lessonDate").value;
    if (!c || !validDay(date)) return;
    var d = diaryData(c);
    if (d.lessons.length >= 2000) {
      alert("Limite de 2000 aulas por turma.");
      return;
    }
    if (
      d.lessons.some(function (l) {
        return l.date === date;
      }) &&
      !confirm("Já existe uma aula nesta data. Criar outra aula?")
    )
      return;
    var l = {
      id: uid(),
      date: date,
      number: Math.min(
        10000,
        1 +
          d.lessons.reduce(function (n, l) {
            return Math.max(n, l.number);
          }, 0),
      ),
      teacher: masterName(),
      summary: "",
      activities: "",
      homework: "",
      due: "",
      attendance: [],
    };
    c.students.forEach(function (s, i) {
      if (s.name)
        l.attendance.push({
          slot: i,
          name: s.name,
          status: "unmarked",
          note: "",
          delivery: "pending",
          awardId: null,
        });
    });
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
    var l = lesson();
    $("lessonPane").hidden = tab !== "lesson" || !l;
    $("homeworkPane").hidden = tab !== "homework" || !l;
    $("notesPane").hidden = tab !== "notes";
    $("lessonEmpty").hidden = !!l || tab === "notes";
    [
      ["tabLesson", "lesson"],
      ["tabHomework", "homework"],
      ["tabNotes", "notes"],
    ].forEach(function (pair) {
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
    var l = lesson();
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
    ["lessonTeacher", "teacher"],
  ].forEach(function (pair) {
    $(pair[0]).oninput = function () {
      var l = lesson();
      if (!l) return;
      l[pair[1]] = this.value;
      saveDiary();
      if (pair[1] === "homework") updateRewardButton();
    };
  });
  $("lessonNumber").onchange = function () {
    var l = lesson(),
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
    var l = lesson();
    if (!l) return;
    if (this.value && !validDay(this.value)) {
      this.value = l.due;
      return;
    }
    l.due = this.value;
    saveDiary();
  };
  function selectOptions(options, value, fn) {
    var select = element("select", "field");
    options.forEach(function (pair) {
      var o = element("option", "", pair[1]);
      o.value = pair[0];
      select.appendChild(o);
    });
    select.value = value;
    select.onchange = fn;
    return select;
  }
  var attendanceLabels = {
      unmarked: "Por marcar",
      present: "Presente",
      absent: "Falta",
      late: "Atraso",
    },
    deliveryLabels = {
      pending: "Por verificar",
      delivered: "Entregue",
      missing: "Não entregue",
      excused: "Dispensado",
    };
  function attendanceCounts() {
    var l = lesson();
    if (!l) return;
    $("attendanceCount").textContent = Object.keys(attendanceLabels)
      .map(function (k) {
        return (
          attendanceLabels[k] +
          ": " +
          l.attendance.filter(function (r) {
            return r.status === k;
          }).length
        );
      })
      .join(" · ");
  }
  function renderAttendance() {
    var l = lesson(),
      root = $("attendanceList");
    root.textContent = "";
    l.attendance.forEach(function (r) {
      var row = element("div", "attendance-row"),
        select = selectOptions(
          Object.entries(attendanceLabels),
          r.status,
          function () {
            r.status = this.value;
            saveDiary();
            attendanceCounts();
          },
        );
      select.dataset.attendance = r.slot;
      select.setAttribute("aria-label", "Presença de " + r.name);
      var note = element("input", "field");
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
    var l = lesson();
    if (!l) return;
    var marked = l.attendance.some(function (r) {
      return r.status === "absent" || r.status === "late";
    });
    if (
      marked &&
      !confirm("Substituir também as faltas e os atrasos já marcados?")
    )
      return;
    l.attendance.forEach(function (r) {
      r.status = "present";
    });
    saveDiary();
    renderAttendance();
  };
  function wasRewarded(c, r) {
    return (
      !!r.awardId &&
      c.history.some(function (h) {
        return h.id === r.awardId && !h.undoneAt;
      })
    );
  }
  function rewardable() {
    var c = diaryClass(),
      l = lesson();
    return c && l
      ? l.attendance.filter(function (r) {
          return (
            r.delivery === "delivered" &&
            !wasRewarded(c, r) &&
            c.students[r.slot].name === r.name
          );
        })
      : [];
  }
  function updateRewardButton() {
    var l = lesson(),
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
    var c = diaryClass(),
      l = lesson(),
      root = $("homeworkList");
    root.textContent = "";
    l.attendance.forEach(function (r) {
      var row = element("div", "attendance-row"),
        select = selectOptions(
          Object.entries(deliveryLabels),
          r.delivery,
          function () {
            r.delivery = this.value;
            saveDiary();
            renderHomework();
          },
        );
      select.dataset.delivery = r.slot;
      select.setAttribute("aria-label", "Entrega de " + r.name);
      var info = wasRewarded(c, r)
        ? "✓ Pontos atribuídos"
        : c.students[r.slot].name !== r.name
          ? "Nome alterado na turma; pontos bloqueados"
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
    var c = diaryClass(),
      l = lesson(),
      rows = rewardable(),
      points = Number($("homeworkPoints").value);
    if (!l || !l.homework.trim() || !rows.length || !integer(points, 1, 1000))
      return;
    if (
      c.history.length >= 10000 ||
      rows.some(function (r) {
        return !Number.isSafeInteger(c.students[r.slot].points + points);
      })
    ) {
      alert("Não é possível adicionar este lançamento.");
      return;
    }
    var event = {
      id: uid(),
      title: ("TPC · " + dateLabel(l.date) + " · " + l.homework).slice(0, 100),
      date: new Date().toISOString(),
      points: points,
      recipients: rows.map(function (r) {
        return { slot: r.slot, name: r.name };
      }),
      undoneAt: null,
    };
    c.history.push(event);
    rows.forEach(function (r) {
      c.students[r.slot].points += points;
      r.awardId = event.id;
    });
    saveDiary();
    if (app.state.id === c.id) syncAll();
    renderHomework();
    $("homeworkFeedback").textContent =
      "✓ " +
      rows.length +
      " entregas premiadas. Podes desfazer no Histórico de atividades.";
    playSound("point");
  }
  function fillNoteTargets() {
    var c = diaryClass(),
      root = $("noteTarget");
    root.textContent = "";
    var o = element("option", "", "Turma · notas gerais");
    o.value = "class";
    root.appendChild(o);
    c.students.forEach(function (s, i) {
      if (s.name) {
        var o = element("option", "", s.name);
        o.value = i;
        root.appendChild(o);
      }
    });
    var previousSlots = new Set(
      c.students.map(function (s, i) {
        return s.name ? i : -1;
      }),
    );
    diaryData(c).notes.forEach(function (n) {
      if (n.slot !== null && !previousSlots.has(n.slot)) {
        var o = element("option", "", n.name + " · registo anterior");
        o.value = n.slot;
        root.appendChild(o);
        previousSlots.add(n.slot);
      }
    });
    renderNotes();
  }
  $("noteTarget").onchange = renderNotes;
  function renderNotes() {
    var c = diaryClass();
    if (!c) return;
    var target = $("noteTarget").value,
      slot = target === "class" ? null : Number(target),
      root = $("notesList");
    root.textContent = "";
    var notes = diaryData(c)
      .notes.filter(function (n) {
        return n.slot === slot;
      })
      .slice()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
    notes.forEach(function (n) {
      var box = element("article", "private-note");
      box.appendChild(
        element(
          "small",
          "",
          dateLabel(n.date) + " · " + (n.slot === null ? "Turma" : n.name),
        ),
      );
      var text = element("textarea", "field");
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
          function () {
            if (!confirm("Eliminar esta anotação?")) return;
            diaryData(c).notes = diaryData(c).notes.filter(function (x) {
              return x.id !== n.id;
            });
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
    var c = diaryClass(),
      text = $("noteText").value.trim(),
      date = $("noteDate").value;
    if (!c || !text || !validDay(date)) return;
    if (diaryData(c).notes.length >= 10000) {
      alert("Limite de notas atingido.");
      return;
    }
    var target = $("noteTarget").value,
      slot = target === "class" ? null : Number(target);
    diaryData(c).notes.push({
      id: uid(),
      date: date,
      text: text.slice(0, 6000),
      slot: slot,
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
      navigator.clipboard.writeText(text).then(function () {
        $("diaryFeedback").textContent = "✓ Texto copiado.";
      }, fallback);
    else fallback();
  }
  $("copySummary").onclick = function () {
    var l = lesson();
    if (l) copyForSchool(l.summary);
  };
  $("copyHomework").onclick = function () {
    var l = lesson();
    if (l)
      copyForSchool(
        l.homework + (l.due ? "\nEntrega: " + dateLabel(l.due) : ""),
      );
  };
  function lessonReport(privateNotes) {
    var c = diaryClass(),
      l = lesson();
    if (!l) return "";
    var lines = [
      "TIC QUEST · REGISTO DA AULA",
      "Turma: " + c.className,
      "Data: " + dateLabel(l.date),
      "Aula: " + l.number,
      "Professor: " + l.teacher,
      "",
      "SUMÁRIO",
      l.summary,
      "",
      "ATIVIDADES",
      l.activities,
      "",
      "TRABALHO DE CASA",
      l.homework,
      "Prazo: " + (l.due ? dateLabel(l.due) : "—"),
      "",
      "PRESENÇAS E ENTREGAS",
    ];
    l.attendance.forEach(function (r) {
      lines.push(
        r.name +
          " · " +
          attendanceLabels[r.status] +
          " · TPC: " +
          deliveryLabels[r.delivery],
      );
      if (privateNotes && r.note) lines.push("  Observação privada: " + r.note);
    });
    if (privateNotes) {
      lines.push("", "NOTAS PRIVADAS DA DATA");
      diaryData(c)
        .notes.filter(function (n) {
          return n.date === l.date;
        })
        .forEach(function (n) {
          lines.push((n.slot === null ? "Turma" : n.name) + ": " + n.text);
        });
    }
    return lines.join("\n");
  }
  $("exportLesson").onclick = function () {
    var l = lesson();
    if (!l) return;
    var text = lessonReport($("exportPrivate").checked),
      blob = new Blob([text], { type: "text/plain;charset=utf-8" }),
      url = URL.createObjectURL(blob),
      a = element("a");
    a.href = url;
    a.download = "TIC_Aula_" + l.date + "_" + l.number + ".txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 30000);
  };
  // Presentation receives only the visible game DOM, never the workspace or diary.
  var dayDraft = null,
    dayDraftClass = null,
    dayPending = false,
    dayMode = "home";
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
    var c = diaryClass();
    dayDraft = c ? copy(committedDiaryData(c)) : null;
    dayDraftClass = c ? c.id : null;
    dayPending = false;
    $("saveDiaryDay").disabled = true;
  }
  function saveDayEdits() {
    var c = diaryClass();
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
  function dayDates(c) {
    var d = diaryData(c),
      set = new Set();
    d.lessons.forEach(function (l) {
      set.add(l.date);
    });
    d.notes.forEach(function (n) {
      set.add(n.date);
    });
    c.history.forEach(function (h) {
      set.add(dayISO(new Date(h.date)));
    });
    return Array.from(set).sort().reverse();
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
    var options = $("diaryClass");
    options.textContent = "";
    app.workspace.classes.forEach(function (c) {
      var o = element(
        "option",
        "",
        c.className + (c.archived ? " · arquivada" : ""),
      );
      o.value = c.id;
      options.appendChild(o);
    });
    diaryClassId = app.workspace.classes.some(function (c) {
      return c.id === app.workspace.activeClassId;
    })
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
    var next = this.value;
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
    var date = $("dailyDate").value;
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
    var c = diaryClass(),
      root = $("dailyHistoryList");
    root.textContent = "";
    if (!c) return;
    var dates = dayDates(c),
      filter = $("historyDateFilter").value;
    if (filter)
      dates = dates.filter(function (d) {
        return d === filter;
      });
    if (!dates.length) {
      root.appendChild(element("p", "", "Sem registos nesta data."));
      return;
    }
    dates.forEach(function (date) {
      var d = diaryData(c),
        lessons = d.lessons.filter(function (l) {
          return l.date === date;
        }),
        notes = d.notes.filter(function (n) {
          return n.date === date;
        }),
        events = c.history.filter(function (h) {
          return dayISO(new Date(h.date)) === date;
        }),
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
          function () {
            renderWholeDay(date);
          },
          "mint",
        ),
      );
      card.appendChild(
        button(
          "Editar anotações",
          function () {
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
    var d = diaryData(c),
      lines = ["REGISTO DIÁRIO · " + c.className, dateLabel(date), ""];
    d.lessons
      .filter(function (l) {
        return l.date === date;
      })
      .sort(function (a, b) {
        return a.number - b.number;
      })
      .forEach(function (l) {
        lines.push(
          "AULA " + l.number + " · " + l.teacher,
          "SUMÁRIO",
          l.summary || "—",
          "ATIVIDADES REALIZADAS",
          l.activities || "—",
          "PRESENÇAS",
        );
        l.attendance.forEach(function (r) {
          lines.push(
            r.name +
              ": " +
              attendanceLabels[r.status] +
              (r.note ? " · " + r.note : ""),
          );
        });
        lines.push(
          "TPC",
          l.homework || "—",
          "Prazo: " + (l.due ? dateLabel(l.due) : "—"),
        );
        if (l.homework)
          l.attendance.forEach(function (r) {
            lines.push(r.name + ": " + deliveryLabels[r.delivery]);
          });
        lines.push("");
      });
    lines.push("NOTAS GERAIS");
    var general = d.notes.filter(function (n) {
      return n.date === date && n.slot === null;
    });
    lines.push(
      general
        .map(function (n) {
          return n.text;
        })
        .join("\n") || "—",
    );
    lines.push("", "NOTAS POR ALUNO");
    var individual = d.notes.filter(function (n) {
      return n.date === date && n.slot !== null;
    });
    lines.push(
      individual
        .map(function (n) {
          return n.name + ": " + n.text;
        })
        .join("\n") || "—",
    );
    lines.push("", "PONTOS / ATIVIDADES");
    var events = c.history.filter(function (h) {
      return dayISO(new Date(h.date)) === date;
    });
    lines.push(
      events
        .map(function (h) {
          return (
            (h.undoneAt ? "[ANULADO] " : "") +
            h.title +
            " · " +
            (h.points > 0 ? "+" : "") +
            h.points +
            " · " +
            h.recipients
              .map(function (r) {
                return r.name;
              })
              .join(", ")
          );
        })
        .join("\n") || "—",
    );
    return lines.join("\n");
  }
  var reportDay = null;

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
    var text = dailyPlainText(diaryClass(), reportDay),
      a = element("a"),
      url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
      );
    a.href = url;
    a.download = "TIC_Dia_" + reportDay + ".txt";
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 30000);
  };
  // The points tool stays quick; its history routes to the same daily record.
  $("historyTab").textContent = "Histórico por dia";
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

    var c = diaryClass(),
      root = $("dailyPointEvents");
    root.textContent = "";
    c.history
      .filter(function (h) {
        return dayISO(new Date(h.date)) === date && !h.undoneAt;
      })
      .forEach(function (h) {
        var line = element("div", "daily-card");
        line.appendChild(
          element(
            "strong",
            "",
            h.title + " · " + (h.points > 0 ? "+" : "") + h.points + " ★",
          ),
        );
        line.appendChild(
          element(
            "p",
            "",
            h.recipients
              .map(function (r) {
                return r.name;
              })
              .join(", "),
          ),
        );
        line.appendChild(
          button(
            "Desfazer pontos",
            function () {
              if (!confirm("Desfazer este lançamento de pontos?")) return;
              if (!canUndo(c, h)) {
                alert(
                  "Não é possível desfazer: o aluno mudou ou a pontuação excede o limite.",
                );
                return;
              }
              h.recipients.forEach(function (r) {
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
  $("activitiesTitle").textContent = "★ ATRIBUIR PONTOS";

  window.addEventListener("beforeunload", function (e) {
    if (dayPending) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  return { leaveDraft, saveDayEdits };
}
