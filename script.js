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
  senderName: "李雨宸",             // signature at the end of the letter

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
    enabled: false,                 // set true to show assets/photo.jpg
    src: "assets/photo.jpg",        // ← drop your photo here
    fallback: ["assets/photo.jpeg", "assets/photo.png", "assets/photo.webp"],
    caption: "",                    // optional line under the photo
    alt: "A photo of us",           // for screen readers
  },

  /* --- 6. Photo gallery (optional) -------------------------------------- */
  gallery: {
    enabled: false,                 // set true to show the gallery
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
    enabled: false,                 // set true, then fill embedUrl or audioFile
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
    enabled: false,                 // set true, then fill embedUrl or videoFile
    buttonLabel: "There's a video too",
    embedUrl: "",                   // YouTube embed URL, or leave empty
    videoFile: "",                  // e.g. "assets/video.mp4"
  },

  /* --- 9. Easter egg (optional) ----------------------------------------- */
  egg: {
    enabled: false,
    buttonLabel: "还有一个小彩蛋",
    title: "彩蛋时间 🥚",
    paragraphs: [
      "如果你看到这里了，那说明你真的很有耐心。",
      "其实最想说的只有一句：认识你很高兴。",
    ],
  },

  /* --- 10. Behaviour ---------------------------------------------------- */
  /* false = ask for the date on every load, on every device, every time.
     true  = reopening the link in the same browser stays unlocked.

     This only affects whether the lock screen is shown again. It does not make
     the code any more secret: the password is in this file either way.        */
  rememberUnlock: false,
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

  /* --- confetti: four corner cannons with paper bits and streamers ------ */
  function celebrate() {
    if (!CONFIG.confetti || !motionOK()) return;
    var layer = $("#confetti");
    if (!layer || !layer.appendChild) return;

    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    layer.textContent = "";
    layer.appendChild(canvas);

    var colors = ["#8a6dff", "#b46cff", "#ff5e9a", "#ff7a7a", "#ffa65c", "#ffcf4d", "#ffffff"];
    var w = window.innerWidth, h = window.innerHeight;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.scale(ratio, ratio);

    var scale = Math.max(0.8, Math.min(w, h) / 420);
    var perCorner = Math.max(8, Math.round((CONFIG.confettiCount || 34) * 0.7));
    var streamersPerCorner = 6;
    var corners = [[0, 0], [w, 0], [0, h], [w, h]];
    var pieces = [];

    corners.forEach(function (c, k) {
      var tx = w / 2, ty = h * 0.42;                               // aim at the middle of the card
      var aim = Math.atan2(ty - c[1], tx - c[0]);
      var reach = Math.hypot(tx - c[0], ty - c[1]);
      for (var i = 0; i < perCorner + streamersPerCorner; i++) {
        var streamer = i < streamersPerCorner;
        var drag = streamer ? 0.945 : 0.935;
        var angle = aim + (Math.random() - 0.5) * 0.75;
        // With drag d, a launch speed v travels about v / (1 - d): pick v to land near the middle.
        var speed = reach * (1 - drag) * (0.7 + Math.random() * 0.45);
        pieces.push({
          x: c[0], y: c[1],
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          drag: drag,
          gravity: (streamer ? 0.05 : 0.08) * scale,
          delay: Math.random() * 200 + k * 35,
          color: colors[(i + k) % colors.length],
          streamer: streamer,
          size: streamer ? 3 + Math.random() * 1.5 : 5 + Math.random() * 6,
          spin: Math.random() * Math.PI * 2,
          spinRate: (Math.random() - 0.5) * 0.3,
          phase: Math.random() * Math.PI * 2,
          trail: [],
        });
      }
    });

    var started = performance.now(), last = started, LIFE = 4600;

    function step() {
      var now = performance.now();               // one clock for the whole burst
      // Advance physics by real elapsed time (in 60 fps ticks), so a slow
      // frame rate makes the burst choppier but never slower or shorter.
      var ticks = Math.min(Math.round(Math.max(now - last, 0) / 16.67), 8) || 1;
      last = now;
      var age = now - started;
      var fade = age > LIFE - 1300 ? Math.max(0, (LIFE - age) / 1300) : 1;
      ctx.clearRect(0, 0, w, h);

      pieces.forEach(function (p) {
        if (age < p.delay) return;
        for (var n = 0; n < ticks; n++) {
          p.vx *= p.drag;
          p.vy = p.vy * p.drag + p.gravity;
          p.x += p.vx + Math.sin(age / 300 + p.phase) * 0.35;
          p.y += p.vy;
          p.spin += p.spinRate;
          if (p.streamer) {                       // trail per physics tick: same ribbon length at any frame rate
            p.trail.unshift([p.x, p.y]);
            if (p.trail.length > 14) p.trail.pop();
          }
        }
        ctx.globalAlpha = fade * (p.streamer ? 0.85 : 1);

        if (p.streamer) {
          if (p.trail.length < 2) return;
          ctx.strokeStyle = p.color;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = p.size;
          ctx.beginPath();
          for (var j = 0; j < p.trail.length; j++) {
            var a = p.trail[j];
            var b = p.trail[Math.min(j + 1, p.trail.length - 1)];
            var nx = -(b[1] - a[1]), ny = b[0] - a[0];
            var len = Math.hypot(nx, ny) || 1;
            var curl = Math.sin(j * 0.9 - age / 110 + p.phase) * 6;   // flutter
            var px = a[0] + nx / len * curl, py = a[1] + ny / len * curl;
            if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin);
          ctx.scale(1, Math.cos(age / 120 + p.phase));                // paper flipping
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (age < LIFE) window.requestAnimationFrame(step);
      else layer.textContent = "";
    }
    window.requestAnimationFrame(step);
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

    if (CONFIG.rememberUnlock) {
      if (storageGet(STORAGE_KEY) === "1") unlock({ animate: false });
    } else {
      /* Off: clear anything a device stored back when it was on, so no device
         keeps a stale unlock. */
      storageRemove(STORAGE_KEY);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
