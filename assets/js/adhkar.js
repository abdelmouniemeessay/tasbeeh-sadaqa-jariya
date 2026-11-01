/* =========================================================
   أذكار الصباح والمساء — عدّ التكرارات وحفظ تقدم اليوم
   ========================================================= */
(function () {
  "use strict";

  const T = window.Tasbeeh;
  if (!T) return;

  const tablist = T.$(".adhkar-tabs");
  if (!tablist) return;

  const progressTitle = T.$("[data-adhkar-progress-title]");
  const progressCount = T.$("[data-adhkar-progress-count]");
  const progressBar = T.$("[data-adhkar-progressbar]");
  const progressFill = T.$("[data-adhkar-progress-fill]");
  const dateNode = T.$("[data-adhkar-date]");
  const noteNode = T.$("[data-adhkar-note]");
  const banner = T.$("[data-adhkar-banner]");
  const bannerText = T.$("[data-adhkar-banner-text]");
  const resetButton = T.$("[data-adhkar-reset]");
  const bannerReset = T.$("[data-adhkar-banner-reset]");

  const morningGrid = T.$('[data-adhkar-grid="morning"]');
  const eveningGrid = T.$('[data-adhkar-grid="evening"]');

  let model = null;
  let currentPeriod = "morning";
  let counts = {};
  let tabs = null;
  let saveErrorShown = false;

  const TYPE_LABELS = { quran: "قرآن كريم", hadith: "حديث شريف", general: "دعاء عام" };

  function periodById(id) {
    if (!model) return null;
    return model.periods.find(function (period) { return period.id === id; }) || null;
  }

  function readProgress() {
    const raw = T.storageGet(T.storageKeys.adhkar, null);
    if (!raw || typeof raw !== "object" || raw.date !== T.todayKey()) return {};
    const source = raw.counts && typeof raw.counts === "object" ? raw.counts : {};
    const clean = {};
    Object.keys(source).forEach(function (id) {
      const value = parseInt(source[id], 10);
      if (Number.isFinite(value) && value > 0) clean[id] = value;
    });
    return clean;
  }

  function saveProgress() {
    const ok = T.storageSet(T.storageKeys.adhkar, { date: T.todayKey(), counts: counts });
    if (!ok && !saveErrorShown) {
      saveErrorShown = true;
      T.toast("تعذّر حفظ تقدم الورد على هذا الجهاز. تحقق من إعدادات التخزين.", "error");
    }
    return ok;
  }

  function countFor(item) {
    return Math.min(parseInt(counts[item.id], 10) || 0, item.repeat || 1);
  }

  function isComplete(item) {
    return countFor(item) >= (item.repeat || 1);
  }

  function typeLabel(type) {
    return TYPE_LABELS[type] || TYPE_LABELS.general;
  }

  function sourceMarkup(item) {
    const url = T.safeUrl(item.sourceUrl);
    const label = T.escapeHTML(item.source || "مصدر غير محدد");
    const reference = item.reference ? " — " + T.escapeHTML(item.reference) : "";
    const link = url
      ? '<a href="' + T.escapeHTML(url) + '" target="_blank" rel="noopener">' + label + reference + " " + T.icon("external") + "</a>"
      : "<span>" + label + reference + "</span>";
    const grade = item.grade ? '<span class="badge badge--grade">' + T.escapeHTML(item.grade) + "</span>" : "";
    return link + grade;
  }

  function cardMarkup(item) {
    const count = countFor(item);
    const complete = count >= (item.repeat || 1);
    const note = item.note
      ? '<p class="dhikr-card__note">' + T.escapeHTML(item.note) + "</p>"
      : "";
    const typeBadge = '<span class="badge badge--' + T.escapeHTML(item.type) + '">' + T.escapeHTML(typeLabel(item.type)) + "</span>";

    return (
      '<article class="dhikr-card' + (complete ? " is-complete" : "") + '" id="dhikr-' + T.escapeHTML(item.id) + '" data-dhikr-id="' + T.escapeHTML(item.id) + '">' +
        '<div class="dhikr-card__top">' +
          '<h3 class="dhikr-card__title">' +
            '<span class="dhikr-card__title-text">' + T.escapeHTML(item.title) + "</span>" +
            (complete ? T.icon("check", "dhikr-check") : "") +
          "</h3>" +
          '<div class="dua-card__meta">' + typeBadge + "</div>" +
        "</div>" +
        '<p class="dhikr-card__text">' + T.escapeHTML(item.text) + "</p>" +
        note +
        '<div class="dhikr-card__source">' + sourceMarkup(item) + "</div>" +
        '<div class="dhikr-card__actions">' +
          '<button class="dhikr-counter' + (complete ? " is-complete" : "") + '" type="button" data-dhikr-count' +
            ' aria-label="' + T.escapeHTML("عدّ " + item.title + "، " + count + " من " + (item.repeat || 1)) + '">' +
            '<span class="dhikr-counter__circle" data-dhikr-circle>' + (complete ? T.icon("check") : T.formatNumber(count)) + "</span>" +
            '<span>عدّ</span>' +
            '<span class="dhikr-counter__of">من ' + T.formatNumber(item.repeat || 1) + "</span>" +
          "</button>" +
          '<div class="dhikr-card__small-actions">' +
            '<button class="btn btn--outline btn--sm" type="button" data-dhikr-complete' + (complete ? " disabled" : "") + ">" +
              T.icon("check") + "تم" +
            "</button>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-dhikr-copy>' + T.icon("copy") + "نسخ</button>" +
            '<button class="btn btn--ghost btn--sm btn--icon" type="button" data-dhikr-whatsapp aria-label="مشاركة الذكر عبر واتساب" title="واتساب">' + T.icon("whatsapp") + "</button>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function updateCard(item) {
    const card = document.getElementById("dhikr-" + item.id);
    if (!card) return;
    const count = countFor(item);
    const complete = count >= (item.repeat || 1);
    const circle = card.querySelector("[data-dhikr-circle]");
    const counter = card.querySelector("[data-dhikr-count]");
    const completeButton = card.querySelector("[data-dhikr-complete]");
    const title = card.querySelector(".dhikr-card__title");

    card.classList.toggle("is-complete", complete);
    if (counter) {
      counter.classList.toggle("is-complete", complete);
      counter.setAttribute("aria-label", "عدّ " + item.title + "، " + count + " من " + (item.repeat || 1));
    }
    if (circle) {
      if (complete) circle.innerHTML = T.icon("check");
      else circle.textContent = T.formatNumber(count);
    }
    if (completeButton) completeButton.disabled = complete;
    if (title) {
      const check = title.querySelector(".dhikr-check");
      if (complete && !check) title.insertAdjacentHTML("beforeend", T.icon("check", "dhikr-check"));
      else if (!complete && check) check.remove();
    }
  }

  function updatePeriodUi() {
    const period = periodById(currentPeriod);
    if (!period) return;
    const total = period.items.length;
    let done = 0;
    period.items.forEach(function (item) {
      if (isComplete(item)) done += 1;
    });
    const percent = total ? Math.round((done / total) * 100) : 0;
    const allDone = total > 0 && done === total;

    if (progressTitle) progressTitle.textContent = period.title;
    if (progressCount) progressCount.textContent = T.formatNumber(done) + " من " + T.formatNumber(total);
    if (progressFill) progressFill.style.width = percent + "%";
    if (progressBar) {
      progressBar.setAttribute("aria-valuenow", String(percent));
      progressBar.setAttribute("aria-valuetext", "أنجزت " + done + " من " + total + " ذكرًا");
    }
    if (noteNode) noteNode.textContent = period.note || "";
    if (banner) banner.hidden = !allDone;
    if (bannerText) {
      bannerText.textContent = allDone
        ? "أتممت " + period.title + " لهذا اليوم. تقبّل الله منك، واجعله في ميزان حسناتك."
        : "تقبّل الله منك، واجعله في ميزان حسناتك.";
    }
    if (dateNode) dateNode.textContent = formatDate();
  }

  function formatDate() {
    const now = new Date();
    try {
      return new Intl.DateTimeFormat("ar", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        calendar: "gregory"
      }).format(now);
    } catch (error) {
      return now.toLocaleDateString("ar-EG");
    }
  }

  function increment(item) {
    const before = isComplete(item);
    const next = Math.min(countFor(item) + 1, item.repeat || 1);
    counts[item.id] = next;
    saveProgress();
    updateCard(item);
    updatePeriodUi();
    if (!before && next >= (item.repeat || 1)) {
      T.toast("أتممت هذا الذكر، تقبّل الله منك.", "success");
    }
  }

  function markComplete(item) {
    if (isComplete(item)) return;
    counts[item.id] = item.repeat || 1;
    saveProgress();
    updateCard(item);
    updatePeriodUi();
    T.toast("أُكمل هذا الذكر.", "success");
  }

  function resetPeriod(periodId) {
    const period = periodById(periodId);
    if (!period) return;
    period.items.forEach(function (item) {
      delete counts[item.id];
    });
    saveProgress();
    period.items.forEach(updateCard);
    updatePeriodUi();
    T.toast("أُعيد ضبط " + period.title + " لليوم.", "info");
  }

  function bindCard(card, item) {
    const counter = card.querySelector("[data-dhikr-count]");
    const complete = card.querySelector("[data-dhikr-complete]");
    const copy = card.querySelector("[data-dhikr-copy]");
    const whatsapp = card.querySelector("[data-dhikr-whatsapp]");

    if (counter) {
      counter.addEventListener("click", function () {
        increment(item);
      });
    }

    if (complete) {
      complete.addEventListener("click", function () {
        markComplete(item);
      });
    }

    if (copy) {
      copy.addEventListener("click", async function () {
        const source = [item.source, item.reference, item.grade].filter(Boolean).join(" — ");
        const ok = await T.copyText(item.text + (source ? "\n\n" + source : ""));
        T.toast(ok ? "تم نسخ الذكر مع مصدره." : "تعذّر النسخ، جرّب تحديد النص يدويًا.", ok ? "success" : "error");
      });
    }

    if (whatsapp) {
      whatsapp.addEventListener("click", function () {
        const source = [item.source, item.reference].filter(Boolean).join(" — ");
        T.shareWhatsApp(item.title + "\n\n" + item.text + (source ? "\n\n" + source : ""), {
          path: "pages/adhkar.html",
          hash: "dhikr-" + item.id
        });
      });
    }
  }

  function renderPeriod(period, grid) {
    if (!grid) return;
    grid.innerHTML = period.items.map(cardMarkup).join("");
    grid.querySelectorAll("[data-dhikr-id]").forEach(function (card) {
      const item = period.items.find(function (entry) { return entry.id === card.dataset.dhikrId; });
      if (item) bindCard(card, item);
    });
  }

  function requestReset(periodId) {
    const period = periodById(periodId);
    if (!period) return;
    T.confirm("سيُعاد ضبط عدّاد " + period.title + " لهذا اليوم فقط. هل تريد المتابعة؟", {
      title: "إعادة ضبط الورد",
      confirmLabel: "إعادة الضبط"
    }).then(function (confirmed) {
      if (confirmed) resetPeriod(periodId);
    });
  }

  function showError() {
    const message =
      '<div class="error-state">' +
        T.icon("wifi-off") +
        "<h3>تعذّر تحميل الأذكار</h3>" +
        "<p>تأكد من فتح الموقع عبر خادم محلي أو من اتصالك بالإنترنت، ثم أعد المحاولة.</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-retry-adhkar>إعادة المحاولة</button>' +
      "</div>";
    if (morningGrid) morningGrid.innerHTML = message;
    if (eveningGrid) eveningGrid.innerHTML = "";
    const retry = morningGrid && morningGrid.querySelector("[data-retry-adhkar]");
    if (retry) retry.addEventListener("click", function () { load(); });
  }

  function init() {
    counts = readProgress();
    T.loadJSON("adhkar.json").then(function (data) {
      model = data;
      renderPeriod(periodById("morning"), morningGrid);
      renderPeriod(periodById("evening"), eveningGrid);
      tabs = T.initTabs(tablist, function (id) {
        currentPeriod = id === "evening" ? "evening" : "morning";
        updatePeriodUi();
      });
      currentPeriod = "morning";
      updatePeriodUi();
    }).catch(showError);
  }

  if (resetButton) {
    resetButton.addEventListener("click", function () {
      requestReset(currentPeriod);
    });
  }

  if (bannerReset) {
    bannerReset.addEventListener("click", function () {
      requestReset(currentPeriod);
    });
  }

  init();
})();
