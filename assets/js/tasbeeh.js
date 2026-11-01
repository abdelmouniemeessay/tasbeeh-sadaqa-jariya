/* =========================================================
   Tasbeeh counter
   ========================================================= */
(function () {
  "use strict";
  const T = window.Tasbeeh;
  if (!T) return;
  const widgets = T.$$("[data-tasbeeh-widget]");
  if (!widgets.length) return;

  const KEY = T.storageKeys.tasbeeh;
  const CIRCUMFERENCE = 2 * Math.PI * 45;
  let data = null;
  let dataPromise = null;
  const celebrated = new Set();

  function defaultState() {
    return {
      counts: {},
      totals: {},
      targets: {},
      selected: "subhanallah",
      haptics: true,
      custom: { text: "", target: 33 }
    };
  }

  function readState() {
    const raw = T.storageGet(KEY, null);
    const state = defaultState();
    if (!raw || typeof raw !== "object") return state;
    if (raw.counts && typeof raw.counts === "object") state.counts = raw.counts;
    if (raw.totals && typeof raw.totals === "object") state.totals = raw.totals;
    if (raw.targets && typeof raw.targets === "object") state.targets = raw.targets;
    if (typeof raw.selected === "string") state.selected = raw.selected;
    if (typeof raw.haptics === "boolean") state.haptics = raw.haptics;
    if (raw.custom && typeof raw.custom === "object") {
      state.custom.text = T.sanitizeText(raw.custom.text, 80);
      state.custom.target = Math.max(1, Math.min(100000, parseInt(raw.custom.target, 10) || 33));
    }
    return state;
  }

  let counter = readState();

  function saveState() {
    if (!T.storageSet(KEY, counter)) {
      T.toast("تعذّر حفظ عدّاد التسبيح على هذا الجهاز.", "error");
    }
  }

  function customPhrase() {
    if (!counter.custom.text) return null;
    return {
      id: "custom",
      text: counter.custom.text,
      label: counter.custom.text,
      target: counter.custom.target,
      evidences: [],
      custom: true
    };
  }

  function phrases() {
    const list = (data && data.phrases ? data.phrases : []).slice();
    const custom = customPhrase();
    if (custom) list.push(custom);
    return list;
  }

  function selectedPhrase() {
    const list = phrases();
    let found = list.find(function (phrase) { return phrase.id === counter.selected; });
    if (!found) {
      found = list[0];
      if (found) counter.selected = found.id;
    }
    return found;
  }

  function targetFor(phrase) {
    if (!phrase) return 1;
    const stored = parseInt(counter.targets[phrase.id], 10);
    if (Number.isFinite(stored) && stored > 0) return stored;
    return phrase.target || 33;
  }

  function countFor(id) {
    return Math.max(0, parseInt(counter.counts[id], 10) || 0);
  }

  function totalFor(id) {
    return Math.max(0, parseInt(counter.totals[id], 10) || 0);
  }

  function ringSvg(progress, extraClass) {
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));
    return (
      '<svg class="tasbeeh-ring ' + (extraClass || "") + '" viewBox="0 0 100 100" aria-hidden="true">' +
        '<circle class="ring-track" cx="50" cy="50" r="45"></circle>' +
        '<circle class="ring-progress" cx="50" cy="50" r="45" stroke-dasharray="' + CIRCUMFERENCE.toFixed(3) + '" stroke-dashoffset="' + offset.toFixed(3) + '"></circle>' +
      "</svg>"
    );
  }

  function phraseChips(activeId) {
    return phrases().map(function (phrase) {
      return (
        '<button class="phrase-chip' + (phrase.id === activeId ? " is-active" : "") + '" type="button" data-tasbeeh-select="' + T.escapeHTML(phrase.id) + '" aria-pressed="' + (phrase.id === activeId ? "true" : "false") + '">' +
          T.escapeHTML(phrase.label) +
        "</button>"
      );
    }).join("");
  }

  function targetRow(phrase, target) {
    const options = [33, 34, 99, 100, 1000];
    return (
      '<div class="target-row">' +
        '<span class="target-row__label">الهدف:</span>' +
        options.map(function (value) {
          return '<button class="target-chip' + (value === target ? " is-active" : "") + '" type="button" data-tasbeeh-target="' + value + '" aria-pressed="' + (value === target ? "true" : "false") + '">' + value + "</button>";
        }).join("") +
        '<span class="target-row__label">' + T.formatNumber(target) + " مرة</span>" +
      "</div>"
    );
  }

  function renderCompact(app) {
    const phrase = selectedPhrase();
    if (!phrase) {
      app.innerHTML = '<div class="empty-state"><p>لا توجد أذكار متاحة.</p></div>';
      return;
    }
    const count = countFor(phrase.id);
    const target = targetFor(phrase);
    const progress = target ? count / target : 0;
    app.innerHTML =
      '<div class="quick-counter__ring">' + ringSvg(progress) + "</div>" +
      '<p class="quick-counter__phrase">' + T.escapeHTML(phrase.text) + "</p>" +
      '<div class="quick-counter__count" aria-live="polite">' + T.formatNumber(count) + "</div>" +
      '<p class="quick-counter__target">' + T.formatNumber(count) + " من " + T.formatNumber(target) + " · الإجمالي " + T.formatNumber(totalFor(phrase.id)) + "</p>" +
      '<button class="btn btn--gold btn--lg" type="button" data-tasbeeh-tap aria-label="عدّ ' + T.escapeHTML(phrase.label) + '">' + T.icon("plus") + "سبّح</button>" +
      '<div class="phrase-selector">' + phraseChips(phrase.id) + "</div>" +
      '<div class="cluster" style="justify-content:center">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-tasbeeh-reset>' + T.icon("reset") + "إعادة الضبط</button>" +
        '<span class="tiny" style="color:rgba(247,242,231,.5)">يُحفظ تلقائيًا</span>' +
      "</div>";
  }

  function renderFull(widget, app, phrasesElement) {
    const phrase = selectedPhrase();
    if (!phrase) {
      app.innerHTML = '<div class="empty-state"><p>لا توجد أذكار متاحة.</p></div>';
      return;
    }
    const count = countFor(phrase.id);
    const target = targetFor(phrase);
    const progress = target ? count / target : 0;
    const complete = count >= target;
    if (phrasesElement) {
      phrasesElement.innerHTML = phraseChips(phrase.id);
    }
    app.innerHTML =
      '<button class="count-button' + (complete ? " is-complete" : "") + '" type="button" data-tasbeeh-tap aria-label="عدّ ' + T.escapeHTML(phrase.label) + '">' +
        ringSvg(progress) +
        '<span class="count-button__center">' +
          '<span class="count-button__phrase">' + T.escapeHTML(phrase.text) + "</span>" +
          '<span class="count-button__count" aria-live="polite">' + T.formatNumber(count) + "</span>" +
          '<span class="count-button__target">' + T.formatNumber(count) + " من " + T.formatNumber(target) + "</span>" +
          '<span class="count-button__hint">اضغط في أي مكان للعدّ</span>' +
        "</span>" +
      "</button>" +
      '<div class="tasbeeh-actions">' +
        '<button class="btn btn--outline btn--sm" type="button" data-tasbeeh-reset>' + T.icon("reset") + "إعادة الضبط</button>" +
        '<button class="btn btn--outline btn--sm" type="button" data-tasbeeh-focus-custom>' + T.icon("edit") + "ذكر مخصص</button>" +
      "</div>" +
      targetRow(phrase, target);

    const stats = widget.querySelector("[data-tasbeeh-stats]");
    if (stats) {
      stats.innerHTML =
        '<div class="tasbeeh-stat"><strong>' + T.formatNumber(count) + "</strong><span>الجلسة</span></div>" +
        '<div class="tasbeeh-stat"><strong>' + T.formatNumber(totalFor(phrase.id)) + "</strong><span>الإجمالي</span></div>";
    }
  }

  function renderHaptics(widget) {
    const haptics = widget.querySelector("[data-tasbeeh-haptics]");
    if (!haptics) return;
    haptics.innerHTML =
      '<label class="switch"><input type="checkbox" data-tasbeeh-haptics-input' + (counter.haptics ? " checked" : "") + '><span class="switch__track"></span><span class="sr-only">تشغيل الاهتزاز عند العدّ</span></label>';
  }

  function renderCustom(widget) {
    const box = widget.querySelector("[data-tasbeeh-custom]");
    if (!box) return;
    box.innerHTML =
      '<form class="custom-form" data-tasbeeh-custom-form novalidate>' +
        '<div class="form-row">' +
          '<div class="field">' +
            '<label for="custom-dhikr">الذكر المخصص</label>' +
            '<input class="input" id="custom-dhikr" name="customText" type="text" maxlength="80" placeholder="اكتب ذكرًا مشروعًا" value="' + T.escapeHTML(counter.custom.text) + '">' +
          "</div>" +
          '<div class="field">' +
            '<label for="custom-target">الهدف</label>' +
            '<input class="input" id="custom-target" name="customTarget" type="number" min="1" max="100000" inputmode="numeric" value="' + counter.custom.target + '">' +
          "</div>" +
        "</div>" +
        '<button class="btn btn--soft btn--sm" type="submit">حفظ الذكر المخصص</button>' +
        '<p class="field__error" data-custom-error hidden></p>' +
      "</form>";
  }

  function renderVirtues(widget) {
    const box = widget.querySelector("[data-tasbeeh-virtues]");
    if (!box || !data || !Array.isArray(data.virtues)) return;
    box.innerHTML = data.virtues.map(function (virtue) {
      const url = T.safeUrl(virtue.url);
      const source = T.escapeHTML(virtue.source || "");
      const reference = virtue.reference ? " — " + T.escapeHTML(virtue.reference) : "";
      const link = url
        ? '<a href="' + T.escapeHTML(url) + '" target="_blank" rel="noopener">' + source + reference + " " + T.icon("external") + "</a>"
        : "<span>" + source + reference + "</span>";
      return (
        '<article class="virtue-card">' +
          '<p class="virtue-card__text">' + T.escapeHTML(virtue.text) + "</p>" +
          '<div class="virtue-card__source">' + link + (virtue.grade ? '<span class="badge badge--grade">' + T.escapeHTML(virtue.grade) + "</span>" : "") + "</div>" +
        "</article>"
      );
    }).join("");
  }

  function renderAll() {
    widgets.forEach(function (widget) {
      const mode = widget.dataset.mode || "full";
      const app = widget.querySelector("[data-tasbeeh-app]");
      if (!app) return;
      if (mode === "compact") {
        renderCompact(app);
      } else {
        renderFull(widget, app, widget.querySelector("[data-tasbeeh-phrases]"));
        if (widget.dataset.staticRendered !== "true") {
          renderCustom(widget);
          renderVirtues(widget);
          renderHaptics(widget);
          widget.dataset.staticRendered = "true";
        }
      }
    });
  }

  function vibrate(pattern) {
    if (!counter.haptics) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (error) { /* ignore */ }
    }
  }

  function handleTap(widget) {
    const phrase = selectedPhrase();
    if (!phrase) return;
    const target = targetFor(phrase);
    const before = countFor(phrase.id);
    counter.counts[phrase.id] = before + 1;
    counter.totals[phrase.id] = totalFor(phrase.id) + 1;
    saveState();
    const after = counter.counts[phrase.id];
    const reachedTarget = before < target && after >= target;
    renderAll();
    if (reachedTarget) {
      const key = phrase.id + ":" + target;
      if (!celebrated.has(key)) {
        celebrated.add(key);
        vibrate([30, 40, 30]);
        T.toast("بلغت الهدف — تقبّل الله ذكرك.", "success", { duration: 3000 });
        const button = widget.querySelector(".count-button");
        if (button) {
          button.classList.add("is-celebrating");
          setTimeout(function () { button.classList.remove("is-celebrating"); }, 800);
        }
      }
    } else {
      vibrate(12);
    }
  }

  async function handleReset(widget) {
    const phrase = selectedPhrase();
    if (!phrase) return;
    const ok = await T.confirm("هل تريد إعادة ضبط عدّاد «" + phrase.label + "»؟ سيبقى الإجمالي محفوظًا.", {
      title: "إعادة ضبط العدّاد",
      confirmLabel: "إعادة الضبط"
    });
    if (!ok) return;
    counter.counts[phrase.id] = 0;
    saveState();
    celebrated.delete(phrase.id + ":" + targetFor(phrase));
    renderAll();
    T.toast("تمت إعادة ضبط العدّاد.", "info");
  }

  function handleTarget(widget, target) {
    const phrase = selectedPhrase();
    if (!phrase) return;
    const value = Math.max(1, Math.min(100000, parseInt(target, 10) || 33));
    counter.targets[phrase.id] = value;
    saveState();
    renderAll();
  }

  function handleCustomSubmit(widget, form) {
    const text = T.sanitizeText(form.querySelector('[name="customText"]').value, 80);
    const target = Math.max(1, Math.min(100000, parseInt(form.querySelector('[name="customTarget"]').value, 10) || 33));
    const error = form.querySelector("[data-custom-error]");
    if (!text) {
      if (error) {
        error.hidden = false;
        error.textContent = "اكتب ذكرًا مخصصًا أولًا.";
      }
      form.querySelector('[name="customText"]').focus();
      return;
    }
    if (counter.custom.text && counter.custom.text !== text) {
      counter.counts.custom = 0;
      counter.totals.custom = 0;
    }
    counter.custom.text = text;
    counter.custom.target = target;
    counter.targets.custom = target;
    counter.selected = "custom";
    saveState();
    renderAll();
    T.toast("تم حفظ الذكر المخصص.", "success");
  }

  function bindWidget(widget) {
    if (widget.dataset.bound === "true") return;
    widget.dataset.bound = "true";
    widget.addEventListener("click", function (event) {
      const tap = event.target.closest("[data-tasbeeh-tap]");
      if (tap) {
        event.preventDefault();
        handleTap(widget);
        return;
      }
      const reset = event.target.closest("[data-tasbeeh-reset]");
      if (reset) {
        event.preventDefault();
        handleReset(widget);
        return;
      }
      const select = event.target.closest("[data-tasbeeh-select]");
      if (select) {
        event.preventDefault();
        counter.selected = select.dataset.tasbeehSelect;
        saveState();
        renderAll();
        return;
      }
      const target = event.target.closest("[data-tasbeeh-target]");
      if (target) {
        event.preventDefault();
        handleTarget(widget, target.dataset.tasbeehTarget);
        return;
      }
      const focusCustom = event.target.closest("[data-tasbeeh-focus-custom]");
      if (focusCustom) {
        event.preventDefault();
        const input = widget.querySelector('[name="customText"]');
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    });
    widget.addEventListener("change", function (event) {
      if (event.target.matches("[data-tasbeeh-haptics-input]")) {
        counter.haptics = !!event.target.checked;
        saveState();
        T.toast(counter.haptics ? "تم تشغيل الاهتزاز." : "تم إيقاف الاهتزاز.", "info");
      }
    });
    widget.addEventListener("submit", function (event) {
      if (event.target.matches("[data-tasbeeh-custom-form]")) {
        event.preventDefault();
        handleCustomSubmit(widget, event.target);
      }
    });
  }

  function showLoading() {
    widgets.forEach(function (widget) {
      const app = widget.querySelector("[data-tasbeeh-app]");
      if (app) {
        app.innerHTML =
          '<div class="loading-state"><span class="spinner" aria-hidden="true"></span><p>جارٍ تجهيز المسبحة…</p></div>';
      }
    });
  }

  function showError() {
    widgets.forEach(function (widget) {
      const app = widget.querySelector("[data-tasbeeh-app]");
      if (app) {
        app.innerHTML =
          '<div class="error-state">' + T.icon("wifi-off") + "<h3>تعذّر تحميل الأذكار</h3><p>تحقق من الاتصال أو شغّل الموقع عبر خادم محلي.</p><button class=\"btn btn--primary\" type=\"button\" data-tasbeeh-retry>إعادة المحاولة</button></div>";
      }
    });
    widgets.forEach(function (widget) {
      const retry = widget.querySelector("[data-tasbeeh-retry]");
      if (retry) {
        retry.addEventListener("click", function () {
          dataPromise = null;
          initData();
        }, { once: true });
      }
    });
  }

  function initData() {
    showLoading();
    dataPromise = T.loadJSON("tasbeeh.json").then(function (payload) {
      data = payload;
      renderAll();
    }).catch(function () {
      dataPromise = null;
      showError();
    });
  }

  widgets.forEach(bindWidget);
  initData();
})();
