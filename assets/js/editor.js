/* =========================================================
   المحرر المحلي للأدعية — تعديلات على هذا الجهاز فقط
   ========================================================= */
(function () {
  "use strict";

  const T = window.Tasbeeh;
  if (!T) return;

  const form = T.$("[data-editor-form]");
  if (!form) return;

  const listBox = T.$("[data-editor-list]");
  const searchInput = T.$("#editor-search");
  const countBadge = T.$("[data-editor-count]");
  const localCountNode = T.$("[data-editor-local-count]");
  const formTitle = T.$("[data-editor-form-title]");
  const modeBadge = T.$("[data-editor-mode]");
  const errorNode = T.$("[data-editor-error]");
  const deleteButton = T.$("[data-editor-delete]");
  const restoreButton = T.$("[data-editor-restore]");
  const saveButton = T.$("[data-editor-save]");
  const newButton = T.$("[data-editor-new]");
  const cancelButton = T.$("[data-editor-cancel]");
  const resetButton = T.$("[data-editor-reset]");
  const categorySelect = T.$("#editor-category");
  const typeSelect = T.$("#editor-type");
  const importInput = T.$("[data-editor-import-input]");
  const importButtons = T.$$("[data-editor-import]");

  let base = null;
  let merged = null;
  let currentId = null;
  let mode = "new";

  const TYPE_LABELS = { quran: "قرآن كريم", hadith: "حديث شريف", general: "دعاء عام" };

  function categoryTitle(id) {
    if (!base) return id || "دعاء";
    const category = base.categories.find(function (item) { return item.id === id; });
    return category ? category.title : (id || "دعاء");
  }

  function fillCategorySelect() {
    if (!categorySelect || !base) return;
    const current = categorySelect.value;
    categorySelect.innerHTML = base.categories.map(function (category) {
      return '<option value="' + T.escapeHTML(category.id) + '">' + T.escapeHTML(category.title) + "</option>";
    }).join("");
    if (current) categorySelect.value = current;
  }

  function ensureCategoryOption(value) {
    if (!categorySelect || !value) return;
    if (Array.from(categorySelect.options).some(function (option) { return option.value === value; })) return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    categorySelect.appendChild(option);
  }

  function setError(message) {
    if (!errorNode) return;
    errorNode.textContent = message || "";
    errorNode.hidden = !message;
  }

  function updateCounts() {
    const overlay = T.readOverlay();
    const local = overlay.added.length + Object.keys(overlay.edited).length + overlay.deleted.length;
    if (countBadge) countBadge.textContent = T.formatNumber(merged ? merged.duas.length : 0);
    if (localCountNode) {
      localCountNode.textContent = local
        ? "لديك " + T.formatNumber(local) + " تغييرًا محليًا محفوظًا."
        : "لا توجد تغييرات محلية بعد.";
    }
  }

  function itemBadges(item) {
    const badges = [];
    if (item._added) badges.push('<span class="badge badge--local">مضاف</span>');
    else if (item._edited) badges.push('<span class="badge badge--local">معدّل</span>');
    if (item.featured) badges.push('<span class="badge badge--gold">مختار</span>');
    return badges.join("");
  }

  function renderList() {
    if (!listBox || !merged) return;
    const query = T.normalizeArabic(searchInput ? searchInput.value : "");
    const list = merged.duas.filter(function (item) {
      if (!query) return true;
      return T.normalizeArabic([item.title, item.text, item.source, item.reference, categoryTitle(item.category)].join(" ")).indexOf(query) !== -1;
    });

    if (!list.length) {
      listBox.innerHTML = '<div class="editor-empty">لا توجد أدعية مطابقة. جرّب كلمة أخرى أو أضف دعاءً جديدًا.</div>';
      return;
    }

    listBox.innerHTML = list.map(function (item) {
      const badges = itemBadges(item);
      return (
        '<button class="editor-list-item' + (item.id === currentId ? " is-active" : "") + '" type="button" data-editor-item="' + T.escapeHTML(item.id) + '">' +
          "<strong>" + T.escapeHTML(item.title) + "</strong>" +
          "<span>" + T.escapeHTML(categoryTitle(item.category)) + " — " + T.escapeHTML(TYPE_LABELS[item.type] || TYPE_LABELS.general) + "</span>" +
          (badges ? '<span class="editor-list-item__badges">' + badges + "</span>" : "") +
        "</button>"
      );
    }).join("");

    listBox.querySelectorAll("[data-editor-item]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectItem(button.dataset.editorItem);
      });
    });
  }

  function updateModeUi(item) {
    if (formTitle) {
      formTitle.textContent = mode === "new"
        ? "إضافة دعاء جديد"
        : "تعديل: " + (item ? item.title : "دعاء");
    }
    if (modeBadge) {
      modeBadge.hidden = mode === "base" || mode === "new";
      modeBadge.textContent = mode === "added" ? "محلي — مضاف" : "محلي — معدّل";
    }
    if (deleteButton) deleteButton.hidden = mode === "new";
    if (restoreButton) restoreButton.hidden = mode !== "edited";
    if (saveButton) {
      const span = saveButton.querySelector("span");
      if (!span) {
        saveButton.innerHTML = T.icon("check") + "<span>" + (mode === "new" ? "حفظ الدعاء محليًا" : "حفظ التعديل محليًا") + "</span>";
      } else {
        span.textContent = mode === "new" ? "حفظ الدعاء محليًا" : "حفظ التعديل محليًا";
      }
    }
    if (deleteButton) {
      const label = deleteButton.querySelector("span");
      if (label) label.textContent = mode === "added" ? "حذف الإضافة" : "حذف الدعاء";
    }
  }

  function resetForm() {
    currentId = null;
    mode = "new";
    form.reset();
    const idField = form.elements.namedItem("id");
    if (idField) idField.value = "";
    if (categorySelect) {
      const general = base && base.categories.find(function (item) { return item.id === "general"; });
      categorySelect.value = general ? "general" : (base && base.categories[0] ? base.categories[0].id : "");
    }
    if (typeSelect) typeSelect.value = "hadith";
    const repeat = form.elements.namedItem("repeat");
    if (repeat) repeat.value = "1";
    setError("");
    updateModeUi(null);
    renderList();
  }

  function fillForm(item) {
    if (!item) return;
    const fields = ["title", "text", "source", "reference", "grade", "sourceUrl", "note"];
    fields.forEach(function (name) {
      const field = form.elements.namedItem(name);
      if (field) field.value = item[name] || "";
    });
    const idField = form.elements.namedItem("id");
    if (idField) idField.value = item.id;
    ensureCategoryOption(item.category);
    if (categorySelect) categorySelect.value = item.category || "general";
    if (typeSelect) typeSelect.value = item.type || "general";
    const repeat = form.elements.namedItem("repeat");
    if (repeat) repeat.value = String(item.repeat || 1);
    const tags = form.elements.namedItem("tags");
    if (tags) tags.value = (item.tags || []).join("، ");
    const featured = form.elements.namedItem("featured");
    if (featured) featured.checked = !!item.featured;
    setError("");
  }

  function selectItem(id) {
    if (!merged) return;
    const item = merged.duas.find(function (entry) { return entry.id === id; });
    if (!item) return;
    currentId = id;
    mode = item._added ? "added" : item._edited ? "edited" : "base";
    fillForm(item);
    updateModeUi(item);
    renderList();
    const card = T.$(".editor-form-card");
    if (card && window.innerWidth < 980) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function newItem() {
    resetForm();
    const title = form.elements.namedItem("title");
    if (title) {
      title.focus();
      if (window.innerWidth < 980) {
        const card = T.$(".editor-form-card");
        if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function readForm() {
    const elements = form.elements;
    const value = function (name) {
      const field = elements.namedItem(name);
      return field ? field.value : "";
    };
    const tags = value("tags").split(/[،,]/).map(function (tag) { return tag.trim(); }).filter(Boolean);
    return {
      title: value("title"),
      category: value("category"),
      type: value("type"),
      text: value("text"),
      source: value("source"),
      reference: value("reference"),
      grade: value("grade"),
      sourceUrl: value("sourceUrl").trim(),
      repeat: value("repeat"),
      tags: tags,
      featured: !!(elements.namedItem("featured") && elements.namedItem("featured").checked),
      note: value("note")
    };
  }

  function validate(data) {
    if (!T.sanitizeText(data.title, 160)) return { field: "title", message: "اكتب عنوانًا للدعاء." };
    if (!T.sanitizeText(data.text, 6000, { multiline: true })) return { field: "text", message: "اكتب نص الدعاء." };
    if (!T.sanitizeText(data.source, 160)) return { field: "source", message: "اذكر المصدر، ولا تنشر نصًا بلا مصدر." };
    if (data.sourceUrl && !T.safeUrl(data.sourceUrl)) return { field: "sourceUrl", message: "رابط المصدر يجب أن يبدأ بـ http:// أو https://." };
    if (data.type === "hadith" && !T.sanitizeText(data.grade, 100)) {
      return { field: "grade", message: "بيّن حكم الحديث (مثل: صحيح — الألباني) قبل الحفظ." };
    }
    if (data.type === "quran" && !T.sanitizeText(data.reference, 160)) {
      return { field: "reference", message: "اذكر اسم السورة ورقم الآية في حقل المرجع." };
    }
    return null;
  }

  function focusField(name) {
    const field = form.elements.namedItem(name);
    if (field) {
      field.focus();
      field.classList.add("is-invalid");
      setTimeout(function () { field.classList.remove("is-invalid"); }, 2600);
    }
  }

  function save(event) {
    event.preventDefault();
    if (!base) return;
    const data = readForm();
    const problem = validate(data);
    if (problem) {
      setError(problem.message);
      focusField(problem.field);
      return;
    }

    const overlay = T.readOverlay();
    const id = currentId || T.uniqueId("local-dua");
    const clean = T.sanitizeDua(data, id);

    if (!currentId) {
      overlay.added.push(clean);
    } else {
      const addedIndex = overlay.added.findIndex(function (item) { return item.id === currentId; });
      if (addedIndex >= 0) {
        overlay.added[addedIndex] = clean;
      } else {
        const patch = Object.assign({}, clean);
        delete patch.id;
        overlay.edited[currentId] = patch;
        overlay.deleted = overlay.deleted.filter(function (deletedId) { return deletedId !== currentId; });
      }
    }

    if (!T.saveOverlay(overlay)) {
      T.toast("تعذّر حفظ التعديل. تحقق من مساحة التخزين في المتصفح.", "error");
      return;
    }
    T.invalidateDuas();
    T.toast("تم حفظ التعديل على هذا الجهاز فقط. صدّره وانشره عندما تجهز.", "success");
    refresh(id);
  }

  async function removeCurrent() {
    if (!currentId || !merged) return;
    const item = merged.duas.find(function (entry) { return entry.id === currentId; });
    if (!item) return;
    const confirmed = await T.confirm(
      "سيُحذف «" + item.title + "» من نسخة هذا الجهاز فقط. لن يتأثر الموقع المنشور حتى تصدّر وتنشر.",
      { title: "حذف الدعاء محليًا", confirmLabel: "حذف" }
    );
    if (!confirmed) return;

    const overlay = T.readOverlay();
    if (item._added) {
      overlay.added = overlay.added.filter(function (entry) { return entry.id !== currentId; });
    } else {
      delete overlay.edited[currentId];
      if (overlay.deleted.indexOf(currentId) === -1) overlay.deleted.push(currentId);
    }
    if (!T.saveOverlay(overlay)) {
      T.toast("تعذّر حفظ الحذف. تحقق من مساحة التخزين.", "error");
      return;
    }
    T.invalidateDuas();
    T.toast("حُذف الدعاء محليًا. يمكنك استعادة الكل من منطقة الخطر.", "info");
    currentId = null;
    refresh();
    resetForm();
  }

  async function restoreCurrent() {
    if (!currentId) return;
    const confirmed = await T.confirm(
      "ستعود نسخة الدعاء الأصلية من ملف duas.json، وسيُلغى تعديلك المحلي عليه.",
      { title: "استعادة الأصل", confirmLabel: "استعادة", danger: false }
    );
    if (!confirmed) return;
    const overlay = T.readOverlay();
    delete overlay.edited[currentId];
    if (!T.saveOverlay(overlay)) {
      T.toast("تعذّر حفظ الاستعادة. تحقق من مساحة التخزين.", "error");
      return;
    }
    T.invalidateDuas();
    T.toast("تمت استعادة نسخة الدعاء الأصلية.", "success");
    refresh(currentId);
  }

  async function resetAll() {
    const confirmed = await T.confirm(
      "سيُحذف كل ما أضفته أو عدّلته أو حذفته محليًا، وتعود القائمة إلى ملف duas.json المنشور. لا يؤثر ذلك على الموقع المنشور.",
      { title: "حذف كل التعديلات المحلية", confirmLabel: "حذف الكل" }
    );
    if (!confirmed) return;
    if (!T.saveOverlay(T.emptyOverlay())) {
      T.toast("تعذّر حذف التعديلات. تحقق من مساحة التخزين.", "error");
      return;
    }
    T.invalidateDuas();
    currentId = null;
    refresh();
    resetForm();
    T.toast("حُذفت كل التعديلات المحلية.", "info");
  }

  function exportDuas() {
    if (!base) return;
    const data = T.applyOverlay(base);
    const output = {
      version: base.version || 1,
      updated: T.todayKey(),
      note: base.note || "",
      categories: base.categories,
      duas: data.duas.map(function (dua) { return T.sanitizeDua(dua, dua.id); })
    };
    T.downloadText(JSON.stringify(output, null, 2), "duas.json");
    T.toast("تم تصدير duas.json. استبدل به ملف data/duas.json ثم انشر الموقع.", "success");
  }

  function readImportFile(file) {
    if (typeof file.text === "function") return file.text();
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("تعذّر قراءة الملف.")); };
      reader.readAsText(file, "utf-8");
    });
  }

  function parseImport(raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error("الملف ليس JSON صالحًا. تأكد من اختيار ملف duas.json المُصدَّر من الموقع.");
    }
    if (!data || typeof data !== "object" || !Array.isArray(data.duas)) {
      throw new Error("بنية الملف غير صحيحة: يجب أن يحتوي على مصفوفة duas.");
    }
    if (data.categories !== undefined && !Array.isArray(data.categories)) {
      throw new Error("بنية التصنيفات غير صحيحة: يجب أن تكون categories مصفوفة.");
    }

    const knownCategories = new Set(base.categories.map(function (category) { return category.id; }));
    if (Array.isArray(data.categories)) {
      data.categories.forEach(function (category, index) {
        if (!category || typeof category !== "object" || !category.id || !knownCategories.has(category.id)) {
          throw new Error("التصنيف رقم " + (index + 1) + " غير معروف في الموقع. استخدم التصنيفات الأصلية فقط.");
        }
      });
    }

    const seen = new Set();
    return data.duas.map(function (entry, index) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error("العنصر رقم " + (index + 1) + " ليس دعاءً صالحًا.");
      }
      const id = T.sanitizeText(entry.id, 80);
      if (!id) throw new Error("الدعاء رقم " + (index + 1) + " بلا معرّف id.");
      if (seen.has(id)) throw new Error("المعرّف «" + id + "» مكرر داخل الملف.");
      seen.add(id);

      const clean = T.sanitizeDua(entry, id);
      if (!clean.title) throw new Error("الدعاء «" + id + "» بلا عنوان.");
      if (!clean.text) throw new Error("الدعاء «" + id + "» بلا نص.");
      if (!clean.source) throw new Error("الدعاء «" + id + "» بلا مصدر.");
      if (clean.type === "hadith" && !clean.grade) {
        throw new Error("الدعاء «" + id + "» حديث بلا حكم. أضف الحكم قبل الاستيراد.");
      }
      if (clean.type === "quran" && !clean.reference) {
        throw new Error("الدعاء «" + id + "» قرآني بلا مرجع للسورة والآية.");
      }
      if (!knownCategories.has(clean.category)) {
        throw new Error("تصنيف الدعاء «" + id + "» غير معروف: " + clean.category);
      }
      return clean;
    });
  }

  function buildImportOverlay(duas) {
    const overlay = T.emptyOverlay();
    const importedIds = new Set();
    const baseById = new Map();

    base.duas.forEach(function (dua) {
      if (!dua || !dua.id) return;
      baseById.set(dua.id, T.sanitizeDua(dua, dua.id));
    });

    duas.forEach(function (dua) {
      importedIds.add(dua.id);
      const existing = baseById.get(dua.id);
      if (!existing) {
        overlay.added.push(dua);
        return;
      }
      if (JSON.stringify(existing) !== JSON.stringify(dua)) {
        const patch = Object.assign({}, dua);
        delete patch.id;
        overlay.edited[dua.id] = patch;
      }
    });

    baseById.forEach(function (value, id) {
      if (!importedIds.has(id)) overlay.deleted.push(id);
    });

    return overlay;
  }

  async function importDuas(file) {
    if (!base || !file) return;
    try {
      const raw = await readImportFile(file);
      const imported = parseImport(raw);
      const overlay = buildImportOverlay(imported);
      const changes = overlay.added.length + Object.keys(overlay.edited).length + overlay.deleted.length;
      const confirmed = await T.confirm(
        "سيستبدل هذا الملف كل تعديلاتك المحلية الحالية. يحتوي الملف على " +
          T.formatNumber(imported.length) + " دعاء، وسيُطبَّق " + T.formatNumber(changes) +
          " تغييرًا مقارنة بنسخة الموقع المنشورة. يمكنك حذف التعديلات لاحقًا من منطقة الخطر.",
        { title: "استيراد duas.json", confirmLabel: "استيراد", danger: false }
      );
      if (!confirmed) return;
      if (!T.saveOverlay(overlay)) {
        throw new Error("تعذّر حفظ الاستيراد. تحقق من مساحة التخزين في المتصفح.");
      }
      T.invalidateDuas();
      currentId = null;
      refresh();
      resetForm();
      T.toast("تم استيراد الملف محليًا. راجع الأدعية ثم صدّرها وانشرها عند الحاجة.", "success");
    } catch (error) {
      T.toast(error && error.message ? error.message : "تعذّر استيراد الملف.", "error");
    } finally {
      if (importInput) importInput.value = "";
    }
  }

  function refresh(preferredId) {
    if (!base) return;
    merged = T.applyOverlay(base);
    updateCounts();
    renderList();
    if (preferredId) {
      const item = merged.duas.find(function (entry) { return entry.id === preferredId; });
      if (item) {
        selectItem(preferredId);
        return;
      }
    }
    if (currentId) {
      const item = merged.duas.find(function (entry) { return entry.id === currentId; });
      if (item) {
        mode = item._added ? "added" : item._edited ? "edited" : "base";
        updateModeUi(item);
        return;
      }
    }
    resetForm();
  }

  function load() {
    T.loadJSON("duas.json").then(function (data) {
      base = data;
      fillCategorySelect();
      refresh();
      resetForm();
    }).catch(function () {
      if (listBox) {
        listBox.innerHTML = '<div class="editor-empty">تعذّر تحميل ملف الأدعية. تأكد من فتح الموقع عبر خادم محلي.</div>';
      }
      T.toast("تعذّر تحميل بيانات الأدعية.", "error");
    });
  }

  form.addEventListener("submit", save);

  if (newButton) newButton.addEventListener("click", newItem);
  if (cancelButton) cancelButton.addEventListener("click", newItem);
  if (deleteButton) deleteButton.addEventListener("click", removeCurrent);
  if (restoreButton) restoreButton.addEventListener("click", restoreCurrent);
  if (resetButton) resetButton.addEventListener("click", resetAll);

  T.$$("[data-editor-export]").forEach(function (button) {
    button.addEventListener("click", exportDuas);
  });

  if (importButtons.length && importInput) {
    importButtons.forEach(function (button) {
      button.addEventListener("click", function () { importInput.click(); });
    });
    importInput.addEventListener("change", function () {
      const file = importInput.files && importInput.files[0];
      if (file) importDuas(file);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", T.debounce(renderList, 100));
  }

  form.addEventListener("input", function () {
    if (errorNode && !errorNode.hidden) setError("");
  });

  window.addEventListener("storage", function (event) {
    if (event.key === T.storageKeys.duasOverlay) refresh(currentId);
  });

  load();
})();
