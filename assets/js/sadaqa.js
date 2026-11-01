/* =========================================================
   بطاقة الإهداء — تحديث البطاقة وتحميلها صورة PNG
   ========================================================= */
(function () {
  "use strict";

  const T = window.Tasbeeh;
  if (!T) return;

  const card = T.$("[data-sadaqa-card]");
  if (!card) return;

  const downloadButton = T.$("[data-sadaqa-download]");
  const nameNode = T.$("[data-dedication-name]");
  const duaNode = card.querySelector('[data-dedication="full"]');

  const GOLD = "#d8b877";
  const GOLD_DEEP = "#b08a4a";
  const IVORY = "#fbf6ea";
  const EMERALD = "#0b3b2e";
  const EMERALD_DARK = "#06251b";

  let qrLibPromise = null;

  function pulseCard() {
    card.classList.remove("is-pulsing");
    void card.offsetWidth;
    card.classList.add("is-pulsing");
    window.setTimeout(function () { card.classList.remove("is-pulsing"); }, 900);
  }

  document.addEventListener("tasbeeh:personalized", pulseCard);
  document.addEventListener("tasbeeh:core-ready", function () {
    if (nameNode) nameNode.textContent = T.getPersonalization().hasName ? T.getPersonalization().person : "موتى المسلمين";
    if (duaNode) {
      duaNode.textContent = T.getPersonalization().hasName
        ? "اللهم اجعل هذا العمل صدقة جارية عن " + T.getPersonalization().person + "، واغفر لمن أُهدي إليه، وارحم موتى المسلمين."
        : "اللهم اجعل هذا العمل صدقة جارية عن موتى المسلمين، واغفر لمن أُهدي إليه، وارحم موتى المسلمين.";
    }
  });

  function ensureQrLib() {
    if (window.qrcode) return Promise.resolve();
    if (qrLibPromise) return qrLibPromise;
    qrLibPromise = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = T.root + "assets/js/vendor/qrcode.js";
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        qrLibPromise = null;
        reject(new Error("QR library failed"));
      };
      document.head.appendChild(script);
    });
    return qrLibPromise;
  }

  function drawStar(ctx, cx, cy, outer, inner, points) {
    const total = (points || 8) * 2;
    ctx.beginPath();
    for (let i = 0; i < total; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / (points || 8)) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach(function (word) {
      const test = line ? line + " " + word : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawCenteredLines(ctx, lines, centerX, startY, lineHeight) {
    lines.forEach(function (line, index) {
      ctx.fillText(line, centerX, startY + index * lineHeight);
    });
  }

  function drawQr(ctx, url, x, y, size) {
    const qr = window.qrcode(0, "M");
    qr.addData(url, "Byte");
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 4;
    const module = size / (count + quiet * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = EMERALD_DARK;
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(
            x + (col + quiet) * module,
            y + (row + quiet) * module,
            Math.ceil(module),
            Math.ceil(module)
          );
        }
      }
    }
  }

  async function getQrUrl() {
    try {
      await T.loadSiteConfig();
      return T.getPublicUrl({ path: "pages/sadaqa.html" });
    } catch (error) {
      return "";
    }
  }

  async function renderCard() {
    const personalization = T.getPersonalization();
    const person = personalization.hasName ? personalization.person : "موتى المسلمين";
    const dedication = personalization.hasName
      ? "اللهم اجعل هذا العمل صدقة جارية عن " + person + "، واغفر لمن أُهدي إليه، وارحم موتى المسلمين."
      : "اللهم اجعل هذا العمل صدقة جارية عن موتى المسلمين، واغفر لمن أُهدي إليه، وارحم موتى المسلمين.";

    try {
      if (document.fonts && document.fonts.load) {
        await Promise.all([
          document.fonts.load('700 84px "Amiri"'),
          document.fonts.load('400 36px "Amiri"'),
          document.fonts.load('400 26px "IBM Plex Sans Arabic"'),
          document.fonts.load('600 26px "IBM Plex Sans Arabic"')
        ]);
      }
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (error) {
      /* Continue with fallback fonts. */
    }

    const qrUrl = await getQrUrl();
    let qrReady = false;
    if (qrUrl) {
      try {
        await ensureQrLib();
        qrReady = true;
      } catch (error) {
        qrReady = false;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");

    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const background = ctx.createLinearGradient(0, 0, 1080, 1350);
    background.addColorStop(0, "#0d4636");
    background.addColorStop(0.55, EMERALD);
    background.addColorStop(1, EMERALD_DARK);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1080, 1350);

    // Soft pattern of eight-point stars.
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        drawStar(ctx, 150 + col * 270, 190 + row * 260, 24, 9, 8);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Gold frame.
    ctx.strokeStyle = GOLD;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 3;
    ctx.strokeRect(34, 34, 1012, 1282);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.strokeRect(48, 48, 984, 1254);
    ctx.globalAlpha = 1;

    // Corner stars.
    ctx.fillStyle = GOLD;
    [[62, 62], [1018, 62], [62, 1288], [1018, 1288]].forEach(function (point) {
      drawStar(ctx, point[0], point[1], 13, 5, 8);
      ctx.fill();
    });

    // Seal.
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(540, 166, 58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    drawStar(ctx, 540, 166, 31, 12, 8);
    ctx.fill();
    ctx.fillStyle = EMERALD;
    drawStar(ctx, 540, 166, 10, 4, 8);
    ctx.fill();

    ctx.fillStyle = GOLD;
    ctx.font = '600 27px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText("بطاقة إهداء — صدقة جارية", 540, 276);

    ctx.fillStyle = IVORY;
    ctx.font = '700 84px "Amiri", serif';
    ctx.fillText("صدقة جارية", 540, 390);

    ctx.fillStyle = GOLD;
    ctx.font = '700 50px "Amiri", serif';
    const nameLines = wrapText(ctx, "عن " + person, 840);
    const nameStart = 478;
    drawCenteredLines(ctx, nameLines.slice(0, 2), 540, nameStart, 62);

    const dividerY = nameStart + Math.min(nameLines.length, 2) * 62 + 22;
    ctx.strokeStyle = GOLD;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(240, dividerY);
    ctx.lineTo(470, dividerY);
    ctx.moveTo(610, dividerY);
    ctx.lineTo(840, dividerY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = GOLD;
    drawStar(ctx, 540, dividerY, 13, 5, 8);
    ctx.fill();

    ctx.fillStyle = IVORY;
    ctx.font = '400 37px "Amiri", serif';
    const duaLines = wrapText(ctx, dedication, 820);
    const duaStart = dividerY + 72;
    drawCenteredLines(ctx, duaLines, 540, duaStart, 62);

    const duaEnd = duaStart + (duaLines.length - 1) * 62;

    // Footer.
    const footerY = Math.max(1110, duaEnd + 120);
    ctx.strokeStyle = GOLD;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(170, footerY);
    ctx.lineTo(910, footerY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = GOLD;
    ctx.font = '600 27px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText("اللهم اجعل هذا العمل صدقة جارية", 540, footerY + 54);
    ctx.fillStyle = "rgba(251, 246, 234, 0.72)";
    ctx.font = '400 22px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText("واغفر لمن أُهدي إليه، وارحم موتى المسلمين", 540, footerY + 90);

    if (qrReady && qrUrl) {
      const qrSize = 168;
      drawQr(ctx, qrUrl, 110, 1136, qrSize);
      ctx.fillStyle = GOLD;
      ctx.font = '600 20px "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = "right";
      ctx.fillText("امسح الرمز للزيارة", 950, 1194);
      ctx.fillStyle = "rgba(251, 246, 234, 0.72)";
      ctx.font = '400 18px "IBM Plex Sans Arabic", sans-serif';
      const displayUrl = qrUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const urlLines = wrapText(ctx, displayUrl, 600);
      drawCenteredLines(ctx, urlLines.slice(0, 2), 690, 1234, 26);
      ctx.textAlign = "center";
    } else {
      ctx.fillStyle = "rgba(251, 246, 234, 0.62)";
      ctx.font = '400 21px "IBM Plex Sans Arabic", sans-serif';
      ctx.fillText("تسبيح — مساحة هادئة للدعاء والذكر والصدقة", 540, 1240);
    }

    ctx.fillStyle = "rgba(251, 246, 234, 0.38)";
    ctx.font = '400 17px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText("هذه البطاقة دعاء عام، وليست حديثًا عن النبي ﷺ", 540, 1304);

    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("تعذّر إنشاء الصورة"));
      }, "image/png");
    });
  }

  if (downloadButton) {
    downloadButton.addEventListener("click", async function () {
      if (downloadButton.disabled) return;
      const label = downloadButton.querySelector("span") || downloadButton;
      const original = label.textContent;
      downloadButton.disabled = true;
      label.textContent = "جارٍ تجهيز البطاقة…";
      try {
        const blob = await renderCard();
        T.downloadBlob(blob, "tasbeeh-sadaqa-card.png");
        T.toast("تم تحميل بطاقة الإهداء. شاركها وادعُ لمن تحب.", "success");
      } catch (error) {
        T.toast("تعذّر إنشاء البطاقة. جرّب متصفحًا آخر أو تحقق من إعدادات الصور.", "error");
      } finally {
        downloadButton.disabled = false;
        label.textContent = original;
      }
    });
  }
})();
