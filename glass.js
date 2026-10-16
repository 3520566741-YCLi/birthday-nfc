/* ==========================================================================
   glass.js — flowing colour field + clear "liquid glass" surfaces (WebGL 1).

   A web interpretation of Apple's clear Liquid Glass look, drawn by this page's
   own shader. It does not call, embed or reproduce Apple's native material.

   Pass 1  paints a slow, domain-warped colour field into a small offscreen
           texture (the field is soft, so ~1/3 resolution is plenty and cheap).
   Pass 2  draws that texture full-screen and bends it through every visible
           element marked [data-glass] (card, field, button):
             · refraction at a rounded bevel — the rim pulls in colour from just
               outside the shape, like the edge of a thick lens
             · slight magnification in the middle, a faint chromatic fringe
             · specular light on the lit edge and a softer one on the far edge
             · a thin shaded band inside the bevel for thickness
             · a soft tinted shadow under each card
           Each surface follows its element's live position and opacity, so the
           glass fades and moves with the CSS animations.

   CSS translucency in style.css is the fallback (no WebGL, shader failure,
   lost context). Reduced motion freezes the field; reduced transparency or
   increased contrast turns the lenses off and style.css uses opaque cards.
   ========================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("liquidBackdrop");
  if (!canvas) return;

  var MAX_LENSES = 8;
  var PIXEL_BUDGET = 2.6e6;      // device pixels per frame, caps big desktop screens
  var IDLE_FPS = 30;             // the field moves slowly; 30 fps is smooth enough
  var BUSY_MS = 700;             // full frame rate this long after scroll / resize / input

  /* Per-kind optics, in CSS px. refract < 0 means a concave, inset surface. */
  var PRESETS = {
    card:   { kind: 0, rim: 32, refract: 36, veil: 0.04, spec: 1.0 },
    button: { kind: 1, rim: 16, refract: 14, veil: 0.12, spec: 1.1 },
    field:  { kind: 2, rim: 12, refract: -7, veil: 0.10, spec: 0.9 },
  };

  var root = document.documentElement;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var transparency = window.matchMedia("(prefers-reduced-transparency: reduce)");
  var contrast = window.matchMedia("(prefers-contrast: more)");
  var gift = document.getElementById("gift");

  var gl, frame = 0, disabled = false, observer;
  var sizeDirty = true, lastFrame = 0, lastDraw = 0, busyUntil = 0;
  var started = performance.now();
  var warm = 0;                  // 0 on the lock screen → 1 once the gift is open
  var view = { w: 0, h: 0, x: 0, y: 0 };
  var texSize = [1, 1];
  var rects = new Float32Array(MAX_LENSES * 4);
  var shapes = new Float32Array(MAX_LENSES * 4);
  var lights = new Float32Array(MAX_LENSES * 4);

  function fallback() {
    disabled = true;
    cancelAnimationFrame(frame);
    frame = 0;
    if (observer) observer.disconnect();
    root.classList.remove("has-liquid-glass");
  }

  var HEAD = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "float hash(vec2 v) { return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453); }",
  ].join("\n");

  /* ---- pass 1: the colour field ------------------------------------------ */
  var FIELD = HEAD + `
    uniform vec2 u_viewport;
    uniform vec2 u_size;
    uniform float u_time;
    uniform float u_warm;

    void pigment(inout vec3 acc, inout float sum, vec2 q, vec3 colour, vec2 centre, float spread, float amount) {
      vec2 d = (q - centre) * spread;
      float k = exp(-dot(d, d)) * amount;
      acc += colour * k;
      sum += k;
    }

    void main() {
      vec2 css = vec2(gl_FragCoord.x, u_size.y - gl_FragCoord.y) * u_viewport / u_size;
      vec2 p = (css - u_viewport * .5) / min(u_viewport.x, u_viewport.y);
      float t = u_time * .09;

      // Two layers of slow domain warping: broad swirls, then finer eddies.
      vec2 w = vec2(sin(p.y * 1.6 + t * 1.3) + .6 * sin(p.y * 2.9 - t * .9 + 1.7),
                    cos(p.x * 1.4 - t * 1.1) + .6 * cos(p.x * 2.6 + t * .8 + .4));
      vec2 q = p + .22 * w;
      q += .085 * vec2(sin(q.y * 4.1 - t * 1.9 + q.x), cos(q.x * 3.7 + t * 1.6 - q.y));

      // Pigments are averaged by weight, so overlaps blend like dye, not paint.
      vec3 acc = vec3(.985, .945, .975) * .16;
      float sum = .16;
      pigment(acc, sum, q, vec3(.66, .60, 1.0),  vec2(-.58 + .34 * sin(t * .9),       -.55 + .30 * cos(t * .7)),       1.70, .95);  // periwinkle violet
      pigment(acc, sum, q, vec3(.74, .52, .98),  vec2( .55 + .32 * cos(t * .8 + 1.),  -.25 + .36 * sin(t * .6 + 2.)),  1.60, 1.1);  // purple
      pigment(acc, sum, q, vec3(1.0, .62, .74),  vec2(-.30 + .40 * cos(t * .65 + 2.5), .22 + .36 * sin(t * .85)),      1.30, 1.3);  // warm pink
      pigment(acc, sum, q, vec3(.86, .60, 1.0),  vec2( .50 + .30 * sin(t * .75 + 4.),  .62 + .34 * cos(t * .55 + 1.)), 1.70, 1.);   // orchid
      pigment(acc, sum, q, vec3(1.0, .72, .80),  vec2( .10 + .42 * sin(t * .5 + 3.),  -.98 + .22 * cos(t * .9)),       1.55, 1.05); // blush, top
      pigment(acc, sum, q, vec3(.80, .64, 1.0),  vec2( .62 + .26 * cos(t * .45 + 5.), -.80 + .28 * sin(t * .7 + 3.)),  1.75, 1.);   // lavender, upper right
      pigment(acc, sum, q, vec3(1.0, .66, .70),  vec2(-.62 + .28 * sin(t * .55 + 1.5), .80 + .24 * cos(t * .65)),      1.70, 1.05); // coral pink, lower left
      pigment(acc, sum, q, mix(vec3(.90, .68, 1.0), vec3(1.0, .76, .68), u_warm),
                                                 vec2( .05 + .30 * cos(t * .7),  -.05 + .40 * sin(t * .5 + 1.)),  2.30 - .70 * u_warm, .7 + .6 * u_warm); // lilac → peach
      vec3 colour = acc / sum;

      // Soft light ribbons drifting through the colour, like light in water.
      // They give the glass something to bend, so the refraction reads.
      float r1 = sin(q.x * 2.2 + q.y * 3.0 + 1.2 * sin(q.y * 1.3 - t * 1.2) + t * .6);
      float r2 = sin(q.x * -1.6 + q.y * 2.4 + 1.1 * cos(q.x * 1.7 + t * .9) - t * .45 + 2.);
      colour = mix(colour, vec3(1.), exp(-pow((r1 - .62) * 3.6, 2.)) * .26);
      colour = mix(colour, vec3(1., .97, .99), exp(-pow((r2 - .70) * 5.0, 2.)) * .16);

      // Depth: brighter overhead light, slightly deeper towards the lower corners.
      colour = mix(colour, vec3(1.), .10 * smoothstep(.5, -1.2, p.y));
      colour *= 1. - .045 * smoothstep(.5, 1.5, length(p * vec2(.85, 1.)));

      colour += (hash(gl_FragCoord.xy + fract(u_time)) - .5) / 255.;
      gl_FragColor = vec4(colour, 1.);
    }
  `;

  /* ---- pass 2: the glass ------------------------------------------------- */
  var GLASS = HEAD + `
    uniform sampler2D u_scene;
    uniform vec2 u_viewport;
    uniform vec2 u_resolution;
    uniform int u_count;
    uniform vec4 u_rect[${MAX_LENSES}];   // x, y, width, height (CSS px)
    uniform vec4 u_shape[${MAX_LENSES}];  // radius, rim width, refraction, veil
    uniform vec4 u_light[${MAX_LENSES}];  // kind, opacity, specular, unused
    uniform float u_seed;

    float box(vec2 local, vec2 hs, float r, out vec2 n) {
      vec2 w = abs(local) - hs + r;
      vec2 s = vec2(local.x < 0. ? -1. : 1., local.y < 0. ? -1. : 1.);
      if (w.x > 0. && w.y > 0.) n = normalize(w) * s;
      else if (w.x > w.y) n = vec2(s.x, 0.);
      else n = vec2(0., s.y);
      return length(max(w, 0.)) + min(max(w.x, w.y), 0.) - r;
    }

    vec3 scene(vec2 css) {
      return texture2D(u_scene, vec2(css.x / u_viewport.x, 1. - css.y / u_viewport.y)).rgb;
    }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) * u_viewport / u_resolution;
      float px = u_viewport.x / u_resolution.x;           // CSS px per device px
      vec2 light = normalize(vec2(-.55, -.84));           // from the upper left

      vec2 offset = vec2(0.);
      float fringe = 0., veil = 0., shade = 0., shadow = 0., inner = 0.;
      vec3 glow = vec3(0.);

      for (int i = 0; i < ${MAX_LENSES}; i++) {
        if (i >= u_count) break;
        vec4 R = u_rect[i];
        vec4 S = u_shape[i];
        vec4 G = u_light[i];
        vec2 hs = R.zw * .5;
        vec2 local = p - R.xy - hs;
        float r = min(S.x, min(hs.x, hs.y));
        vec2 n;
        float d = box(local, hs, r, n);
        float alpha = G.y;

        if (G.x < .5) {                                    // cards cast a soft shadow
          vec2 unused;
          float ds = box(local - vec2(0., 20.), hs - 6., r, unused);
          shadow += (1. - smoothstep(-30., 58., ds)) * alpha * (d > 0. ? .12 : .035);
        }

        float cover = clamp(.5 - d / px, 0., 1.) * alpha;  // anti-aliased edge
        if (cover <= 0.) continue;

        float s = max(-d, 0.);                             // depth inside the edge
        float rim = max(min(S.y, r), 1.);
        float t = clamp(s / rim, 0., 1.);
        float bend = 1. - sqrt(1. - (1. - t) * (1. - t));  // circular bevel profile
        float concave = G.x > 1.5 ? 1. : 0.;

        offset += n * bend * S.z * cover;                  // rim pulls in the outside
        offset -= local * .022 * sign(S.z) * cover;        // gentle magnification
        fringe += bend * abs(S.z) * cover;
        veil += S.w * cover;
        if (G.x < .5) inner = max(inner, cover * smoothstep(rim * .7, rim * 1.5, s));   // card interior, away from the rim

        float lit = max(dot(n, light), 0.);
        float far = max(dot(n, -light), 0.);
        float edge = exp(-s / (rim * .30));
        float spec = mix(pow(lit, 2.5) + .55 * pow(far, 3.),
                         .30 * pow(lit, 2.) + .85 * pow(far, 2.5), concave);
        glow += vec3(1., .995, .99) * spec * edge * G.z * .46 * cover;
        glow += vec3(1.) * .30 * exp(-s / (1.1 * px + .4)) * (.15 + .85 * max(lit, far)) * cover;

        float band = smoothstep(rim * .25, rim * .7, s) * (1. - smoothstep(rim * .7, rim * 1.6, s));
        shade += band * .05 * cover * mix(.45 + .55 * far, 1., concave);
        shade += concave * .11 * exp(-s / 5.) * lit * cover;   // inset: shade under the top lip
      }

      vec2 at = p + offset;
      vec2 dir = dot(offset, offset) > 1e-4 ? normalize(offset) : vec2(0.);
      float spread = fringe * .10;
      vec3 colour = vec3(scene(at + dir * spread).r, scene(at).g, scene(at - dir * spread).b);

      colour *= 1. - shadow * vec3(.92, 1., .70);
      colour = mix(colour, vec3(1.), clamp(veil, 0., .6));
      colour *= 1. - shade;

      // Adaptive legibility: where the colour behind a card's interior turns
      // dark, lift it just enough to keep text contrast; bright areas are untouched.
      float lin = dot(pow(max(colour, 0.), vec3(2.2)), vec3(.2126, .7152, .0722));
      colour = mix(colour, vec3(1.), inner * clamp((.54 - lin) / (1. - lin), 0., 1.));

      colour += glow;
      colour += (hash(gl_FragCoord.xy + u_seed) - .5) / 255.;
      gl_FragColor = vec4(colour, 1.);
    }
  `;

  function opacityOf(el) {
    var a = 1;
    for (var node = el; node && node.nodeType === 1 && node !== document.body; node = node.parentNode) {
      var o = parseFloat(getComputedStyle(node).opacity);
      if (!isNaN(o)) a *= o;
    }
    return a;
  }

  /* Fill the lens arrays from visible [data-glass] elements; returns the count. */
  function collect() {
    if (transparency.matches || contrast.matches || !document.querySelectorAll) return 0;
    var nodes = document.querySelectorAll("[data-glass]");
    var count = 0;
    for (var i = 0; i < nodes.length && count < MAX_LENSES; i++) {
      var el = nodes[i];
      var box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      if (box.bottom < -90 || box.top > view.h + 90) continue;
      var alpha = opacityOf(el);
      if (alpha < 0.01) continue;
      var preset = PRESETS[el.getAttribute("data-glass")] || PRESETS.card;
      var radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      var veil = parseFloat(el.getAttribute("data-glass-veil"));
      var j = count * 4;
      rects[j] = box.left - view.x; rects[j + 1] = box.top - view.y;
      rects[j + 2] = box.width;     rects[j + 3] = box.height;
      shapes[j] = Math.min(radius, box.width / 2, box.height / 2);
      shapes[j + 1] = preset.rim;
      shapes[j + 2] = preset.refract;
      shapes[j + 3] = isNaN(veil) ? preset.veil : veil;
      lights[j] = preset.kind; lights[j + 1] = Math.min(alpha, 1);
      lights[j + 2] = preset.spec; lights[j + 3] = 0;
      count++;
    }
    return count;
  }

  try {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false,
                                      premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) return;

    function shader(type, source) {
      var value = gl.createShader(type);
      gl.shaderSource(value, source);
      gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error("Shader compilation failed");
      return value;
    }

    function program(fragmentSource, names) {
      var vertex = shader(gl.VERTEX_SHADER, "attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0., 1.); }");
      var fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
      var value = gl.createProgram();
      gl.attachShader(value, vertex);
      gl.attachShader(value, fragment);
      gl.bindAttribLocation(value, 0, "a_position");
      gl.linkProgram(value);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new Error("Shader link failed");
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      var uniforms = {};
      names.forEach(function (name) { uniforms[name] = gl.getUniformLocation(value, "u_" + name); });
      return { id: value, u: uniforms };
    }

    var field = program(FIELD, ["viewport", "size", "time", "warm"]);
    var glass = program(GLASS, ["scene", "viewport", "resolution", "count", "rect[0]", "shape[0]", "light[0]", "seed"]);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    var target = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("No offscreen target");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    function measure() {
      sizeDirty = false;
      var box = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      view.w = canvas.clientWidth || root.clientWidth;
      view.h = canvas.clientHeight || window.innerHeight;
      view.x = box ? box.left : 0;
      view.y = box ? box.top : 0;
      var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      ratio = Math.min(ratio, Math.sqrt(PIXEL_BUDGET / Math.max(view.w * view.h, 1)));
      canvas.width = Math.round(view.w * ratio);
      canvas.height = Math.round(view.h * ratio);
      texSize = [Math.max(32, Math.round(view.w / 3)), Math.max(32, Math.round(view.h / 3))];
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texSize[0], texSize[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    function draw(now) {
      if (sizeDirty) measure();
      var still = motion.matches;
      var dt = Math.min((now - (lastDraw || now)) / 1000, 0.1);
      lastDraw = now;
      var goal = gift && !gift.hidden ? 1 : 0;
      warm = still ? goal : warm + (goal - warm) * (1 - Math.exp(-dt / 0.9));
      var time = still ? 18 : (now - started) / 1000;

      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.viewport(0, 0, texSize[0], texSize[1]);
      gl.useProgram(field.id);
      gl.uniform2f(field.u.viewport, view.w, view.h);
      gl.uniform2f(field.u.size, texSize[0], texSize[1]);
      gl.uniform1f(field.u.time, time);
      gl.uniform1f(field.u.warm, warm);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      var count = collect();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(glass.id);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(glass.u.scene, 0);
      gl.uniform2f(glass.u.viewport, view.w, view.h);
      gl.uniform2f(glass.u.resolution, canvas.width, canvas.height);
      gl.uniform1i(glass.u.count, count);
      gl.uniform4fv(glass.u["rect[0]"], rects);
      gl.uniform4fv(glass.u["shape[0]"], shapes);
      gl.uniform4fv(glass.u["light[0]"], lights);
      gl.uniform1f(glass.u.seed, still ? 0 : time % 7);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      root.classList.add("has-liquid-glass");
    }

    function animating() {
      return now() < busyUntil || Math.abs((gift && !gift.hidden ? 1 : 0) - warm) > 0.004 ||
             finiteAnimationRunning();
    }
    function now() { return performance.now(); }
    // Entrance and exit animations move the cards, so render at full rate
    // while they run. Endless decorations (the balloons) don't move any
    // glass, so they must not keep the GPU busy.
    function finiteAnimationRunning() {
      if (!document.getAnimations) return false;
      return document.getAnimations().some(function (a) {
        var timing = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
        return a.playState === "running" && timing && timing.iterations !== Infinity;
      });
    }

    function render(time) {
      frame = 0;
      if (disabled || document.hidden) return;
      var still = motion.matches;
      if (still || animating() || time - lastFrame >= 1000 / IDLE_FPS - 2) {
        lastFrame = time;
        draw(time);
      }
      if (!still) frame = requestAnimationFrame(render);
    }

    function refresh() {
      if (disabled) return;
      if (!frame && !document.hidden) frame = requestAnimationFrame(render);
    }
    function wake() { busyUntil = now() + BUSY_MS; refresh(); }
    function resize() { sizeDirty = true; wake(); }

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", wake, { passive: true });
    // Touches and keys don't move any glass, so they don't need full-rate frames
    // (on phones that would compete with the envelope swipe for the GPU).
    if (window.visualViewport) window.visualViewport.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else { lastDraw = 0; refresh(); }
    });
    [motion, transparency, contrast].forEach(function (query) {
      if (query.addEventListener) query.addEventListener("change", resize);
    });
    canvas.addEventListener("webglcontextlost", function (event) { event.preventDefault(); fallback(); });

    // Cards change size after fonts, photos or unlocking; keep the lenses aligned.
    observer = new ResizeObserver(wake);
    observer.observe(canvas);
    var surfaces = document.querySelectorAll ? document.querySelectorAll(".gate__inner, #gift") : [];
    for (var k = 0; k < surfaces.length; k++) observer.observe(surfaces[k]);
    refresh();
  } catch (error) {
    fallback();
  }
})();
