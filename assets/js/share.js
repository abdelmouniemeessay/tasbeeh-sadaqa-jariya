/* =========================================================
   تسبيح — Sharing, public URL, QR, PWA
   ========================================================= */
(function () {
  "use strict";

  const T = window.Tasbeeh;
  if (!T) return;
  const doc = document;
  const root = T.root;
  const STORAGE = T.storageKeys;
  const $ = T.$;
  const $$ = T.$$;

  const state = {
    siteConfig: null,
    sitePromise: null,
    qrPath: "",
    qrHash: "",
    qrUrl: "",
    qrCanvas: null,
    qrLibPromise: null,
    deferredPrompt: null,
    reloading: false,
    hadController: false
  };
  T.shareState = state;

  function isLocalHostname(hostname) {
    if (!hostname) return true;
    let host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
    if (host.endsWith(".local") || host.endsWith(".localhost")) return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    return false;
  }

  function normalizePublicBase(raw) {
    if (!raw) return "";
    try {
      const url = new URL(String(raw).trim());
      if (!/^https?:$/.test(url.protocol)) return "";
      if (isLocalHostname(url.hostname)) return "";
      url.hash = "";
      url.search = "";
      let path = url.pathname || "/";
      if (/\.[a-z0-9]{2,6}$/i.test(path)) path = path.replace(/[^/]*$/, "");
      if (!path.endsWith("/")) path += "/";
      return url.origin + path;
    } catch (error) {
      return "";
    }
  }

  function getDeployedBase() {
    if (!/^https?:$/.test(window.location.protocol)) return "";
    if (isLocalHostname(window.location.hostname)) return "";
    try {
      return normalizePublicBase(new URL(root, window.location.href).href);
    } catch (error) {
      return "";
    }
  }

  function getPublicBase() {
    const override = normalizePublicBase(T.storageGet(STORAGE.publicUrl, ""));
    if (override) return override;
    const configured = normalizePublicBase(state.siteConfig && state.siteConfig.siteUrl);
    if (configured) return configured;
    return getDeployedBase();
  }

  function getPagePath() {
    return (doc.body && doc.body.dataset.pagePath) || "";
  }

  function getPublicUrl(options) {
    const opts = options || {};
    const base = getPublicBase();
    if (!base) return "";
    const path = String(opts.path == null ? getPagePath() : opts.path).replace(/^\/+/, "");
    let url;
    try {
      url = new URL(path, base);
    } catch (error) {
      return "";
    }
    if (opts.hash) url.hash = String(opts.hash).replace(/^#/, "");
    const personalization = T.getPersonalization();
    if (personalization.name) {
      url.searchParams.set("name", personalization.name);
      if (personalization.rel) url.searchParams.set("rel", personalization.rel);
      else url.searchParams.delete("rel");
    }
    return url.href;
  }

  function loadSiteConfig() {
    if (!state.sitePromise) {
      state.sitePromise = T.loadJSON("site.json")
        .then(function (config) {
          state.siteConfig = config || {};
          T.state.siteConfig = state.siteConfig;
          return state.siteConfig;
        })
        .catch(function () {
          state.siteConfig = {};
          return state.siteConfig;
        });
    }
    return state.sitePromise;
  }

  function getDefaultShareText() {
    const p = T.getPersonalization();
    if (p.hasName) {
      return "اللهم اجعل هذا العمل صدقة جارية عن " + p.person + "، واغفر لمن أُهدي إليه، وارحم موتى المسلمين.";
    }
    if (state.siteConfig && state.siteConfig.defaultShareText) return state.siteConfig.defaultShareText;
    return "اللهم اجعل هذا العمل صدقة جارية، واغفر لمن أُهدي إليه، وارحم موتى المسلمين.";
  }

  function whatsappUrl(text) {
    return "https://wa.me/?text=" + encodeURIComponent(text);
  }

  async function copyText(text) {
    const value = String(text == null ? "" : text);
    try {
      if (navigator.clipboard && (window.isSecureContext || window.location.hostname === "localhost")) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {
      /* fall through */
    }
    const area = doc.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    doc.body.appendChild(area);
    let ok = false;
    try {
      area.select();
      area.setSelectionRange(0, area.value.length);
      ok = doc.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    area.remove();
    return ok;
  }

  function shareWhatsApp(text, options) {
    const url = getPublicUrl(options);
    const body = String(text == null || text === "" ? getDefaultShareText() : text);
    const full = url ? body + "\n\n" + url : body;
    const opened = window.open(whatsappUrl(full), "_blank", "noopener,noreferrer");
    if (!url) T.toast("تمت المشاركة دون رابط لأن الموقع لم يُنشر بعد.", "info");
    if (!opened) T.toast("اسمح بالنوافذ المنبثقة لفتح واتساب.", "error");
    return opened;
  }

  async function shareNative(options) {
    const opts = options || {};
    await loadSiteConfig();
    const url = getPublicUrl(opts);
    if (!url) {
      openQr(opts);
      T.toast("الموقع غير منشور بعد. أضف رابط النشر لإنشاء رابط مشاركة يعمل.", "info");
      return false;
    }
    const title = opts.title || (state.siteConfig && state.siteConfig.siteName) || "تسبيح — صدقة جارية";
    const text = opts.text || getDefaultShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: title, text: text, url: url });
        return true;
      } catch (error) {
        if (error && error.name === "AbortError") return false;
      }
    }
    const ok = await copyText(text + "\n\n" + url);
    T.toast(ok ? "تم نسخ نص المشاركة والرابط." : "تعذّر النسخ، جرّب تحديد الرابط يدويًا.", ok ? "success" : "error");
    return ok;
  }

  async function copyShareLink(options) {
    await loadSiteConfig();
    const url = getPublicUrl(options);
    if (!url) {
      openQr(options);
      T.toast("الموقع غير منشور بعد. أضف رابط النشر أولًا.", "info");
      return false;
    }
    const ok = await copyText(url);
    T.toast(ok ? "تم نسخ رابط المشاركة." : "تعذّر النسخ، جرّب تحديده يدويًا.", ok ? "success" : "error");
    return ok;
  }

  T.copyText = copyText;
  T.whatsappUrl = whatsappUrl;
  T.shareWhatsApp = shareWhatsApp;
  T.shareNative = shareNative;
  T.copyShareLink = copyShareLink;
  T.getPublicBase = getPublicBase;
  T.getPublicUrl = getPublicUrl;
  T.getPagePath = getPagePath;
  T.getDefaultShareText = getDefaultShareText;
  T.loadSiteConfig = loadSiteConfig;
  T.isLocalHostname = isLocalHostname;

  /* ---------- QR dialog ---------- */
  function ensureQrDialog() {
    if (state.qrDialog) return state.qrDialog;
    const dialog = doc.createElement("dialog");
    dialog.className = "dialog dialog--wide";
    dialog.id = "qr-dialog";
    dialog.setAttribute("aria-labelledby", "qr-title");
    dialog.innerHTML =
      '<div class="dialog__panel">' +
        '<button type="button" class="dialog__close" data-close-dialog aria-label="إغلاق">' + T.icon("close") + "</button>" +
        '<div class="dialog__head">' +
          '<p class="eyebrow">مشاركة الأجر</p>' +
          '<h2 id="qr-title">رمز QR للمشاركة</h2>' +
          "<p>امسح الرمز بكاميرا الهاتف لفتح الموقع مع الإهداء الشخصي.</p>" +
        "</div>" +
        '<div class="dialog__body">' +
          '<div class="qr-wrap" data-qr-content hidden>' +
            '<div class="qr-frame"><canvas id="qr-canvas" width="600" height="600" role="img" aria-label="رمز QR لرابط المشاركة"></canvas></div>' +
            '<p class="qr-url" data-qr-url dir="ltr"></p>' +
            '<div class="qr-actions">' +
              '<button class="btn btn--primary" type="button" data-qr-download>' + T.icon("download") + "تحميل PNG</button>" +
              '<button class="btn btn--outline" type="button" data-qr-copy>' + T.icon("copy") + "نسخ الرابط</button>" +
              '<button class="btn btn--outline" type="button" data-qr-share>' + T.icon("share") + "مشاركة</button>" +
              '<button class="btn btn--ghost" type="button" data-qr-change-url>تغيير رابط الموقع</button>' +
            "</div>" +
          "</div>" +
          '<div data-qr-empty>' +
            '<div class="qr-placeholder">' +
              T.icon("qr") +
              "<h3>الرمز يحتاج رابطًا منشورًا</h3>" +
              "<p>لن نستخدم رابط localhost في رمز QR. انشر الموقع على GitHub Pages أو Cloudflare Pages، ثم ألصق الرابط هنا.</p>" +
            "</div>" +
            '<div class="qr-setup">' +
              '<div class="field">' +
                '<label for="public-url">رابط الموقع المنشور</label>' +
                '<input class="input" id="public-url" data-public-url-input type="url" inputmode="url" dir="ltr" autocomplete="url" placeholder="https://username.github.io/sadka/">' +
                '<p class="field__error" data-public-url-error hidden></p>' +
              "</div>" +
              '<button class="btn btn--primary" type="button" data-save-public-url>استخدام هذا الرابط</button>' +
              '<button class="btn btn--ghost" type="button" data-clear-public-url hidden>استخدام الرابط التلقائي</button>' +
              '<p class="form-note">يُحفظ الرابط على جهازك فقط. تأكد أنه رابط عام يبدأ بـ https:// ولا يحتوي localhost أو عنوانًا محليًا.</p>' +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>";
    doc.body.appendChild(dialog);
    state.qrDialog = dialog;
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) T.closeDialog(dialog);
    });
    dialog.addEventListener("close", function () {
      doc.body.classList.remove("dialog-open");
    });

    dialog.querySelector("[data-save-public-url]").addEventListener("click", function () {
      const input = dialog.querySelector("[data-public-url-input]");
      const error = dialog.querySelector("[data-public-url-error]");
      const normalized = normalizePublicBase(input.value);
      if (!normalized) {
        if (error) {
          error.hidden = false;
          error.textContent = "أدخل رابطًا عامًا صحيحًا يبدأ بـ http:// أو https://، ولا تستخدم localhost أو عنوانًا محليًا.";
        }
        input.classList.add("is-invalid");
        input.focus();
        return;
      }
      input.classList.remove("is-invalid");
      if (error) error.hidden = true;
      T.storageSet(STORAGE.publicUrl, normalized);
      refreshQr();
      T.toast("تم حفظ رابط الموقع المنشور على هذا الجهاز.", "success");
    });

    dialog.querySelector("[data-clear-public-url]").addEventListener("click", function () {
      T.storageRemove(STORAGE.publicUrl);
      refreshQr();
      T.toast("تمت العودة إلى الرابط التلقائي.", "info");
    });

    dialog.querySelector("[data-qr-change-url]").addEventListener("click", function () {
      showQrSetup(true);
    });

    dialog.querySelector("[data-qr-download]").addEventListener("click", function () {
      if (!state.qrCanvas || !state.qrUrl) {
        T.toast("لم يُنشأ رمز QR بعد.", "error");
        return;
      }
      state.qrCanvas.toBlob(function (blob) {
        if (!blob) {
          T.toast("تعذّر إنشاء ملف الصورة.", "error");
          return;
        }
        T.downloadBlob(blob, "tasbeeh-qr.png");
        T.toast("تم تحميل رمز QR.", "success");
      }, "image/png");
    });

    dialog.querySelector("[data-qr-copy]").addEventListener("click", async function () {
      if (!state.qrUrl) return;
      const ok = await copyText(state.qrUrl);
      T.toast(ok ? "تم نسخ رابط المشاركة." : "تعذّر النسخ.", ok ? "success" : "error");
    });

    dialog.querySelector("[data-qr-share]").addEventListener("click", async function () {
      if (!state.qrUrl) return;
      if (navigator.share) {
        try {
          await navigator.share({
            title: "تسبيح — صدقة جارية",
            text: getDefaultShareText(),
            url: state.qrUrl
          });
          return;
        } catch (error) {
          if (error && error.name === "AbortError") return;
        }
      }
      const ok = await copyText(state.qrUrl);
      T.toast(ok ? "تم نسخ رابط المشاركة." : "تعذّر النسخ.", ok ? "success" : "error");
    });

    return dialog;
  }

  function showQrSetup(show) {
    const dialog = state.qrDialog;
    if (!dialog) return;
    const content = dialog.querySelector("[data-qr-content]");
    const empty = dialog.querySelector("[data-qr-empty]");
    const input = dialog.querySelector("[data-public-url-input]");
    const clear = dialog.querySelector("[data-clear-public-url]");
    const current = getPublicBase();
    if (content) content.hidden = show;
    if (empty) empty.hidden = false;
    if (input) {
      input.value = current || "";
      input.classList.remove("is-invalid");
      setTimeout(function () { input.focus(); }, 50);
    }
    if (clear) clear.hidden = !T.storageGet(STORAGE.publicUrl, "");
  }

  function loadQrLibrary() {
    if (window.qrcode) return Promise.resolve();
    if (state.qrLibPromise) return state.qrLibPromise;
    state.qrLibPromise = new Promise(function (resolve, reject) {
      const script = doc.createElement("script");
      script.src = root + "assets/js/vendor/qrcode.js";
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        state.qrLibPromise = null;
        reject(new Error("تعذّر تحميل مكتبة رمز QR"));
      };
      doc.head.appendChild(script);
    });
    return state.qrLibPromise;
  }

  function renderQr(url) {
    const dialog = state.qrDialog;
    if (!dialog) return;
    const canvas = dialog.querySelector("#qr-canvas");
    if (!canvas) return;
    loadQrLibrary().then(function () {
      try {
        const qr = window.qrcode(0, "M");
        qr.addData(url, "Byte");
        qr.make();
        const count = qr.getModuleCount();
        const quiet = 4;
        const scale = 14;
        const size = (count + quiet * 2) * scale;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size, size);
        context.fillStyle = "#06251b";
        for (let row = 0; row < count; row += 1) {
          for (let col = 0; col < count; col += 1) {
            if (qr.isDark(row, col)) {
              context.fillRect((col + quiet) * scale, (row + quiet) * scale, scale, scale);
            }
          }
        }
        state.qrCanvas = canvas;
      } catch (error) {
        T.toast("تعذّر إنشاء رمز QR لهذا الرابط.", "error");
      }
    }).catch(function () {
      T.toast("تعذّر تحميل أداة رمز QR. تحقق من الاتصال.", "error");
    });
  }

  function refreshQr() {
    const dialog = state.qrDialog;
    if (!dialog) return;
    const content = dialog.querySelector("[data-qr-content]");
    const empty = dialog.querySelector("[data-qr-empty]");
    const urlElement = dialog.querySelector("[data-qr-url]");
    const input = dialog.querySelector("[data-public-url-input]");
    const clear = dialog.querySelector("[data-clear-public-url]");
    const url = getPublicUrl({ path: state.qrPath, hash: state.qrHash });
    state.qrUrl = url;
    if (!url) {
      if (content) content.hidden = true;
      if (empty) empty.hidden = false;
      if (input) input.value = "";
      if (clear) clear.hidden = true;
      return;
    }
    if (content) content.hidden = false;
    if (empty) empty.hidden = true;
    if (urlElement) urlElement.textContent = url;
    if (input) input.value = getPublicBase();
    if (clear) clear.hidden = !T.storageGet(STORAGE.publicUrl, "");
    renderQr(url);
  }

  async function openQr(options) {
    const opts = options || {};
    await loadSiteConfig();
    state.qrPath = opts.path == null ? getPagePath() : opts.path;
    state.qrHash = opts.hash || "";
    const dialog = ensureQrDialog();
    T.openDialog(dialog);
    refreshQr();
  }

  T.openQr = openQr;

  /* ---------- Install / PWA ---------- */
  function ensureInstallDialog() {
    if (state.installDialog) return state.installDialog;
    const dialog = doc.createElement("dialog");
    dialog.className = "dialog";
    dialog.id = "install-dialog";
    dialog.setAttribute("aria-labelledby", "install-title");
    dialog.innerHTML =
      '<div class="dialog__panel">' +
        '<button type="button" class="dialog__close" data-close-dialog aria-label="إغلاق">' + T.icon("close") + "</button>" +
        '<div class="dialog__head">' +
          '<p class="eyebrow">تطبيق الويب</p>' +
          '<h2 id="install-title">ثبّت تسبيح على جهازك</h2>' +
          "<p>يعمل التطبيق دون اتصال بعد أول زيارة، ويفتح من الشاشة الرئيسية كتطبيق مستقل.</p>" +
        "</div>" +
        '<div class="dialog__body">' +
          '<ol class="install-steps">' +
            "<li><strong>على أندرويد (Chrome):</strong> افتح قائمة المتصفح ثم «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</li>" +
            "<li><strong>على آيفون (Safari):</strong> اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».</li>" +
            "<li><strong>على الكمبيوتر (Chrome أو Edge):</strong> اضغط أيقونة التثبيت في شريط العنوان، أو اختر «تثبيت تسبيح» من القائمة.</li>" +
          "</ol>" +
          '<p class="form-note">إذا لم يظهر خيار التثبيت، فتأكد أنك تفتح الموقع عبر https وليس داخل نافذة خاصة.</p>' +
        "</div>" +
      "</div>";
    doc.body.appendChild(dialog);
    state.installDialog = dialog;
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) T.closeDialog(dialog);
    });
    dialog.addEventListener("close", function () {
      doc.body.classList.remove("dialog-open");
    });
    return dialog;
  }

  async function installApp() {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      T.toast("التطبيق مثبت ويعمل بالفعل.", "info");
      return;
    }
    if (state.deferredPrompt) {
      const prompt = state.deferredPrompt;
      state.deferredPrompt = null;
      try {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === "accepted") T.toast("تم تثبيت التطبيق، بارك الله فيك.", "success");
      } catch (error) {
        T.toast("تعذّر فتح نافذة التثبيت. جرّب من قائمة المتصفح.", "error");
      }
      return;
    }
    T.openDialog(ensureInstallDialog());
  }

  T.installApp = installApp;

  function initInstall() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      state.deferredPrompt = event;
    });
    window.addEventListener("appinstalled", function () {
      state.deferredPrompt = null;
      T.toast("تم تثبيت تطبيق تسبيح.", "success");
    });
    $$("[data-install-app]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        installApp();
      });
    });
  }

  function showUpdateToast(registration) {
    T.toast("يتوفر إصدار جديد من الموقع.", "info", {
      actionLabel: "تحديث",
      duration: 0,
      onAction: function () {
        if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
        else window.location.reload();
      }
    });
  }

  function initServiceWorker() {
    if (!("serviceWorker" in navigator) || !/^https?:$/.test(window.location.protocol)) return;
    state.hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!state.hadController) {
        state.hadController = true;
        return;
      }
      if (state.reloading) return;
      state.reloading = true;
      window.location.reload();
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(root + "sw.js", { scope: root }).then(function (registration) {
        state.swRegistration = registration;
        registration.addEventListener("updatefound", function () {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast(registration);
            }
          });
        });
      }).catch(function () {
        /* PWA is an enhancement; ignore registration errors */
      });
    });
  }

  /* ---------- Generic triggers ---------- */
  function initShareTriggers() {
    $$("[data-open-share]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        const path = button.hasAttribute("data-share-path") ? button.dataset.sharePath : undefined;
        shareNative({
          path: path,
          title: button.dataset.shareTitle || undefined,
          text: button.dataset.shareText || undefined
        });
      });
    });
    $$("[data-share-whatsapp]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        const path = button.hasAttribute("data-share-path") ? button.dataset.sharePath : undefined;
        shareWhatsApp(button.dataset.shareText || getDefaultShareText(), { path: path });
      });
    });
    $$("[data-copy-link]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        const path = button.hasAttribute("data-share-path") ? button.dataset.sharePath : undefined;
        copyShareLink({ path: path });
      });
    });
    $$("[data-open-qr]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        const path = button.hasAttribute("data-qr-path") ? button.dataset.qrPath : undefined;
        openQr({ path: path });
      });
    });
  }

  function init() {
    loadSiteConfig();
    initShareTriggers();
    initInstall();
    initServiceWorker();
    doc.dispatchEvent(new CustomEvent("tasbeeh:share-ready"));
  }

  T.shareReady = true;
  init();
})();
