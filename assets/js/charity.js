/* =========================================================
   باب الخير — أفكار الصدقة الجارية وأدلتها
   ========================================================= */
(function () {
  "use strict";

  const T = window.Tasbeeh;
  if (!T) return;

  const actionsBox = T.$("[data-charity-actions]");
  if (!actionsBox) return;

  const introNode = T.$("[data-charity-intro]");
  const tipsBox = T.$("[data-charity-tips]");
  const noMoneyBox = T.$("[data-charity-nomoney]");
  const disclaimer = T.$("[data-charity-disclaimer]");

  let model = null;

  function evidenceMarkup(evidence) {
    const url = T.safeUrl(evidence.url);
    const source = T.escapeHTML(evidence.source || "مصدر غير محدد");
    const reference = evidence.reference ? " — " + T.escapeHTML(evidence.reference) : "";
    const link = url
      ? '<a href="' + T.escapeHTML(url) + '" target="_blank" rel="noopener">' + source + reference + " " + T.icon("external") + "</a>"
      : "<span>" + source + reference + "</span>";
    const grade = evidence.grade ? '<span class="badge badge--grade">' + T.escapeHTML(evidence.grade) + "</span>" : "";
    const prefix = evidence.prefix
      ? '<p class="small muted" style="margin:0 0 .35rem">' + T.escapeHTML(evidence.prefix) + "</p>"
      : "";
    return (
      '<div class="evidence' + (evidence.type === "quran" ? " evidence--quran" : "") + '">' +
        prefix +
        '<p class="evidence__text">' + T.escapeHTML(evidence.text) + "</p>" +
        '<div class="evidence__source">' + link + grade + "</div>" +
      "</div>"
    );
  }

  function actionMarkup(action) {
    const evidences = (action.evidences || []).map(evidenceMarkup).join("");
    const ideas = (action.ideas || []).map(function (idea) {
      return "<li>" + T.escapeHTML(idea) + "</li>";
    }).join("");
    const featured = action.featured ? '<span class="badge badge--gold">مقترح</span>' : "";

    return (
      '<article class="charity-card" id="charity-' + T.escapeHTML(action.id) + '" data-charity-id="' + T.escapeHTML(action.id) + '">' +
        '<div class="charity-card__head">' +
          '<div class="charity-card__icon">' + T.icon(action.icon || "spark") + "</div>" +
          "<div>" +
            "<h2>" + T.escapeHTML(action.title) + "</h2>" +
            '<p class="charity-card__summary">' + T.escapeHTML(action.summary) + "</p>" +
          "</div>" +
        "</div>" +
        (featured ? '<div class="dua-card__meta" style="margin-bottom:.4rem">' + featured + "</div>" : "") +
        (evidences ? '<div class="charity-card__evidences">' + evidences + "</div>" : "") +
        (ideas ? '<ul class="charity-card__ideas">' + ideas + "</ul>" : "") +
        '<div class="charity-card__actions">' +
          '<button class="btn btn--outline btn--sm" type="button" data-charity-copy>' + T.icon("copy") + "نسخ الأفكار</button>" +
          '<button class="btn btn--outline btn--sm" type="button" data-charity-whatsapp>' + T.icon("whatsapp") + "واتساب</button>" +
          '<button class="btn btn--ghost btn--sm btn--icon" type="button" data-charity-link aria-label="نسخ رابط الفكرة" title="نسخ الرابط">' + T.icon("link") + "</button>" +
          '<button class="btn btn--ghost btn--sm btn--icon" type="button" data-charity-qr aria-label="رمز QR للفكرة" title="رمز QR">' + T.icon("qr") + "</button>" +
        "</div>" +
      "</article>"
    );
  }

  function actionText(action) {
    const ideas = (action.ideas || []).map(function (idea) { return "• " + idea; }).join("\n");
    return action.title + "\n\n" + action.summary + (ideas ? "\n\n" + ideas : "");
  }

  function bindAction(card, action) {
    const copy = card.querySelector("[data-charity-copy]");
    const whatsapp = card.querySelector("[data-charity-whatsapp]");
    const link = card.querySelector("[data-charity-link]");
    const qr = card.querySelector("[data-charity-qr]");

    if (copy) {
      copy.addEventListener("click", async function () {
        const ok = await T.copyText(actionText(action));
        T.toast(ok ? "تم نسخ أفكار الخير." : "تعذّر النسخ، جرّب تحديد النص يدويًا.", ok ? "success" : "error");
      });
    }

    if (whatsapp) {
      whatsapp.addEventListener("click", function () {
        T.shareWhatsApp(actionText(action), {
          path: "pages/charity.html",
          hash: "charity-" + action.id
        });
      });
    }

    if (link) {
      link.addEventListener("click", function () {
        T.copyShareLink({ path: "pages/charity.html", hash: "charity-" + action.id });
      });
    }

    if (qr) {
      qr.addEventListener("click", function () {
        T.openQr({ path: "pages/charity.html", hash: "charity-" + action.id });
      });
    }
  }

  function render() {
    if (introNode) introNode.textContent = model.intro || "";
    if (disclaimer) {
      const paragraph = disclaimer.querySelector("p");
      if (paragraph) paragraph.textContent = model.disclaimer || "";
    }
    if (tipsBox) {
      tipsBox.innerHTML = (model.tips || []).map(function (tip) {
        return "<li>" + T.icon("check") + T.escapeHTML(tip) + "</li>";
      }).join("");
    }
    if (noMoneyBox) {
      noMoneyBox.innerHTML = (model.noMoney || []).map(function (item) {
        return (
          '<div class="charity-mini">' +
            "<h3>" + T.escapeHTML(item.title) + "</h3>" +
            "<p>" + T.escapeHTML(item.text) + "</p>" +
          "</div>"
        );
      }).join("");
    }

    actionsBox.innerHTML = model.actions.map(actionMarkup).join("");
    actionsBox.querySelectorAll("[data-charity-id]").forEach(function (card) {
      const action = model.actions.find(function (item) { return item.id === card.dataset.charityId; });
      if (action) bindAction(card, action);
    });
  }

  function showError() {
    actionsBox.innerHTML =
      '<div class="error-state">' +
        T.icon("wifi-off") +
        "<h3>تعذّر تحميل أبواب الخير</h3>" +
        "<p>تأكد من فتح الموقع عبر خادم محلي أو من اتصالك بالإنترنت، ثم أعد المحاولة.</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-retry-charity>إعادة المحاولة</button>' +
      "</div>";
    const retry = actionsBox.querySelector("[data-retry-charity]");
    if (retry) retry.addEventListener("click", function () { load(); });
  }

  function load() {
    actionsBox.innerHTML = '<div class="skeleton skeleton--card"></div><div class="skeleton skeleton--card"></div>';
    T.loadJSON("charity.json").then(function (data) {
      model = data;
      render();
    }).catch(showError);
  }

  load();
})();
