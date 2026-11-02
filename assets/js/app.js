/* =========================================================
   تسبيح — صدقة جارية
   Shared application core
   ========================================================= */
(function () {
  "use strict";

  const T = (window.Tasbeeh = window.Tasbeeh || {});
  const doc = document;
  const root = (doc.body && doc.body.dataset.root) || "./";

  const STORAGE = {
    theme: "tasbeeh.theme.v1",
    personalization: "tasbeeh.personalization.v1",
    publicUrl: "tasbeeh.publicUrl.v1",
    duasOverlay: "tasbeeh.duas.overlay.v1",
    favorites: "tasbeeh.duas.favorites.v1",
    tasbeeh: "tasbeeh.tasbeeh.v1",
    adhkar: "tasbeeh.adhkar.v1",
    installDismissed: "tasbeeh.install.dismissed.v1"
  };

  const REL_OPTIONS = [
    { value: "", label: "بدون صفة محددة" },
    { value: "father", label: "أبي" },
    { value: "mother", label: "أمي" },
    { value: "grandfather", label: "جدي" },
    { value: "grandmother", label: "جدتي" },
    { value: "husband", label: "زوجي" },
    { value: "wife", label: "زوجتي" },
    { value: "son", label: "ابني" },
    { value: "daughter", label: "ابنتي" },
    { value: "brother", label: "أخي" },
    { value: "sister", label: "أختي" },
    { value: "uncle-p", label: "عمي" },
    { value: "aunt-p", label: "عمتي" },
    { value: "uncle-m", label: "خالي" },
    { value: "aunt-m", label: "خالتي" },
    { value: "friend-m", label: "صديقي" },
    { value: "friend-f", label: "صديقتي" },
    { value: "teacher-m", label: "أستاذي" },
    { value: "teacher-f", label: "أستاذتي" },
    { value: "child-m", label: "طفلي" },
    { value: "child-f", label: "طفلتي" },
    { value: "family", label: "عائلتي" }
  ];

  const state = {
    personalization: { name: "", rel: "", person: "موتى المسلمين", hasName: false },
    siteConfig: null,
    toastRegion: null,
    dialogs: {},
    duasPromise: null,
    favorites: null
  };

  T.root = root;
  T.storageKeys = STORAGE;
  T.relOptions = REL_OPTIONS;
  T.state = state;

  /* ---------- Small utilities ---------- */
  const $ = (selector, context) => (context || doc).querySelector(selector);
  const $$ = (selector, context) => Array.from((context || doc).querySelectorAll(selector));

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeText(value, maxLength, options) {
    const opts = options || {};
    let text = String(value == null ? "" : value).normalize("NFC");
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ");
    if (opts.multiline) {
      text = text
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
    } else {
      text = text.replace(/\s+/g, " ");
    }
    text = text.trim();
    if (maxLength && text.length > maxLength) text = text.slice(0, maxLength).trim();
    return text;
  }

  function sanitizeName(value) {
    let name = sanitizeText(value, 80)
      .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFFFD]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) return "";
    return name.slice(0, 80).trim();
  }

  function normalizeArabic(value) {
    return String(value == null ? "" : value)
      .normalize("NFC")
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
      .replace(/\u0640/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[ؤئ]/g, "ء")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return new Intl.NumberFormat("en-US").format(number);
  }

  function debounce(fn, wait) {
    let timer = null;
    return function debounced() {
      const args = arguments;
      const context = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, wait || 120);
    };
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value), window.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function uniqueId(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function todayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function storageGet(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function icon(name, className) {
    const cls = "icon" + (className ? " " + className : "");
    return '<svg class="' + cls + '" aria-hidden="true" focusable="false"><use href="' + root + "assets/icons.svg#i-" + name + '"></use></svg>';
  }

  function clearElement(element) {
    while (element && element.firstChild) element.removeChild(element.firstChild);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = doc.createElement("a");
    link.href = url;
    link.download = filename || "download";
    link.rel = "noopener";
    doc.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function downloadText(text, filename, mime) {
    const blob = new Blob([text], { type: mime || "application/json;charset=utf-8" });
    downloadBlob(blob, filename);
  }

  T.$ = $;
  T.$$ = $$;
  T.escapeHTML = escapeHTML;
  T.sanitizeText = sanitizeText;
  T.sanitizeName = sanitizeName;
  T.normalizeArabic = normalizeArabic;
  T.formatNumber = formatNumber;
  T.debounce = debounce;
  T.safeUrl = safeUrl;
  T.uniqueId = uniqueId;
  T.todayKey = todayKey;
  T.storageGet = storageGet;
  T.storageSet = storageSet;
  T.storageRemove = storageRemove;
  T.icon = icon;
  T.downloadBlob = downloadBlob;
  T.downloadText = downloadText;
  T.isFile = window.location.protocol === "file:";

  /* ---------- Theme ---------- */
  function updateThemeButtons() {
    const dark = doc.documentElement.getAttribute("data-theme") === "dark";
    $$("[data-theme-toggle]").forEach(function (button) {
      button.setAttribute("aria-label", dark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن");
      button.setAttribute("title", dark ? "الوضع الفاتح" : "الوضع الداكن");
      const use = button.querySelector("use");
      if (use) use.setAttribute("href", root + "assets/icons.svg#i-" + (dark ? "sun" : "moon"));
    });
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0b1914" : "#183d32");
  }

  function applyTheme(theme, persist) {
    const next = theme === "dark" ? "dark" : "light";
    doc.documentElement.setAttribute("data-theme", next);
    if (persist) storageSet(STORAGE.theme, next);
    updateThemeButtons();
  }

  function initTheme() {
    const stored = storageGet(STORAGE.theme, null);
    const system = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    applyTheme(stored || (system && system.matches ? "dark" : "light"), false);
    $$("[data-theme-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        const next = doc.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(next, true);
      });
    });
    if (system && typeof system.addEventListener === "function") {
      system.addEventListener("change", function (event) {
        if (!storageGet(STORAGE.theme, null)) applyTheme(event.matches ? "dark" : "light", false);
      });
    }
  }

  /* ---------- Navigation ---------- */
  function closeNavGroups(except) {
    $$("[data-nav-group]").forEach(function (group) {
      if (group === except) return;
      group.classList.remove("is-open");
      const toggle = group.querySelector("[data-nav-group-toggle]");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  function closeNav() {
    const nav = $("#site-nav");
    const toggle = $("[data-nav-toggle]");
    if (!nav) return;
    nav.classList.remove("is-open");
    doc.body.classList.remove("nav-open");
    closeNavGroups();
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      const use = toggle.querySelector("use");
      if (use) use.setAttribute("href", root + "assets/icons.svg#i-menu");
    }
  }

  function openNav() {
    const nav = $("#site-nav");
    const toggle = $("[data-nav-toggle]");
    if (!nav) return;
    nav.classList.add("is-open");
    doc.body.classList.add("nav-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
      const use = toggle.querySelector("use");
      if (use) use.setAttribute("href", root + "assets/icons.svg#i-close");
    }
  }

  function initNav() {
    const nav = $("#site-nav");
    const toggle = $("[data-nav-toggle]");
    if (!nav || !toggle) return;

    $$("[data-nav-group]", nav).forEach(function (group) {
      const groupToggle = group.querySelector("[data-nav-group-toggle]");
      if (!groupToggle) return;
      groupToggle.addEventListener("click", function (event) {
        event.stopPropagation();
        const willOpen = !group.classList.contains("is-open");
        closeNavGroups(group);
        group.classList.toggle("is-open", willOpen);
        groupToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
    });

    toggle.addEventListener("click", function () {
      if (nav.classList.contains("is-open")) closeNav();
      else openNav();
    });
    $$("a", nav).forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
    $$("[data-nav-close]", nav).forEach(function (button) {
      button.addEventListener("click", closeNav);
    });
    doc.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      const openGroup = $("[data-nav-group].is-open");
      const groupToggle = openGroup ? openGroup.querySelector("[data-nav-group-toggle]") : null;
      closeNav();
      if (groupToggle) groupToggle.focus();
    });
    doc.addEventListener("click", function (event) {
      if (!event.target.closest("[data-nav-group]")) closeNavGroups();
      if (!nav.classList.contains("is-open")) return;
      if (event.target.closest("#site-nav") || event.target.closest("[data-nav-toggle]")) return;
      closeNav();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1120) closeNav();
    });
  }

  function initActiveNav() {
    const page = doc.body.dataset.page || "";
    $$("#site-nav a").forEach(function (link) {
      if (page && link.dataset.nav === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    $$("[data-nav-group]").forEach(function (group) {
      const active = group.querySelector('a[aria-current="page"]');
      group.classList.toggle("is-active", !!active);
      const groupToggle = group.querySelector("[data-nav-group-toggle]");
      if (groupToggle) groupToggle.classList.toggle("is-active", !!active);
    });
  }

  /* ---------- Personalization ---------- */
  function relLabel(value) {
    if (!value) return "";
    const found = REL_OPTIONS.find(function (item) { return item.value === value; });
    return found ? found.label : "";
  }

  function validRel(value) {
    const clean = sanitizeText(value, 40);
    return REL_OPTIONS.some(function (item) { return item.value === clean; }) ? clean : "";
  }

  function getPerson(name, rel) {
    const cleanName = sanitizeName(name);
    if (!cleanName) return "موتى المسلمين";
    const label = relLabel(validRel(rel));
    if (!label) return cleanName;
    if (cleanName === label || cleanName.indexOf(label + " ") === 0) return cleanName;
    return label + " " + cleanName;
  }

  function buildPersonalization(name, rel) {
    const cleanName = sanitizeName(name);
    const cleanRel = cleanName ? validRel(rel) : "";
    return {
      name: cleanName,
      rel: cleanRel,
      person: getPerson(cleanName, cleanRel),
      hasName: !!cleanName
    };
  }

  function decodeQueryComponent(raw) {
    try {
      return decodeURIComponent(String(raw == null ? "" : raw).replace(/\+/g, " "));
    } catch (error) {
      return null;
    }
  }

  function readPersonalizationQuery() {
    const info = { present: false, name: null, rel: null, malformed: false };
    let search = "";
    try {
      search = window.location.search || "";
    } catch (error) {
      return info;
    }
    if (!search || search === "?") return info;
    search.replace(/^\?/, "").split("&").forEach(function (pair) {
      if (!pair) return;
      const index = pair.indexOf("=");
      const rawKey = index >= 0 ? pair.slice(0, index) : pair;
      const rawValue = index >= 0 ? pair.slice(index + 1) : "";
      const key = decodeQueryComponent(rawKey);
      if (key !== "name" && key !== "rel") return;
      info.present = true;
      const value = decodeQueryComponent(rawValue);
      if (value == null || value.indexOf("\uFFFD") !== -1) {
        info.malformed = true;
        return;
      }
      info[key] = value;
    });
    return info;
  }

  function cleanMalformedPersonalizationQuery() {
    let search = "";
    try {
      search = window.location.search || "";
    } catch (error) {
      return false;
    }
    if (!search || search === "?") return false;
    let changed = false;
    const kept = [];
    search.replace(/^\?/, "").split("&").forEach(function (pair) {
      if (!pair) return;
      const index = pair.indexOf("=");
      const rawKey = index >= 0 ? pair.slice(0, index) : pair;
      const rawValue = index >= 0 ? pair.slice(index + 1) : "";
      const key = decodeQueryComponent(rawKey);
      if (key === "name" || key === "rel") {
        const value = decodeQueryComponent(rawValue);
        if (value == null || value.indexOf("\uFFFD") !== -1) {
          changed = true;
          return;
        }
      }
      kept.push(pair);
    });
    const hasNameParam = kept.some(function (pair) {
      const index = pair.indexOf("=");
      const rawKey = index >= 0 ? pair.slice(0, index) : pair;
      return decodeQueryComponent(rawKey) === "name";
    });
    if (!hasNameParam) {
      const withoutRel = kept.filter(function (pair) {
        const index = pair.indexOf("=");
        const rawKey = index >= 0 ? pair.slice(0, index) : pair;
        return decodeQueryComponent(rawKey) !== "rel";
      });
      if (withoutRel.length !== kept.length) {
        changed = true;
        kept.length = 0;
        Array.prototype.push.apply(kept, withoutRel);
      }
    }
    if (!changed) return false;
    try {
      const url = new URL(window.location.href);
      url.search = kept.length ? "?" + kept.join("&") : "";
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readPersonalization() {
    const stored = storageGet(STORAGE.personalization, null);
    let name = "";
    let rel = "";
    if (isPlainObject(stored)) {
      name = sanitizeName(stored.name);
      rel = validRel(stored.rel);
    }
    state.personalizationFromQuery = false;
    const query = readPersonalizationQuery();
    if (query.present && query.name !== null) {
      name = sanitizeName(query.name);
      rel = validRel(query.rel || "");
      state.personalizationFromQuery = true;
      if (name) storageSet(STORAGE.personalization, { name: name, rel: rel, updatedAt: new Date().toISOString() });
      else storageRemove(STORAGE.personalization);
    }
    return buildPersonalization(name, rel);
  }

  function savePersonalization(name, rel) {
    const clean = buildPersonalization(name, rel);
    state.personalization = clean;
    if (clean.name) storageSet(STORAGE.personalization, { name: clean.name, rel: clean.rel, updatedAt: new Date().toISOString() });
    else storageRemove(STORAGE.personalization);
    return clean;
  }

  function syncPersonalizationUrl() {
    try {
      const url = new URL(window.location.href);
      const p = state.personalization;
      if (p.name) {
        url.searchParams.set("name", p.name);
        if (p.rel) url.searchParams.set("rel", p.rel);
        else url.searchParams.delete("rel");
      } else {
        url.searchParams.delete("name");
        url.searchParams.delete("rel");
      }
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (error) {
      /* ignore */
    }
  }

  function dedicationText(type) {
    const p = state.personalization;
    if (!p.hasName) {
      if (type === "full" || type === "footer") return "اللهم اجعل هذا العمل صدقة جارية عن موتى المسلمين، واغفر لمن أُهدي إليه، وارحم موتى المسلمين.";
      if (type === "short") return "عن موتى المسلمين";
      if (type === "card") return "صدقة جارية عن موتى المسلمين";
      return "موتى المسلمين";
    }
    if (type === "full" || type === "footer") {
      return "اللهم اجعل هذا العمل صدقة جارية عن " + p.person + "، واغفر لمن أُهدي إليه، وارحم موتى المسلمين.";
    }
    if (type === "short") return "عن " + p.person;
    if (type === "card") return "صدقة جارية عن " + p.person;
    return p.person;
  }

  function updateDedication() {
    $$("[data-dedication]").forEach(function (element) {
      element.textContent = dedicationText(element.dataset.dedication || "name");
    });
    $$("[data-dedication-name]").forEach(function (element) {
      element.textContent = state.personalization.hasName ? state.personalization.person : "موتى المسلمين";
    });
    $$("[data-has-personalization]").forEach(function (element) {
      element.hidden = !state.personalization.hasName;
    });
    $$("[data-no-personalization]").forEach(function (element) {
      element.hidden = state.personalization.hasName;
    });
    $$("[data-personalize-name]").forEach(function (input) {
      input.value = state.personalization.name;
    });
    $$("[data-personalize-rel]").forEach(function (select) {
      select.value = state.personalization.rel;
    });
  }

  function fillRelSelects() {
    $$("[data-personalize-rel]").forEach(function (select) {
      if (select.dataset.filled === "true") return;
      select.dataset.filled = "true";
      const current = select.value;
      clearElement(select);
      REL_OPTIONS.forEach(function (option) {
        const node = doc.createElement("option");
        node.value = option.value;
        node.textContent = option.label;
        select.appendChild(node);
      });
      select.value = current || state.personalization.rel || "";
    });
  }

  function previewPersonalization(name, rel) {
    const cleanName = sanitizeName(name);
    if (!cleanName) {
      return "سيظهر الإهداء: «اللهم اجعل هذا العمل صدقة جارية عن موتى المسلمين» حتى تكتب اسمًا.";
    }
    const person = getPerson(cleanName, rel);
    return "اللهم اجعل هذا العمل صدقة جارية عن " + person + "، واغفر لمن أُهدي إليه، وارحم موتى المسلمين.";
  }

  function setPersonalizeError(form, message) {
    const input = form.querySelector('[name="name"]');
    const error = form.querySelector("[data-personalize-error]");
    if (input) {
      input.classList.toggle("is-invalid", !!message);
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
  }

  function wirePersonalizeForm(form) {
    if (!form || form.dataset.wired === "true") return;
    form.dataset.wired = "true";
    const nameInput = form.querySelector('[name="name"]');
    const relSelect = form.querySelector('[name="rel"]');
    const preview = form.querySelector("[data-dedication-preview]") || form.parentElement.querySelector("[data-dedication-preview]");
    if (!nameInput) return;

    const updatePreview = function () {
      if (!preview) return;
      preview.textContent = previewPersonalization(nameInput.value, relSelect ? relSelect.value : "");
    };
    nameInput.addEventListener("input", function () {
      if (nameInput.classList.contains("is-invalid")) setPersonalizeError(form, "");
      updatePreview();
    });
    if (relSelect) relSelect.addEventListener("change", updatePreview);
    updatePreview();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const name = sanitizeName(nameInput.value);
      if (!name) {
        setPersonalizeError(form, "اكتب الاسم أولًا، أو استخدم زر «إزالة الإهداء».");
        nameInput.focus();
        return;
      }
      const rel = relSelect ? validRel(relSelect.value) : "";
      savePersonalization(name, rel);
      syncPersonalizationUrl();
      updateDedication();
      fillRelSelects();
      setPersonalizeError(form, "");
      if (form.closest("dialog")) closeDialog(form.closest("dialog"));
      toast("تم حفظ الإهداء، جعله الله صدقة جارية.", "success");
      form.dispatchEvent(new CustomEvent("tasbeeh:personalized", { bubbles: true, detail: state.personalization }));
    });

    $$("[data-reset-personalization]", form).forEach(function (button) {
      button.addEventListener("click", function () {
        resetPersonalization();
        setPersonalizeError(form, "");
        updatePreview();
        if (form.closest("dialog")) closeDialog(form.closest("dialog"));
      });
    });
  }

  function resetPersonalization() {
    state.personalization = buildPersonalization("", "");
    storageRemove(STORAGE.personalization);
    syncPersonalizationUrl();
    updateDedication();
    fillRelSelects();
    $$("[data-dedication-preview]").forEach(function (preview) {
      preview.textContent = previewPersonalization("", "");
    });
    toast("تمت إزالة الإهداء الشخصي.", "info");
    doc.dispatchEvent(new CustomEvent("tasbeeh:personalized", { detail: state.personalization }));
  }

  function ensurePersonalizeDialog() {
    if (state.dialogs.personalize) return state.dialogs.personalize;
    const dialog = doc.createElement("dialog");
    dialog.className = "dialog";
    dialog.id = "personalize-dialog";
    dialog.setAttribute("aria-labelledby", "personalize-title");
    dialog.innerHTML =
      '<form class="dialog__panel" data-personalize-form novalidate>' +
        '<button type="button" class="dialog__close" data-close-dialog aria-label="إغلاق">' + icon("close") + "</button>" +
        '<div class="dialog__head">' +
          '<p class="eyebrow">إهداء العمل</p>' +
          '<h2 id="personalize-title">اجعل هذا العمل صدقة جارية عن</h2>' +
          "<p>اكتب اسم من تحب، وسيظهر الإهداء في الموقع وفي رابط المشاركة.</p>" +
        "</div>" +
        '<div class="dialog__body">' +
          '<div class="personalize-fields">' +
            '<div class="field">' +
              '<label for="personalize-name">الاسم</label>' +
              '<input class="input" id="personalize-name" name="name" data-personalize-name type="text" maxlength="80" autocomplete="off" placeholder="مثال: فاطمة زهراء">' +
              '<p class="field__error" data-personalize-error hidden></p>' +
            "</div>" +
            '<div class="field">' +
              '<label for="personalize-rel">صفة القرابة (اختياري)</label>' +
              '<select class="select" id="personalize-rel" name="rel" data-personalize-rel></select>' +
            "</div>" +
          "</div>" +
          '<div class="dialog-preview" data-dedication-preview></div>' +
          '<div class="dialog__actions">' +
            '<button class="btn btn--primary" type="submit">حفظ الإهداء</button>' +
            '<button class="btn btn--ghost" type="button" data-reset-personalization>إزالة الإهداء</button>' +
          "</div>" +
          '<p class="dialog__note">يُحفظ الاسم على جهازك فقط، ويظهر في رابط المشاركة عند اختياره. لا تُرسل بيانات إلى أي خادم.</p>' +
        "</div>" +
      "</form>";
    doc.body.appendChild(dialog);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.addEventListener("close", function () {
      doc.body.classList.remove("dialog-open");
    });
    state.dialogs.personalize = dialog;
    wirePersonalizeForm(dialog.querySelector("[data-personalize-form]"));
    return dialog;
  }

  function openPersonalize() {
    const dialog = ensurePersonalizeDialog();
    fillRelSelects();
    updateDedication();
    const form = dialog.querySelector("[data-personalize-form]");
    const preview = dialog.querySelector("[data-dedication-preview]");
    if (preview) preview.textContent = previewPersonalization(state.personalization.name, state.personalization.rel);
    setPersonalizeError(form, "");
    openDialog(dialog);
    setTimeout(function () {
      const input = dialog.querySelector('[name="name"]');
      if (input) input.focus();
    }, 60);
  }

  function initPersonalization() {
    state.personalization = readPersonalization();
    cleanMalformedPersonalizationQuery();
    ensurePersonalizeDialog();
    fillRelSelects();
    $$("[data-personalize-form]").forEach(wirePersonalizeForm);
    updateDedication();
    $$("[data-open-personalize]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        openPersonalize();
      });
    });
    $$("[data-copy-dedication]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        if (!state.personalization.hasName) {
          toast("اكتب الاسم واحفظ الإهداء أولًا، ثم انسخ الرابط.", "info");
          const input = doc.getElementById("home-name");
          if (input) input.focus();
          return;
        }
        if (typeof T.copyShareLink === "function") {
          T.copyShareLink({ path: "" });
        }
      });
    });
    if (state.personalizationFromQuery) syncPersonalizationUrl();
  }

  T.getPersonalization = function () {
    return {
      name: state.personalization.name,
      rel: state.personalization.rel,
      person: state.personalization.person,
      hasName: state.personalization.hasName
    };
  };
  T.getPerson = getPerson;
  T.relLabel = relLabel;
  T.updateDedication = updateDedication;
  T.openPersonalize = openPersonalize;
  T.resetPersonalization = resetPersonalization;
  T.savePersonalization = savePersonalization;

  /* ---------- Toast ---------- */
  function ensureToastRegion() {
    if (state.toastRegion && doc.body.contains(state.toastRegion)) return state.toastRegion;
    const region = doc.createElement("div");
    region.className = "toast-region";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    doc.body.appendChild(region);
    state.toastRegion = region;
    return region;
  }

  function toast(message, type, options) {
    const opts = options || {};
    const kind = type || "success";
    const region = ensureToastRegion();
    const element = doc.createElement("div");
    element.className = "toast toast--" + kind;
    element.setAttribute("role", kind === "error" ? "alert" : "status");
    element.innerHTML = icon(kind === "error" ? "info" : "check") + "<span>" + escapeHTML(message) + "</span>";

    let timer = null;
    const remove = function () {
      if (timer) clearTimeout(timer);
      if (!element.parentNode) return;
      element.classList.add("is-leaving");
      setTimeout(function () { element.remove(); }, 260);
    };

    if (opts.actionLabel && typeof opts.onAction === "function") {
      const action = doc.createElement("button");
      action.type = "button";
      action.className = "toast__action";
      action.textContent = opts.actionLabel;
      action.addEventListener("click", function () {
        remove();
        opts.onAction();
      });
      element.appendChild(action);
    }

    region.appendChild(element);
    while (region.children.length > 3) region.firstElementChild.remove();
    const duration = opts.duration == null ? (kind === "error" ? 5200 : 3800) : opts.duration;
    if (duration > 0) timer = setTimeout(remove, duration);
    return { remove: remove, element: element };
  }

  T.toast = toast;

  /* ---------- Dialogs ---------- */
  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    doc.body.classList.add("dialog-open");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    doc.body.classList.remove("dialog-open");
  }

  function ensureConfirmDialog() {
    if (state.dialogs.confirm) return state.dialogs.confirm;
    const dialog = doc.createElement("dialog");
    dialog.className = "dialog";
    dialog.id = "confirm-dialog";
    dialog.setAttribute("aria-labelledby", "confirm-title");
    dialog.innerHTML =
      '<form method="dialog" class="dialog__panel">' +
        '<div class="dialog__head">' +
          '<p class="eyebrow">تأكيد</p>' +
          '<h2 id="confirm-title">هل أنت متأكد؟</h2>' +
        "</div>" +
        '<p class="confirm-message" data-confirm-message></p>' +
        '<div class="dialog__actions">' +
          '<button class="btn btn--danger" type="submit" value="confirm" data-confirm-ok>تأكيد</button>' +
          '<button class="btn btn--ghost" type="submit" value="cancel" data-confirm-cancel>إلغاء</button>' +
        "</div>" +
      "</form>";
    doc.body.appendChild(dialog);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.addEventListener("close", function () {
      doc.body.classList.remove("dialog-open");
    });
    state.dialogs.confirm = dialog;
    return dialog;
  }

  function confirmAction(message, options) {
    const opts = options || {};
    const dialog = ensureConfirmDialog();
    const title = dialog.querySelector("#confirm-title");
    const text = dialog.querySelector("[data-confirm-message]");
    const ok = dialog.querySelector("[data-confirm-ok]");
    const cancel = dialog.querySelector("[data-confirm-cancel]");
    if (title) title.textContent = opts.title || "هل أنت متأكد؟";
    if (text) text.textContent = message || "";
    if (ok) ok.textContent = opts.confirmLabel || "تأكيد";
    if (cancel) cancel.textContent = opts.cancelLabel || "إلغاء";
    if (ok) ok.className = "btn " + (opts.danger === false ? "btn--primary" : "btn--danger");
    dialog.returnValue = "";
    return new Promise(function (resolve) {
      const onClose = function () {
        dialog.removeEventListener("close", onClose);
        resolve(dialog.returnValue === "confirm");
      };
      dialog.addEventListener("close", onClose);
      openDialog(dialog);
      setTimeout(function () { if (ok) ok.focus(); }, 50);
    });
  }

  T.confirm = confirmAction;
  T.openDialog = openDialog;
  T.closeDialog = closeDialog;

  doc.addEventListener("click", function (event) {
    const closer = event.target.closest("[data-close-dialog]");
    if (closer) {
      event.preventDefault();
      closeDialog(closer.closest("dialog"));
    }
  });

  /* ---------- Content data ---------- */
  function loadJSON(name) {
    const url = root + "data/" + name;
    return fetch(url, { cache: "no-cache", headers: { Accept: "application/json" } }).then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    });
  }

  function emptyOverlay() {
    return { added: [], edited: {}, deleted: [] };
  }

  function readOverlay() {
    const raw = storageGet(STORAGE.duasOverlay, null);
    if (!isPlainObject(raw)) return emptyOverlay();
    return {
      added: Array.isArray(raw.added) ? raw.added.filter(isPlainObject) : [],
      edited: isPlainObject(raw.edited) ? raw.edited : {},
      deleted: Array.isArray(raw.deleted) ? raw.deleted.filter(function (id) { return typeof id === "string"; }) : []
    };
  }

  function saveOverlay(overlay) {
    const clean = {
      added: Array.isArray(overlay.added) ? overlay.added : [],
      edited: isPlainObject(overlay.edited) ? overlay.edited : {},
      deleted: Array.isArray(overlay.deleted) ? overlay.deleted : []
    };
    const ok = storageSet(STORAGE.duasOverlay, clean);
    if (ok) state.duasPromise = null;
    return ok;
  }

  function sanitizeDua(input, forcedId) {
    const source = isPlainObject(input) ? input : {};
    const type = ["quran", "hadith", "general"].indexOf(source.type) >= 0 ? source.type : "general";
    const tags = Array.isArray(source.tags)
      ? source.tags.map(function (tag) { return sanitizeText(tag, 40); }).filter(Boolean).slice(0, 12)
      : String(source.tags || "").split(",").map(function (tag) { return sanitizeText(tag, 40); }).filter(Boolean).slice(0, 12);
    return {
      id: forcedId || sanitizeText(source.id, 80) || uniqueId("local-dua"),
      title: sanitizeText(source.title, 160),
      category: sanitizeText(source.category, 40) || "general",
      type: type,
      text: sanitizeText(source.text, 6000, { multiline: true }),
      source: sanitizeText(source.source, 160),
      reference: sanitizeText(source.reference, 160),
      grade: sanitizeText(source.grade, 100),
      sourceUrl: safeUrl(source.sourceUrl),
      repeat: clamp(parseInt(source.repeat, 10) || 1, 1, 100),
      tags: tags,
      featured: !!source.featured,
      note: sanitizeText(source.note, 2000, { multiline: true })
    };
  }

  function applyOverlay(base) {
    if (!isPlainObject(base) || !Array.isArray(base.duas)) throw new Error("ملف الأدعية غير صالح");
    const overlay = readOverlay();
    const deleted = new Set(overlay.deleted);
    const edited = overlay.edited;
    const duas = [];

    base.duas.forEach(function (dua) {
      if (!isPlainObject(dua) || !dua.id || deleted.has(dua.id)) return;
      if (isPlainObject(edited[dua.id])) {
        const merged = sanitizeDua(Object.assign({}, dua, edited[dua.id]), dua.id);
        merged._local = true;
        merged._edited = true;
        duas.push(merged);
      } else {
        const clean = sanitizeDua(dua, dua.id);
        duas.push(clean);
      }
    });

    overlay.added.forEach(function (dua) {
      if (!isPlainObject(dua) || !dua.id || deleted.has(dua.id)) return;
      const clean = sanitizeDua(dua, dua.id);
      clean._local = true;
      clean._added = true;
      duas.push(clean);
    });

    return Object.assign({}, base, { duas: duas, _overlay: overlay });
  }

  function loadDuas() {
    if (state.duasPromise) return state.duasPromise;
    state.duasPromise = loadJSON("duas.json").then(applyOverlay).catch(function (error) {
      state.duasPromise = null;
      throw error;
    });
    return state.duasPromise;
  }

  function invalidateDuas() {
    state.duasPromise = null;
  }

  function getFavorites() {
    if (state.favorites) return new Set(state.favorites);
    const stored = storageGet(STORAGE.favorites, []);
    state.favorites = Array.isArray(stored) ? stored.filter(function (id) { return typeof id === "string"; }) : [];
    return new Set(state.favorites);
  }

  function saveFavorites(set) {
    state.favorites = Array.from(set);
    storageSet(STORAGE.favorites, state.favorites);
  }

  function toggleFavorite(id) {
    const favorites = getFavorites();
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    saveFavorites(favorites);
    return favorites.has(id);
  }

  T.loadJSON = loadJSON;
  T.loadDuas = loadDuas;
  T.invalidateDuas = invalidateDuas;
  T.readOverlay = readOverlay;
  T.saveOverlay = saveOverlay;
  T.emptyOverlay = emptyOverlay;
  T.applyOverlay = applyOverlay;
  T.sanitizeDua = sanitizeDua;
  T.getFavorites = getFavorites;
  T.saveFavorites = saveFavorites;
  T.toggleFavorite = toggleFavorite;

  /* ---------- Tabs ---------- */
  function initTabs(tablist, onChange) {
    if (!tablist) return null;
    const tabs = $$('[role="tab"]', tablist);
    if (!tabs.length) return null;

    function select(tab, focus) {
      tabs.forEach(function (item) {
        const active = item === tab;
        item.setAttribute("aria-selected", active ? "true" : "false");
        item.tabIndex = active ? 0 : -1;
        const panelId = item.getAttribute("aria-controls");
        if (panelId) {
          const panel = doc.getElementById(panelId);
          if (panel) panel.hidden = !active;
        }
      });
      if (focus) tab.focus();
      if (typeof onChange === "function") onChange(tab.dataset.tab || tab.id, tab);
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (event) {
        const index = tabs.indexOf(tab);
        let next = null;
        if (event.key === "ArrowLeft") next = tabs[(index + 1) % tabs.length];
        else if (event.key === "ArrowRight") next = tabs[(index - 1 + tabs.length) % tabs.length];
        else if (event.key === "Home") next = tabs[0];
        else if (event.key === "End") next = tabs[tabs.length - 1];
        if (next) {
          event.preventDefault();
          select(next, true);
        }
      });
    });

    const initial = tabs.find(function (tab) { return tab.getAttribute("aria-selected") === "true"; }) || tabs[0];
    select(initial, false);

    return {
      select: function (id) {
        const tab = tabs.find(function (item) { return item.dataset.tab === id || item.id === id; });
        if (tab) select(tab, false);
      }
    };
  }

  T.initTabs = initTabs;

  /* ---------- Scroll reveal, back to top, year ---------- */
  function initReveal() {
    const elements = $$(".reveal");
    if (!elements.length) return;
    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (element) { element.classList.add("is-visible"); });
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    elements.forEach(function (element) { observer.observe(element); });
  }

  function initBackToTop() {
    if ($(".back-to-top")) return;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "back-to-top";
    button.setAttribute("aria-label", "العودة إلى أعلى الصفحة");
    button.innerHTML = icon("arrow-right");
    button.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    doc.body.appendChild(button);
    let ticking = false;
    const update = function () {
      button.classList.toggle("is-visible", window.scrollY > 620);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function initYear() {
    const year = String(new Date().getFullYear());
    $$("[data-year]").forEach(function (element) { element.textContent = year; });
  }

  function initHeaderShadow() {
    const header = $(".site-header");
    if (!header) return;
    let ticking = false;
    const update = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ---------- Init ---------- */
  function init() {
    doc.documentElement.classList.add("js");
    initTheme();
    ensureConfirmDialog();
    initPersonalization();
    initNav();
    initActiveNav();
    initReveal();
    initBackToTop();
    initYear();
    initHeaderShadow();
    doc.dispatchEvent(new CustomEvent("tasbeeh:core-ready"));
  }

  T.init = init;
  T.ready = true;

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
