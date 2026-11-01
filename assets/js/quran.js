/* =========================================================
   صفحة القرآن الكريم — آيات مختارة، تلاوة عند الطلب
   ========================================================= */
(function () {
  "use strict";

  const T = window.Tasbeeh;
  if (!T) return;

  const content = T.$("[data-quran-content]");
  if (!content) return;

  const themesBox = T.$("[data-quran-themes]");
  const statusNode = T.$("[data-quran-status]");

  const AUDIO_BASE = "https://cdn.islamic.network/quran/audio/128/ar.alafasy/";

  let model = null;
  let selectedTheme = "all";
  let loading = true;

  const audioState = {
    audio: null,
    verseId: "",
    button: null,
    status: null
  };

  function verseHash(verse) {
    return "ayah-" + verse.surahNumber + "-" + verse.ayah;
  }

  function verseIdFromHash(hash) {
    const clean = String(hash || "").replace(/^#/, "");
    if (/^\d+:\d+$/.test(clean)) return "ayah-" + clean.replace(":", "-");
    return clean;
  }

  function themeById(id) {
    if (!model) return null;
    return model.themes.find(function (theme) { return theme.id === id; }) || null;
  }

  function visibleThemes() {
    if (!model) return [];
    if (selectedTheme === "all") return model.themes;
    const theme = themeById(selectedTheme);
    return theme ? [theme] : model.themes;
  }

  function totalVerses(themes) {
    return themes.reduce(function (sum, theme) { return sum + theme.verses.length; }, 0);
  }

  function renderThemes() {
    if (!themesBox || !model) return;
    const chips = [
      { id: "all", title: "كل الموضوعات", count: totalVerses(model.themes) }
    ].concat(model.themes.map(function (theme) {
      return { id: theme.id, title: theme.title, count: theme.verses.length };
    }));

    themesBox.innerHTML = chips.map(function (chip) {
      const active = selectedTheme === chip.id;
      return (
        '<button class="chip' + (active ? " is-active" : "") + '" type="button" data-theme-id="' + T.escapeHTML(chip.id) + '"' +
        ' aria-pressed="' + (active ? "true" : "false") + '">' +
        T.escapeHTML(chip.title) +
        '<span class="chip__count">' + T.formatNumber(chip.count) + "</span>" +
        "</button>"
      );
    }).join("");

    themesBox.querySelectorAll("[data-theme-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectedTheme = button.dataset.themeId || "all";
        renderThemes();
        renderContent();
      });
    });
  }

  function verseMarkup(verse) {
    const external = "https://quran.com/" + verse.surahNumber + "/" + verse.ayah;
    return (
      '<article class="verse-card" id="' + verseHash(verse) + '" data-verse-id="' + T.escapeHTML(verse.id) + '"' +
        ' data-audio="' + T.escapeHTML(verse.audio || "") + '">' +
        '<div class="verse-card__head">' +
          '<div class="verse-card__ref">' +
            '<strong>سورة ' + T.escapeHTML(verse.surah) + "</strong>" +
            "<span>الآية " + T.formatNumber(verse.ayah) + "</span>" +
          "</div>" +
          '<a class="verse-card__ayah" href="' + external + '" target="_blank" rel="noopener" aria-label="فتح الآية في Quran.com">' +
            T.icon("external") + " quran.com" +
          "</a>" +
        "</div>" +
        '<p class="verse-card__text">' + T.escapeHTML(verse.text) + "</p>" +
        '<div class="verse-card__footer">' +
          '<div class="verse-card__actions">' +
            (verse.audio
              ? '<button class="btn btn--outline btn--sm" type="button" data-play>' + T.icon("play") + "<span>استماع</span></button>"
              : "") +
            '<button class="btn btn--ghost btn--sm" type="button" data-copy>' + T.icon("copy") + "<span>نسخ</span></button>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-copy-source>' + T.icon("copy") + "<span>نسخ مع المرجع</span></button>" +
            '<button class="btn btn--ghost btn--sm" type="button" data-whatsapp>' + T.icon("whatsapp") + "<span>واتساب</span></button>" +
            '<button class="btn btn--ghost btn--sm btn--icon" type="button" data-link aria-label="نسخ رابط الآية" title="نسخ الرابط">' + T.icon("link") + "</button>" +
            '<button class="btn btn--ghost btn--sm btn--icon" type="button" data-qr aria-label="رمز QR للآية" title="رمز QR">' + T.icon("qr") + "</button>" +
          "</div>" +
          '<p class="audio-status" data-audio-status aria-live="polite"></p>' +
        "</div>" +
      "</article>"
    );
  }

  function setPlayButton(button, playing) {
    if (!button) return;
    button.classList.toggle("is-playing", playing);
    button.innerHTML = T.icon(playing ? "pause" : "play") + "<span>" + (playing ? "إيقاف" : "استماع") + "</span>";
    button.setAttribute("aria-label", playing ? "إيقاف التلاوة" : "استماع للتلاوة");
  }

  function resetAudioUi() {
    if (audioState.button) setPlayButton(audioState.button, false);
    audioState.button = null;
    audioState.verseId = "";
    audioState.status = null;
  }

  function stopAudio() {
    if (audioState.audio) {
      audioState.audio.pause();
      try {
        audioState.audio.currentTime = 0;
      } catch (error) {
        /* ignore */
      }
    }
    resetAudioUi();
  }

  function ensureAudio() {
    if (audioState.audio) return audioState.audio;
    const audio = new Audio();
    audio.preload = "none";
    audio.addEventListener("ended", function () {
      if (audioState.status) audioState.status.textContent = "انتهت التلاوة.";
      resetAudioUi();
    });
    audio.addEventListener("pause", function () {
      if (audioState.button) setPlayButton(audioState.button, false);
    });
    audio.addEventListener("error", function () {
      if (audioState.status) {
        audioState.status.textContent = "تعذّر تشغيل التلاوة. تحقق من اتصالك بالإنترنت.";
        audioState.status.classList.add("is-error");
      }
      T.toast("تعذّر تشغيل التلاوة. تحقق من الاتصال.", "error");
      resetAudioUi();
    });
    audioState.audio = audio;
    return audio;
  }

  function toggleAudio(verse, button, status) {
    if (!verse.audio) return;
    const audio = ensureAudio();
    if (status) status.classList.remove("is-error");

    if (audioState.verseId === verse.id && !audio.paused) {
      audio.pause();
      if (status) status.textContent = "أُوقفت التلاوة.";
      setPlayButton(button, false);
      audioState.button = button;
      audioState.status = status;
      return;
    }

    if (audioState.button && audioState.button !== button) setPlayButton(audioState.button, false);
    resetAudioUi();
    audioState.verseId = verse.id;
    audioState.button = button;
    audioState.status = status;
    setPlayButton(button, true);
    if (status) status.textContent = "جارٍ تحميل التلاوة…";

    audio.src = AUDIO_BASE + verse.audio + ".mp3";
    audio.load();
    const promise = audio.play();
    if (promise && typeof promise.then === "function") {
      promise.then(function () {
        if (status && audioState.verseId === verse.id) {
          status.textContent = "تلاوة الشيخ مشاري راشد العفاسي.";
        }
      }).catch(function () {
        if (status) {
          status.textContent = "تعذّر تشغيل التلاوة. تحقق من اتصالك بالإنترنت.";
          status.classList.add("is-error");
        }
        T.toast("تعذّر تشغيل التلاوة. تحقق من الاتصال.", "error");
        resetAudioUi();
      });
    }
  }

  function sourceText(verse) {
    return "سورة " + verse.surah + " — الآية " + verse.ayah;
  }

  function bindVerse(card, verse) {
    const play = card.querySelector("[data-play]");
    const copy = card.querySelector("[data-copy]");
    const copySource = card.querySelector("[data-copy-source]");
    const whatsapp = card.querySelector("[data-whatsapp]");
    const link = card.querySelector("[data-link]");
    const qr = card.querySelector("[data-qr]");
    const status = card.querySelector("[data-audio-status]");

    if (play) {
      play.addEventListener("click", function () {
        toggleAudio(verse, play, status);
      });
    }

    if (copy) {
      copy.addEventListener("click", async function () {
        const ok = await T.copyText(verse.text);
        T.toast(ok ? "تم نسخ الآية." : "تعذّر النسخ، جرّب تحديد النص يدويًا.", ok ? "success" : "error");
      });
    }

    if (copySource) {
      copySource.addEventListener("click", async function () {
        const ok = await T.copyText(verse.text + "\n\n" + sourceText(verse) + "\nhttps://quran.com/" + verse.surahNumber + "/" + verse.ayah);
        T.toast(ok ? "تم نسخ الآية مع المرجع." : "تعذّر النسخ، جرّب تحديد النص يدويًا.", ok ? "success" : "error");
      });
    }

    if (whatsapp) {
      whatsapp.addEventListener("click", function () {
        T.shareWhatsApp(verse.text + "\n\n" + sourceText(verse), {
          path: "pages/quran.html",
          hash: verseHash(verse)
        });
      });
    }

    if (link) {
      link.addEventListener("click", function () {
        T.copyShareLink({ path: "pages/quran.html", hash: verseHash(verse) });
      });
    }

    if (qr) {
      qr.addEventListener("click", function () {
        T.openQr({ path: "pages/quran.html", hash: verseHash(verse) });
      });
    }
  }

  function applyHashHighlight() {
    let hash = "";
    try {
      hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    } catch (error) {
      hash = window.location.hash.replace(/^#/, "");
    }
    if (!hash) return;
    const target = document.getElementById(verseIdFromHash(hash));
    if (!target || !target.classList.contains("verse-card")) return;
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
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const target = document.getElementById(verseIdFromHash(hash));
    if (!target && selectedTheme !== "all") {
      selectedTheme = "all";
      renderThemes();
      renderContent();
      return;
    }
    applyHashHighlight();
  }

  function groupMarkup(theme) {
    return (
      '<section class="quran-group" aria-labelledby="theme-' + T.escapeHTML(theme.id) + '">' +
        '<div class="quran-group__head">' +
          '<p class="eyebrow">' + T.icon("book-open") + " موضوع</p>" +
          '<h2 id="theme-' + T.escapeHTML(theme.id) + '">' + T.escapeHTML(theme.title) + "</h2>" +
          "<p>" + T.escapeHTML(theme.subtitle || "") + "</p>" +
          (theme.note ? '<p class="quran-group__note">' + T.icon("info") + "<span>" + T.escapeHTML(theme.note) + "</span></p>" : "") +
        "</div>" +
        '<div class="quran-grid">' + theme.verses.map(verseMarkup).join("") + "</div>" +
      "</section>"
    );
  }

  function renderContent() {
    if (!model) return;
    stopAudio();
    const themes = visibleThemes();
    const count = totalVerses(themes);
    if (statusNode) {
      statusNode.textContent = selectedTheme === "all"
        ? T.formatNumber(count) + " آية في " + T.formatNumber(themes.length) + " موضوعات للتدبّر والدعاء."
        : T.formatNumber(count) + " آية في موضوع «" + themeById(selectedTheme).title + "».";
    }
    content.innerHTML = themes.map(groupMarkup).join("");

    const versesById = {};
    themes.forEach(function (theme) {
      theme.verses.forEach(function (verse) { versesById[verse.id] = verse; });
    });
    content.querySelectorAll("[data-verse-id]").forEach(function (card) {
      const verse = versesById[card.dataset.verseId];
      if (verse) bindVerse(card, verse);
    });
    applyHashHighlight();
  }

  function showError() {
    loading = false;
    if (statusNode) statusNode.textContent = "";
    content.innerHTML =
      '<div class="error-state">' +
        T.icon("wifi-off") +
        "<h3>تعذّر تحميل الآيات</h3>" +
        "<p>تأكد من فتح الموقع عبر خادم محلي أو من اتصالك بالإنترنت، ثم أعد المحاولة.</p>" +
        '<button class="btn btn--primary btn--sm" type="button" data-retry-quran>إعادة المحاولة</button>' +
      "</div>";
    const retry = content.querySelector("[data-retry-quran]");
    if (retry) {
      retry.addEventListener("click", function () {
        content.innerHTML = '<div class="loading-state"><span class="spinner" aria-hidden="true"></span><p>جارٍ تحميل الآيات…</p></div>';
        load();
      });
    }
  }

  function load() {
    T.loadJSON("quran.json").then(function (data) {
      model = data;
      loading = false;
      renderThemes();
      renderContent();
    }).catch(showError);
  }

  window.addEventListener("hashchange", handleHashChange);

  load();
})();
