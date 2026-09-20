/* ==========================================================================
   Birthday NFC — script.js
   Plain browser JavaScript. No build step, no dependencies, no network calls.

   ┌───────────────────────────────────────────────────────────────────────┐
   │  EVERYTHING YOU NEED TO EDIT IS IN THE `CONFIG` OBJECT BELOW.          │
   │  只改下面这一个 CONFIG，就能改：生日密码 / 名字 / 标题 / 祝福正文 /     │
   │  照片 / 音乐 / 视频 / 彩蛋。                                          │
   └───────────────────────────────────────────────────────────────────────┘

   Assets are auto-detected: drop a file at the path shown in CONFIG and the
   matching section appears by itself. If the file is absent, that section is
   silently skipped — no broken images, no empty buttons.
   ========================================================================== */

const CONFIG = {

  /* --- 1. The password: MMDD of the birthday. Change this one line. ------- */
  birthdayPassword: "1013",

  /* --- 2. Names ---------------------------------------------------------- */
  recipientName: "Friend",          // shown in the headline
  senderName: "Yuchen",             // signature at the end of the letter

  /* --- 3. Lock screen --------------------------------------------------- */
  gate: {
    title: "A little surprise for you",
    subtitle: "Enter your birthday to continue",
    buttonLabel: "Open my gift",
    inputAriaLabel: "Your birthday, four digits MMDD",
    hint: "Four digits — month, then day.",
    // Shown for a wrong code. Avoid putting the real date in here.
    wrongMessage: "Hmm… 再想想你的生日 😌",
  },

  /* --- 4. The gift text -------------------------------------------------- */
  gift: {
    title: "Happy Birthday 🎂",     // {name} is replaced with recipientName
    subtitle: "You made it. Here is what I wanted to say.",
  },

  /* Write paragraphs as separate strings. They render as <p> tags. */
  message: [
    "希望你新的一岁每天都开心，想做的事情都能顺利实现。",
    "这个小礼物里藏了这一段话，希望你看到的时候会笑一下。",
  ],

  /* --- 5. One main photo (optional) ------------------------------------- */
  photo: {
    enabled: true,                  // set false to hide forever
    src: "assets/photo.jpg",        // ← drop your photo here
    fallback: ["assets/photo.jpeg", "assets/photo.png", "assets/photo.webp"],
    caption: "",                    // optional line under the photo
    alt: "A photo of us",           // for screen readers
  },

  /* --- 6. Photo gallery (optional) -------------------------------------- */
  gallery: {
    enabled: true,
    title: "Moments",
    // Each item: { src, alt }. Any that fail to load are skipped.
    photos: [
      { src: "assets/gallery-1.jpg", alt: "" },
      { src: "assets/gallery-2.jpg", alt: "" },
      { src: "assets/gallery-3.jpg", alt: "" },
      { src: "assets/gallery-4.jpg", alt: "" },
    ],
  },

  /* --- 7. Music (optional, never autoplays — Safari blocks that) -------- */
  music: {
    enabled: true,
    buttonLabel: "Play our song",
    note: "Tap play when you're ready.",
    /*
      Paste ONE of these two. Leave both empty and the music section stays hidden.

      embedUrl : Spotify / Apple Music / YouTube / SoundCloud — the *embed* URL,
                 not the normal share link. Shown in an iframe, loaded on tap.
      audioFile: a local file, e.g. "assets/song.mp3" — played by the native
                 <audio> control. Best choice if you actually have the file.
    */
    embedUrl: "",
    audioFile: "",
  },

  /* --- 8. Video (optional, collapsed by default) ------------------------ */
  video: {
    enabled: true,
    buttonLabel: "There's a video too",
    embedUrl: "",                   // YouTube embed URL, or leave empty
    videoFile: "",                  // e.g. "assets/video.mp4"
  },

  /* --- 9. Easter egg (optional) ----------------------------------------- */
  egg: {
    enabled: true,
    buttonLabel: "还有一个小彩蛋",
    title: "彩蛋时间 🥚",
    paragraphs: [
      "如果你看到这里了，那说明你真的很有耐心。",
      "其实最想说的只有一句：认识你很高兴。",
    ],
  },

  /* --- 10. Behaviour ---------------------------------------------------- */
  /* true  = reopening the link inside the same browser stays unlocked.
     false = ask for the date every single time.                            */
  rememberUnlock: true,
  confetti: true,                   // small celebration burst on unlock
  confettiCount: 34,
};

/* ==========================================================================
   Implementation — you shouldn't need to touch anything below this line.
   ========================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "birthday-nfc:unlocked";

  /* Local preview helper only. On a local server you can open
     http://localhost:8080/?vw=390&vh=844 to force an iPhone-sized viewport
     without a device emulator. Never active on the deployed site. */
  (function localViewportPreview() {
    var host = location.hostname;
    var isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "";
    if (!isLocal) return;

    var params = new URLSearchParams(location.search);
    var vw = parseInt(params.get("vw"), 10);
    var vh = parseInt(params.get("vh"), 10);
    if (!vw || !vh) return;

    document.documentElement.style.width = vw + "px";
    document.documentElement.style.height = vh + "px";
    document.documentElement.style.overflow = "hidden";
  })();

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  function motionOK() {
    return !window.matchMedia ||
           !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* localStorage can throw in private mode or for file:// pages. */
  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function storageRemove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function fill(text) {
    return String(text == null ? "" : text).replace(/\{name\}/g, CONFIG.recipientName);
  }

  function paragraph(text, className) {
    var p = document.createElement("p");
    if (className) p.className = className;
    p.textContent = fill(text);
    return p;
  }

  /* --- text bound to CONFIG via data-cfg="a.b.c" attributes -------------- */
  function applyDataConfig() {
    $$("[data-cfg]").forEach(function (el) {
      var value = el.getAttribute("data-cfg").split(".").reduce(function (acc, key) {
        return acc == null ? acc : acc[key];
      }, CONFIG);
      if (typeof value === "string") el.textContent = fill(value);
    });
    $$("[data-cfg-aria]").forEach(function (el) {
      var value = el.getAttribute("data-cfg-aria").split(".").reduce(function (acc, key) {
        return acc == null ? acc : acc[key];
      }, CONFIG);
      if (typeof value === "string") el.setAttribute("aria-label", fill(value));
    });
  }

  /* --- optional media ---------------------------------------------------- */

  /* Try each candidate path in order; resolve with the first one that loads. */
  function loadFirstAvailable(sources, apply) {
    return new Promise(function (resolve) {
      var list = sources.filter(Boolean);
      (function attempt(i) {
        if (i >= list.length) { resolve(null); return; }
        var probe = new Image();
        probe.onload  = function () { apply(list[i], probe); resolve(list[i]); };
        probe.onerror = function () { attempt(i + 1); };
        probe.src = list[i];
      })(0);
    });
  }

  function mountPhoto() {
    var cfg = CONFIG.photo;
    var block = $("#photoBlock");
    if (!cfg || !block) return;
    if (cfg.enabled === false) { block.hidden = true; return; }

    loadFirstAvailable([cfg.src].concat(cfg.fallback || []), function (src, img) {
      var el = $("#mainPhoto");
      el.src = src;
      el.alt = cfg.alt || "";
      if (img && img.naturalWidth) el.width = img.naturalWidth;
      if (cfg.caption) {
        $("#mainPhotoCaption").textContent = fill(cfg.caption);
      } else {
        $("#mainPhotoCaption").hidden = true;
      }
      block.hidden = false;
    });
  }

  function mountGallery() {
    var cfg = CONFIG.gallery;
    var block = $("#galleryBlock");
    var list = $("#galleryList");
    if (!cfg || !block || !list) return;
    if (cfg.enabled === false || !cfg.photos || !cfg.photos.length) {
      block.hidden = true;
      return;
    }

    var added = 0;
    var pending = cfg.photos.length;

    cfg.photos.forEach(function (item) {
      var src = typeof item === "string" ? item : item && item.src;
      if (!src) { if (--pending === 0 && added) block.hidden = false; return; }

      var probe = new Image();
      probe.onload = function () {
        var li = document.createElement("li");
        li.className = "gallery__item";
        var img = document.createElement("img");
        img.src = src;
        img.alt = (item && item.alt) || "";
        img.loading = "lazy";
        img.decoding = "async";
        li.appendChild(img);
        list.appendChild(li);
        added++;
        if (--pending === 0 && added) block.hidden = false;
      };
      probe.onerror = function () {
        if (--pending === 0 && added) block.hidden = false;
      };
      probe.src = src;
    });

    block.hidden = true;   // revealed only if at least one photo survives
  }

  /* YouTube embed URLs may come with query params; keep only the video id. */
  function youtubeId(url) {
    var m = String(url).match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : "";
  }

  function makeFrame(src, title) {
    var frame = document.createElement("iframe");
    frame.src = src;
    frame.loading = "lazy";
    frame.title = title;
    frame.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    frame.setAttribute("allowfullscreen", "");
    return frame;
  }

  function mountMusic() {
    var cfg = CONFIG.music;
    var block = $("#musicBlock");
    if (!cfg || !block) return;

    var panel = $("#musicPanel");
    var embedBox = $("#musicEmbed");
    var audio = $("#musicAudio");
    var note = $("#musicNote");
    var hasEmbed = !!cfg.embedUrl;
    var hasAudio = !!cfg.audioFile;

    if (cfg.enabled === false || (!hasEmbed && !hasAudio)) {
      block.hidden = true;
      return;
    }

    /* The iframe is injected on first tap, so nothing loads until then. */
    $("#musicBtn").addEventListener("click", function () {
      var open = this.getAttribute("aria-expanded") === "true";
      this.setAttribute("aria-expanded", open ? "false" : "true");
      panel.hidden = open;
      if (!open) {
        if (hasEmbed && !embedBox.firstChild) {
          embedBox.appendChild(makeFrame(cfg.embedUrl, "Music player"));
          embedBox.hidden = false;
        }
        if (hasAudio) {
          if (!audio.getAttribute("src")) audio.setAttribute("src", cfg.audioFile);
          audio.hidden = false;
          audio.play().catch(function () { /* user can press play manually */ });
        }
      } else if (hasAudio) {
        audio.pause();
      }
    });

    if (cfg.note) note.textContent = fill(cfg.note); else note.hidden = true;
    block.hidden = false;
  }

  function mountVideo() {
    var cfg = CONFIG.video;
    var block = $("#videoBlock");
    if (!cfg || !block) return;

    var id = cfg.embedUrl ? youtubeId(cfg.embedUrl) : "";
    var embedSrc = id ? "https://www.youtube-nocookie.com/embed/" + id : "";
    var hasEmbed = !!embedSrc;
    var hasFile = !!cfg.videoFile;

    if (cfg.enabled === false || (!hasEmbed && !hasFile)) {
      block.hidden = true;
      return;
    }

    var panel = $("#videoPanel");
    $("#videoBtn").addEventListener("click", function () {
      var open = this.getAttribute("aria-expanded") === "true";
      this.setAttribute("aria-expanded", open ? "false" : "true");
      panel.hidden = open;
      if (!open) {
        if (hasEmbed) {
          var box = $("#videoEmbed");
          if (!box.firstChild) box.appendChild(makeFrame(embedSrc, "Video"));
          box.hidden = false;
        }
        if (hasFile) {
          var file = $("#videoFile");
          if (!file.getAttribute("src")) file.setAttribute("src", cfg.videoFile);
          file.hidden = false;
        }
      }
    });

    block.hidden = false;
  }

  function mountEgg() {
    var cfg = CONFIG.egg;
    var block = $("#eggBlock");
    if (!cfg || !block) return;
    if (cfg.enabled === false || !cfg.paragraphs || !cfg.paragraphs.length) {
      block.hidden = true;
      return;
    }

    var panel = $("#eggPanel");
    $("#eggTitle").textContent = fill(cfg.title);
    cfg.paragraphs.forEach(function (text) {
      $("#eggBody").appendChild(paragraph(text));
    });

    $("#eggBtn").addEventListener("click", function () {
      var open = this.getAttribute("aria-expanded") === "true";
      this.setAttribute("aria-expanded", open ? "false" : "true");
      panel.hidden = open;
    });

    block.hidden = false;
  }

  function mountGift() {
    $("#giftTitle").textContent = fill(CONFIG.gift.title);
    $("#senderName").textContent = fill(CONFIG.senderName);

    var body = $("#messageBody");
    (CONFIG.message || []).forEach(function (text) {
      body.appendChild(paragraph(text));
    });

    mountPhoto();
    mountGallery();
  }

  /* --- confetti ---------------------------------------------------------- */
  function celebrate() {
    if (!CONFIG.confetti || !motionOK()) return;
    var layer = $("#confetti");
    if (!layer) return;

    var colors = ["#e8978f", "#f2c39b", "#d9a7bd", "#e9d29b", "#c98d86", "#f6e0d2"];
    var count = CONFIG.confettiCount || 30;

    for (var i = 0; i < count; i++) {
      var bit = document.createElement("i");
      var size = 6 + Math.random() * 7;
      bit.style.left = (Math.random() * 100).toFixed(2) + "%";
      bit.style.width = size.toFixed(1) + "px";
      bit.style.height = (size * (Math.random() < 0.4 ? 0.45 : 1)).toFixed(1) + "px";
      bit.style.background = colors[i % colors.length];
      bit.style.opacity = (0.65 + Math.random() * 0.35).toFixed(2);
      bit.style.setProperty("--drift", ((Math.random() - 0.5) * 120).toFixed(0) + "px");
      bit.style.setProperty("--spin", (360 + Math.random() * 720).toFixed(0) + "deg");
      bit.style.animationDuration = (2.6 + Math.random() * 2.1).toFixed(2) + "s";
      bit.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
      layer.appendChild(bit);
    }

    window.setTimeout(function () { layer.textContent = ""; }, 6000);
  }

  /* --- unlock ------------------------------------------------------------ */
  var unlocked = false;

  function unlock(options) {
    if (unlocked) return;
    unlocked = true;
    var animate = !options || options.animate !== false;

    var gate = $("#gate");
    var gift = $("#gift");

    gift.hidden = false;
    if (animate && motionOK()) gift.classList.add("is-entering");

    if (animate && motionOK()) {
      gate.classList.add("is-leaving");
      window.setTimeout(function () { gate.hidden = true; }, 330);
    } else {
      gate.hidden = true;
    }

    if (animate) {
      if (CONFIG.rememberUnlock) storageSet(STORAGE_KEY, "1");
      celebrate();
    }

    /* Move focus somewhere sensible for screen readers and keyboards. */
    window.setTimeout(function () {
      var title = $("#giftTitle");
      title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "auto" });
    }, animate ? 380 : 0);
  }

  /* --- the lock screen --------------------------------------------------- */
  function wireGate() {
    var form = $("#gateForm");
    var input = $("#birthdayInput");
    var button = $("#gateSubmit");
    var error = $("#gateError");
    var busy = false;

    /* Digits only — iOS shows the numeric keypad thanks to inputmode="numeric". */
    input.addEventListener("input", function () {
      var clean = input.value.replace(/[^0-9]/g, "").slice(0, 4);
      if (clean !== input.value) input.value = clean;
      if (error.textContent) clearError();
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit ? form.requestSubmit() : submit();
      }
    });

    function clearError() {
      error.textContent = "";
      error.classList.remove("is-on");
    }

    function showError() {
      error.textContent = fill(CONFIG.gate.wrongMessage);
      error.classList.add("is-on");
      input.classList.remove("is-shaking");
      void input.offsetWidth;                   // restart the shake animation
      if (motionOK()) input.classList.add("is-shaking");
      input.select();
      input.focus({ preventScroll: true });
    }

    function submit() {
      if (busy || unlocked) return;
      var entered = input.value.replace(/[^0-9]/g, "");

      if (!entered) {
        input.focus({ preventScroll: true });
        return;
      }
      if (entered !== String(CONFIG.birthdayPassword)) {
        showError();
        return;
      }

      /* Correct. A short beat makes the unlock feel intentional. */
      busy = true;
      clearError();
      button.disabled = true;
      window.setTimeout(function () { unlock({ animate: true }); }, 180);
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submit();
    });

    input.focus({ preventScroll: true });
  }

  /* --- boot -------------------------------------------------------------- */
  function boot() {
    /* Opening the page with ?forget=1 locks it again. Handy when you want to
       re-check the lock screen on a device that already unlocked itself. */
    if (new URLSearchParams(location.search).get("forget") === "1") {
      storageRemove(STORAGE_KEY);
    }

    applyDataConfig();
    mountGift();
    mountMusic();
    mountVideo();
    mountEgg();
    wireGate();

    if (CONFIG.rememberUnlock && storageGet(STORAGE_KEY) === "1") {
      unlock({ animate: false });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
