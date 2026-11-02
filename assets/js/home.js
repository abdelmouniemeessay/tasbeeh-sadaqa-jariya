/* =========================================================
   Home page
   ========================================================= */
(function () {
  "use strict";
  const T = window.Tasbeeh;
  if (!T) return;
  const container = T.$("#daily-dua");
  if (!container) return;

  let model = null;

  function dayIndex() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  function pickDua() {
    if (!model || !model.duas || !model.duas.length) return null;
    const featured = model.duas.filter(function (dua) { return dua.featured; });
    const pool = featured.length ? featured : model.duas;
    return pool[dayIndex() % pool.length];
  }

  function typeLabel(type) {
    if (type === "quran") return "قرآن كريم";
    if (type === "hadith") return "حديث شريف";
    return "دعاء عام";
  }

  function sourceMarkup(dua) {
    const url = T.safeUrl(dua.sourceUrl);
    const source = T.escapeHTML(dua.source || "مصدر غير محدد");
    const reference = dua.reference ? " — " + T.escapeHTML(dua.reference) : "";
    const link = url
      ? '<a href="' + T.escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">' + source + reference + " " + T.icon("external") + "</a>"
      : "<span>" + source + reference + "</span>";
    const grade = dua.grade ? '<span class="badge badge--grade">' + T.escapeHTML(dua.grade) + "</span>" : "";
    return link + grade;
  }

  function render(dua) {
    if (!dua) {
      container.innerHTML =
        '<div class="empty-state"><h3>لا يوجد دعاء متاح الآن</h3><p>جرّب تحديث الصفحة أو تصفّح صفحة الأدعية.</p><a class="btn btn--primary" href="pages/duas.html">صفحة الأدعية</a></div>';
      return;
    }
    const category = model.categories.find(function (item) { return item.id === dua.category; });
    const categoryTitle = category ? category.title : "دعاء";
    const note = dua.note
      ? '<details class="dua-card__note"><summary>ملاحظة</summary><p>' + T.escapeHTML(dua.note) + "</p></details>"
      : "";
    const local = dua._local ? '<span class="badge badge--local">محلي</span>' : "";

    container.innerHTML =
      '<article class="daily-card">' +
        '<div class="daily-card__top">' +
          '<span class="daily-card__quote">' + T.icon("quote") + " دعاء اليوم</span>" +
          '<div class="dua-card__meta">' +
            '<span class="badge">' + T.escapeHTML(categoryTitle) + "</span>" +
            '<span class="badge badge--' + (dua.type === "quran" ? "quran" : dua.type === "hadith" ? "hadith" : "general") + '">' + typeLabel(dua.type) + "</span>" +
            local +
          "</div>" +
        "</div>" +
        "<h2>" + T.escapeHTML(dua.title) + "</h2>" +
        '<p class="daily-card__text">' + T.escapeHTML(dua.text) + "</p>" +
        '<div class="daily-card__source">' + sourceMarkup(dua) + "</div>" +
        note +
        '<div class="daily-card__actions">' +
          '<button class="btn btn--primary btn--sm" type="button" data-daily-copy>' + T.icon("copy") + "نسخ الدعاء</button>" +
          '<button class="btn btn--outline btn--sm" type="button" data-daily-copy-source>' + T.icon("copy") + "نسخ مع المصدر</button>" +
          '<button class="btn btn--outline btn--sm" type="button" data-daily-whatsapp>' + T.icon("whatsapp") + "واتساب</button>" +
          '<a class="btn btn--ghost btn--sm" href="pages/duas.html#' + encodeURIComponent(dua.id) + '">كل الأدعية ' + T.icon("arrow-left") + "</a>" +
        "</div>" +
      "</article>";

    const copy = container.querySelector("[data-daily-copy]");
    const copySource = container.querySelector("[data-daily-copy-source]");
    const whatsapp = container.querySelector("[data-daily-whatsapp]");

    if (copy) {
      copy.addEventListener("click", async function () {
        const ok = await T.copyText(dua.text);
        T.toast(ok ? "تم نسخ الدعاء." : "تعذّر النسخ.", ok ? "success" : "error");
      });
    }
    if (copySource) {
      copySource.addEventListener("click", async function () {
        const source = [dua.source, dua.reference, dua.grade].filter(Boolean).join(" — ");
        const ok = await T.copyText(dua.text + "\n\n" + source);
        T.toast(ok ? "تم نسخ الدعاء مع المصدر." : "تعذّر النسخ.", ok ? "success" : "error");
      });
    }
    if (whatsapp) {
      whatsapp.addEventListener("click", function () {
        const source = [dua.source, dua.reference].filter(Boolean).join(" — ");
        T.shareWhatsApp(dua.title + "\n\n" + dua.text + "\n\n" + source, {
          path: "pages/duas.html",
          hash: dua.id
        });
      });
    }
  }

  function showError() {
    container.innerHTML =
      '<div class="error-state">' +
        T.icon("wifi-off") +
        "<h3>تعذّر تحميل دعاء اليوم</h3>" +
        "<p>تأكد من تشغيل الموقع عبر خادم محلي أو من اتصالك بالإنترنت، ثم أعد المحاولة.</p>" +
        '<button class="btn btn--primary" type="button" data-retry-daily>إعادة المحاولة</button>' +
      "</div>";
    const retry = container.querySelector("[data-retry-daily]");
    if (retry) retry.addEventListener("click", load);
  }

  function load() {
    container.innerHTML =
      '<div class="daily-card"><div class="daily-card__loading">' +
        '<div class="skeleton skeleton--line"></div>' +
        '<div class="skeleton skeleton--line"></div>' +
        '<div class="skeleton skeleton--line"></div>' +
      "</div></div>";
    T.loadDuas().then(function (data) {
      model = data;
      render(pickDua());
    }).catch(showError);
  }

  load();
})();
