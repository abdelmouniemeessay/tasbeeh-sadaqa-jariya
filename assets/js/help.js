/* =========================================================
   Help Center — search, category filter, counts, deep links
   ========================================================= */
(function () {
  "use strict";

  const input = document.getElementById("help-search");
  const clearButton = document.querySelector("[data-help-clear]");
  const resetButtons = Array.from(document.querySelectorAll("[data-help-reset]"));
  const status = document.querySelector("[data-help-status]");
  const statusVisible = document.querySelector("[data-help-visible]");
  const statusTotal = document.querySelector("[data-help-total]");
  const emptyState = document.querySelector("[data-help-empty]");
  const filters = Array.from(document.querySelectorAll("[data-help-filter]"));
  const sections = Array.from(document.querySelectorAll("[data-help-section]"));

  if (!input || !filters.length) return;

  function normalize(value) {
    return String(value == null ? "" : value)
      .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[ؤئ]/g, "ء")
      .replace(/[٠-٩]/g, function (digit) {
        return String(digit.charCodeAt(0) - 0x0660);
      })
      .replace(/[۰-۹]/g, function (digit) {
        return String(digit.charCodeAt(0) - 0x06f0);
      })
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  const items = Array.from(document.querySelectorAll("[data-help-item]")).map(function (element, index) {
    const section = element.closest("[data-help-section]");
    const summary = element.querySelector("summary");
    const body = element.querySelector(".help-faq__body");
    const heading = section ? section.querySelector(".help-section__head") : null;
    element.id = element.id || "help-faq-" + (index + 1);
    return {
      element: element,
      category: element.getAttribute("data-help-category") || "",
      section: section,
      search: normalize(
        (summary ? summary.textContent : "") +
          " " +
          (body ? body.textContent : "") +
          " " +
          (heading ? heading.textContent : "")
      )
    };
  });

  const total = items.length;
  let activeCategory = "all";
  let query = "";

  if (statusTotal) statusTotal.textContent = String(total);

  function matchesQuery(item) {
    if (!query) return true;
    const tokens = query.split(/\s+/).filter(Boolean);
    return tokens.every(function (token) {
      return item.search.indexOf(token) !== -1;
    });
  }

  function countFor(category) {
    return items.filter(function (item) {
      if (category !== "all" && item.category !== category) return false;
      return matchesQuery(item);
    }).length;
  }

  function setHash(category) {
    try {
      if (!/^https?:$/.test(window.location.protocol)) return;
      const url = new URL(window.location.href);
      if (category === "all") url.hash = "";
      else url.hash = "help-" + category;
      window.history.replaceState(null, "", url.href);
    } catch (error) {
      /* file:// and restricted contexts cannot rewrite history */
    }
  }

  function hashCategory() {
    const match = /^#help-([a-z0-9-]+)$/i.exec(window.location.hash || "");
    if (!match) return "all";
    const category = match[1];
    return filters.some(function (button) {
      return button.getAttribute("data-help-filter") === category;
    })
      ? category
      : "all";
  }

  function apply() {
    const tokens = query.split(/\s+/).filter(Boolean);
    const matches = items.filter(function (item) {
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      return tokens.every(function (token) {
        return item.search.indexOf(token) !== -1;
      });
    });
    const visible = new Set(matches.map(function (item) { return item.element; }));

    items.forEach(function (item) {
      const show = visible.has(item.element);
      item.element.hidden = !show;
      if (!show) item.element.open = false;
      else if (tokens.length) item.element.open = true;
      else item.element.open = false;
    });

    sections.forEach(function (section) {
      section.hidden = !matches.some(function (item) { return item.section === section; });
    });

    filters.forEach(function (button) {
      const category = button.getAttribute("data-help-filter");
      const active = category === activeCategory;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      const counter = button.querySelector("[data-help-count]");
      if (counter) counter.textContent = String(countFor(category));
    });

    if (statusVisible) statusVisible.textContent = String(matches.length);
    if (status) status.hidden = false;
    if (emptyState) emptyState.hidden = matches.length !== 0;
    if (clearButton) clearButton.hidden = !query;
    resetButtons.forEach(function (button) {
      button.hidden = !(query || activeCategory !== "all");
    });
  }

  function setCategory(category, updateHash) {
    activeCategory = category;
    if (updateHash !== false) setHash(category);
    apply();
  }

  input.addEventListener("input", function () {
    query = normalize(input.value);
    apply();
  });

  input.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || !input.value) return;
    event.preventDefault();
    reset();
  });

  if (clearButton) {
    clearButton.addEventListener("click", function () {
      reset();
      input.focus();
    });
  }

  resetButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      reset();
      input.focus();
    });
  });

  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      setCategory(button.getAttribute("data-help-filter") || "all");
    });
  });

  window.addEventListener("hashchange", function () {
    const category = hashCategory();
    if (category !== activeCategory) {
      activeCategory = category;
      apply();
    }
  });

  function reset() {
    input.value = "";
    query = "";
    setCategory("all");
  }

  activeCategory = hashCategory();
  apply();
})();
