/* =========================================================
   صفحة الأدعية — بحث وتصنيف ومفضلة ونسخ ومشاركة
   ========================================================= */
(function () {
  "use strict";

  const T = window.Tasbeeh;
  if (!T) return;

  const grid = T.$("[data-duas-grid]");
  if (!grid) return;

  const searchInput = T.$("#dua-search");
  const categoriesBox = T.$("[data-dua-categories]");
  const favoritesButton = T.$("[data-duas-favorites]");
  const resetButton = T.$("[data-duas-reset]");
  const countNode = T.$("[data-duas-count]");
  const totalNode = T.$("[data-duas-total]");
  const favoritesCountNode = T.$("[data-favorites-count]");
  const statusNode = T.$("[data-duas-status]");

  const view = {
    query: "",
    category: "all",
    favoritesOnly: false
  };

  let model = null;
  let loading = true;

  const TYPE_LABELS = {
    quran: "قرآن كريم",
    hadith: "حديث شريف",
    general: "دعاء عام"
  };

  function categoryTitle(id) {
    if (!model) return "";
    const category = model.categories.find(function (item) { return item.id === id; });
    return category ? category.title : "دعاء";
  }

  function typeLabel(type) {
    return TYPE_LABELS[type] || TYPE_LABELS.general;
  }

  function sourceLine(dua) {
    return [dua.source, dua.reference, dua.grade].filter(Boolean).join(" — ");
  }

  function sourceMarkup(dua) {
    const url = T.safeUrl(dua.sourceUrl);
    const label = T.escapeHTML(dua.source || "مصدر غير محدد");
    const reference = dua.reference ? " — " + T.escapeHTML(dua.reference) : "";
    const link = url
      ? '<a href="' + T.escapeHTML(url) + '" target="_blank" rel="noopener noreferrer">' + label + reference + " " + T.icon("external") + "</a>"
      : "<span>" + label + reference + "</span>";
    const grade = dua.grade ? '<span class="badge badge--grade">' + T.escapeHTML(dua.grade) + "</span>" : "";
    return link + grade;
  }

  function searchableText(dua) {
    return T.normalizeArabic(
      [
        dua.title,
        dua.text,
        dua.source,
        dua.reference,
        dua.grade,
        dua.note,
        categoryTitle(dua.category),
        (dua.tags || []).join(" ")
      ].join(" ")
    );
  }

  function matches(dua) {
    if (view.category !== "all" && dua.category !== view.category) return false;
    if (view.favoritesOnly && !T.getFavorites().has(dua.id)) return false;
    if (!view.query) return true;
    return searchableText(dua).indexOf(T.normalizeArabic(view.query)) !== -1;
  }

  function visibleDuas() {
    return model ? model.duas.filter(matches) : [];
  }

  function categoryCounts() {
    const counts = { all: model ? model.duas.length : 0 };
    if (!model) return counts;
    model.duas.forEach(function (dua) {
      counts[dua.category] = (counts[dua.category] || 0) + 1;
    });
    return counts;
  }

  function renderCategories() {
    if (!categoriesBox || !model) return;
    const counts = categoryCounts();
    const chips = [
      { id: "all", title: "الكل", count: counts.all },
      ...model.categories.map(function (category) {
        return { id: category.id, title: category.title, count: counts[category.id] || 0 };
      })
    ];

    categoriesBox.innerHTML = chips.map(function (chip) {
      const active = view.category === chip.id;
      return (
        '<button class="chip' + (active ? " is-active" : "") + '" type="button" data-category="' + T.escapeHTML(chip.id) + '"' +
        ' aria-pressed="' + (active ? "true" : "false") + '">' +
        T.escapeHTML(chip.title) +
        '<span class="chip__count">' + T.formatNumber(chip.count) + "</span>" +
        "</button>"
      );
    }).join("");

    categoriesBox.querySelectorAll("[data-category]").forEach(function (button) {
      button.addEventListener("click", function () {
        view.category = button.dataset.category || "all";
        renderCategories();
        renderResults();
      });
    });
  }

  function cardMarkup(dua) {
    const isFavorite = T.getFavorites().has(dua.id);
    const local = dua._local
      ? '<span class="badge badge--local">محلي</span>'
      : "";
    const featured = dua.featured && !dua._local
      ? '<span class="badge badge--gold">مختار</span>'
      : "";
    const note = dua.note
      ? '<details class="dua-card__note"><summary>ملاحظة</summary><p>' + T.escapeHTML(dua.note) + "</p></details>"
      : "";
    const localNote = dua._local
      ? '<p class="dua-card__local-note">' + T.icon("info") + " " + (dua._added ? "دعاء مضاف محليًا" : "تعديل محلي") + " — يظهر على هذا الجهاز فقط حتى تصدّره وتنشره.</p>"
      : "";

    return (
      '<article class="dua-card" id="' + T.escapeHTML(dua.id) + '" data-dua-id="' + T.escapeHTML(dua.id) + '">' +
        '<div class="dua-card__head">' +
          '<div class="dua-card__meta">' +
            '<span class="badge">' + T.escapeHTML(categoryTitle(dua.category)) + "</span>" +
            '<span class="badge badge--' + T.escapeHTML(dua.type) + '">' + T.escapeHTML(typeLabel(dua.type)) + "</span>" +
            featured + local +
          "</div>" +
          '<button class="btn btn--ghost btn--sm btn--icon' + (isFavorite ? " is-fav" : "") + '" type="button"' +
            ' data-fav aria-pressed="' + (isFavorite ? "true" : "false") + '"' +
            ' aria-label="' + (isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة") + '" title="المفضلة">' +
            T.icon(isFavorite ? "heart-fill" : "heart") +
          "</button>" +
        "</div>" +
        "<h2>" + T.escapeHTML(dua.title) + "</h2>" +
        '<p class="dua-card__text">' + T.escapeHTML(dua.text) + "</p>" +
        '<div class="dua-card__source">' + sourceMarkup(dua) + "</div>" +
        note +
        localNote +
        '<div class="dua-card__actions">' +
          '<button class="btn btn--primary btn--sm" type="button" data-copy>' + T.icon("copy") + "<span>نسخ</span></button>" +
          '<button class="btn btn--outline btn--sm" type="button" data-copy-source>' + T.icon("copy") + "<span>نسخ مع المصدر</span></button>" +
          '<button class="btn btn--outline btn--sm" type="button" data-whatsapp>' + T.icon("whatsapp") + "<span>واتساب</span></button>" +
          '<button class="btn btn--ghost btn--sm" type="button" data-copy-link>' + T.icon("link") + "<span>رابط الدعاء</span></button>" +
          '<button class="btn btn--ghost btn--sm btn--icon" type="button" data-qr aria-label="رمز QR للدعاء" title="رمز QR">' + T.icon("qr") + "</button>" +
        "</div>" +
      "</article>"
    );
  }

  function flashButton(button, label) {
    if (!button) return;
    const span = button.querySelector("span");
    if (!span) return;
    if (button.dataset.originalLabel == null) button.dataset.originalLabel = span.textContent;
    span.textContent = label;
    button.classList.add("is-success");
    clearTimeout(button._flashTimer);
    button._flashTimer = setTimeout(function () {
      span.textContent = button.dataset.originalLabel;
      button.classList.remove("is-success");
    }, 1800);
  }

  function bindCard(card, dua) {
    const favorite = card.querySelector("[data-fav]");
    const copy = card.querySelector("[data-copy]");
    const copySource = card.querySelector("[data-copy-source]");
    const whatsapp = card.querySelector("[data-whatsapp]");
    const copyLink = card.querySelector("[data-copy-link]");
    const qr = card.querySelector("[data-qr]");

    if (favorite) {
      favorite.addEventListener("click", function () {
        const active = T.toggleFavorite(dua.id);
        favorite.classList.toggle("is-fav", active);
        favorite.setAttribute("aria-pressed", active ? "true" : "false");
        favorite.setAttribute("aria-label", active ? "إزالة من المفضلة" : "إضافة إلى المفضلة");
        favorite.innerHTML = T.icon(active ? "heart-fill" : "heart");
        updateFavoritesCount();
        T.toast(active ? "أُضيف الدعاء إلى المفضلة." : "أُزيل الدعاء من المفضلة.", "info");
        if (view.favoritesOnly && !active) renderResults();
      });
    }

    if (copy) {
      copy.addEventListener("click", async function () {
        const ok = await T.copyText(dua.text);
        if (ok) flashButton(copy, "تم النسخ");
        T.toast(ok ? "تم نسخ الدعاء." : "تعذّر النسخ، جرّب تحديد النص يدويًا.", ok ? "success" : "error");
      });
    }

    if (copySource) {
      copySource.addEventListener("click", async function () {
        const text = [dua.text, "", sourceLine(dua), T.safeUrl(dua.sourceUrl)].filter(Boolean).join("\n");
        const ok = await T.copyText(text);
        if (ok) flashButton(copySource, "تم النسخ");
        T.toast(ok ? "تم نسخ الدعاء مع المصدر." : "تعذّر النسخ، جرّب تحديد النص يدويًا.", ok ? "success" : "error");
      });
    }

    if (whatsapp) {
      whatsapp.addEventListener("click", function () {
        T.shareWhatsApp(dua.title + "\n\n" + dua.text + "\n\n" + sourceLine(dua), {
          path: "pages/duas.html",
          hash: dua.id
        });
      });
    }

    if (copyLink) {
      copyLink.addEventListener("click", function () {
        T.copyShareLink({ path: "pages/duas.html", hash: dua.id });
      });
    }

    if (qr) {
      qr.addEventListener("click", function () {
        T.openQr({ path: "pages/duas.html", hash: dua.id });
      });
    }
  }

  function updateCounts(list) {
    const total = model ? model.duas.length : 0;
    if (countNode) countNode.textContent = T.formatNumber(list.length);
    if (totalNode) totalNode.textContent = T.formatNumber(total);
    updateFavoritesCount();
  }

  function updateFavoritesCount() {
    if (!favoritesCountNode) return;
    const count = T.getFavorites().size;
    favoritesCountNode.textContent = T.formatNumber(count);
    favoritesCountNode.hidden = count === 0;
    if (favoritesButton) {
      favoritesButton.setAttribute("aria-pressed", view.favoritesOnly ? "true" : "false");
      favoritesButton.classList.toggle("is-active", view.favoritesOnly);
    }
  }

  function statusMessage(list) {
    if (!statusNode) return;
    if (loading) {
      statusNode.textContent = "";
      return;
    }
    if (!list.length) {
      statusNode.textContent = view.favoritesOnly ? "لا توجد أدعية في المفضلة بعد." : "لا توجد نتائج مطابقة.";
      return;
    }
    const pieces = ["عرض " + T.formatNumber(list.length) + " من " + T.formatNumber(model.duas.length) + " دعاء"];
    if (view.query) pieces.push("بحثًا عن «" + view.query + "»");
    if (view.category !== "all") pieces.push("في تصنيف «" + categoryTitle(view.category) + "»");
    if (view.favoritesOnly) pieces.push("من المفضلة");
    statusNode.textContent = pieces.join(" ");
  }

  function emptyMarkup() {
    if (view.favoritesOnly) {
      return (
        '<div class="empty-state">' +
          T.icon("heart") +
          "<h3>لا توجد أدعية في المفضلة</h3>" +
          "<p>اضغط رمز القلب على أي دعاء ليظهر هنا، ويُحفظ على هذا الجهاز فقط.</p>" +
          '<button class="btn btn--primary btn--sm" type="button" data-empty-reset>عرض كل الأدعية</button>' +
        "</div>"
      );
    }
    return (
      '<div class="empty-state">' +
        T.icon("search") +
        "<h3>لا توجد نتائج مطابقة</h3>" +
        "<p>جرّب كلمة أخرى، أو امسح الفلاتر لعرض جميع الأدعية.</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-empty-reset>مسح الفلاتر</button>' +
      "</div>"
    );
  }

  function renderResults() {
    if (!model) return;
    const list = visibleDuas();
    updateCounts(list);
    statusMessage(list);

    if (!list.length) {
      grid.innerHTML = emptyMarkup();
      const reset = grid.querySelector("[data-empty-reset]");
      if (reset) {
        reset.addEventListener("click", function () {
          clearFilters();
        });
      }
      return;
    }

    grid.innerHTML = list.map(cardMarkup).join("");
    grid.querySelectorAll("[data-dua-id]").forEach(function (card) {
      const dua = list.find(function (item) { return item.id === card.dataset.duaId; });
      if (dua) bindCard(card, dua);
    });
    applyHashHighlight();
  }

  function clearFilters() {
    view.query = "";
    view.category = "all";
    view.favoritesOnly = false;
    if (searchInput) searchInput.value = "";
    renderCategories();
    renderResults();
  }

  function applyHashHighlight() {
    let hash = "";
    try {
      hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    } catch (error) {
      hash = window.location.hash.replace(/^#/, "");
    }
    if (!hash) return;
    const target = document.getElementById(hash);
    if (!target || !target.classList.contains("dua-card")) return;
    target.classList.add("is-highlighted");
    window.setTimeout(function () {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    window.setTimeout(function () {
      target.classList.remove("is-highlighted");
    }, 6000);
  }

  function handleHashChange() {
    if (!model) return;
    let hash = "";
    try {
      hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    } catch (error) {
      hash = window.location.hash.replace(/^#/, "");
    }
    if (!hash) return;
    if (!document.getElementById(hash)) {
      clearFilters();
      return;
    }
    applyHashHighlight();
  }

  function showError() {
    loading = false;
    if (statusNode) statusNode.textContent = "";
    grid.innerHTML =
      '<div class="error-state">' +
        T.icon("wifi-off") +
        "<h3>تعذّر تحميل الأدعية</h3>" +
        "<p>تأكد من فتح الموقع عبر خادم محلي أو من اتصالك بالإنترنت، ثم أعد المحاولة.</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-retry-duas>إعادة المحاولة</button>' +
      "</div>";
    const retry = grid.querySelector("[data-retry-duas]");
    if (retry) {
      retry.addEventListener("click", function () {
        loading = true;
        grid.innerHTML = '<div class="skeleton skeleton--card"></div><div class="skeleton skeleton--card"></div>';
        load();
      });
    }
  }

  function load() {
    T.loadDuas().then(function (data) {
      model = data;
      loading = false;
      renderCategories();
      renderResults();
    }).catch(showError);
  }

  if (searchInput) {
    const onSearch = T.debounce(function () {
      view.query = searchInput.value.trim();
      renderResults();
    }, 140);
    searchInput.addEventListener("input", onSearch);
    searchInput.addEventListener("search", function () {
      view.query = searchInput.value.trim();
      renderResults();
    });
  }

  if (favoritesButton) {
    favoritesButton.addEventListener("click", function () {
      view.favoritesOnly = !view.favoritesOnly;
      updateFavoritesCount();
      renderResults();
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", clearFilters);
  }

  window.addEventListener("hashchange", handleHashChange);

  load();
})();
