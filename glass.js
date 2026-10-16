/* Procedural colour field + a refracting rounded lens; CSS is the fallback. */
(function () {
  "use strict";

  var canvas = document.getElementById("liquidBackdrop");
  if (!canvas) return;
  var gl;
  var frame = 0;
  var observer;
  var disabled = false;
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var transparency = window.matchMedia("(prefers-reduced-transparency: reduce)");
  var contrast = window.matchMedia("(prefers-contrast: more)");
  var viewport = [0, 0];
  var sizeDirty = true;
  var lastFrame = 0;
  var started = performance.now();
  var gate = document.querySelector(".gate__inner");
  var gift = document.getElementById("gift");

  function fallback() {
    disabled = true;
    cancelAnimationFrame(frame);
    if (observer) observer.disconnect();
    document.documentElement.classList.remove("has-liquid-glass");
  }

  try {
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
    if (!gl) return;
    // shortcut: one rounded card lens, extend the shader only if the layout adds floating cards.
    var fragment = `
      precision highp float;
      uniform vec2 u_viewport;
      uniform vec2 u_resolution;
      uniform vec4 u_card;
      uniform float u_radius;
      uniform float u_time;
      uniform float u_lens;

      float cloud(vec2 p, vec2 centre, vec2 stretch) {
        vec2 d = (p - centre) * stretch;
        return exp(-dot(d, d) * 2.0);
      }

      vec3 field(vec2 pixel) {
        vec2 p = (pixel - u_viewport * .5) / min(u_viewport.x, u_viewport.y);
        float t = u_time * .16;
        p += .12 * vec2(sin(p.y * 2.4 + t), cos(p.x * 2.1 - t * .8));
        vec3 colour = vec3(.93, .95, .99);
        colour = mix(colour, vec3(.40, .64, .98), .75 * cloud(p, vec2(-.55 + .24 * sin(t), -.28 + .26 * cos(t * .8)), vec2(.9, .75)));
        colour = mix(colour, vec3(.68, .48, .91), .65 * cloud(p, vec2(.46 + .28 * cos(t * .7), -.38 + .22 * sin(t)), vec2(.9, .8)));
        colour = mix(colour, vec3(.99, .62, .77), .68 * cloud(p, vec2(-.42 + .28 * sin(t * .8), .55 + .20 * cos(t)), vec2(.8, .75)));
        colour = mix(colour, vec3(.43, .84, .80), .62 * cloud(p, vec2(.55 + .22 * cos(t), .50 + .25 * sin(t * .7)), vec2(.9, .7)));
        colour = mix(colour, vec3(1., .86, .71), .55 * cloud(p, vec2(.18 * sin(t), .08 + .35 * cos(t * .6)), vec2(.95, 1.1)));
        float ribbon = sin(p.x * 3.3 + p.y * 2.6 + .8 * sin(p.y * 2.0 - t) + t * .45);
        float light = exp(-pow((ribbon - .32) * 6.0, 2.0));
        return mix(colour, vec3(.99, .99, 1.), light * .23);
      }

      void main() {
        vec2 p = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y) * u_viewport / u_resolution;
        vec3 colour = field(p);
        vec2 halfSize = u_card.zw * .5;
        vec2 local = p - u_card.xy - halfSize;
        vec2 q = abs(local) - halfSize + u_radius;
        float distance = length(max(q, 0.)) + min(max(q.x, q.y), 0.) - u_radius;
        if (u_lens > .5 && distance < 0.) {
          vec2 core = clamp(local, -halfSize + u_radius, halfSize - u_radius);
          vec2 normal = normalize(local - core + vec2(.0001));
          float edge = 1. - smoothstep(0., 30., -distance);
          vec2 refracted = p - normal * edge * edge * 19. - local * .012;
          colour = field(refracted);
          colour = mix(colour, vec3(1.), .035);
          float specular = pow(max(dot(normal, normalize(vec2(-.7, -1.))), 0.), 3.);
          colour += vec3(.20, .22, .25) * specular * exp(distance * .27);
          colour -= vec3(.055, .04, .025) * (1. - specular) * exp(distance * .18);
          float hairline = (1. - smoothstep(.3, 1.4, -distance));
          colour = mix(colour, vec3(1.), hairline * (.35 + .3 * specular));
        }
        gl_FragColor = vec4(colour, 1.);
      }
    `;

    function shader(type, source) {
      var value = gl.createShader(type);
      gl.shaderSource(value, source);
      gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error("Shader compilation failed");
      return value;
    }

    var vertex = shader(gl.VERTEX_SHADER, "attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0., 1.); }");
    var pixel = shader(gl.FRAGMENT_SHADER, fragment);
    var program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, pixel);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Shader link failed");
    gl.deleteShader(vertex);
    gl.deleteShader(pixel);
    gl.useProgram(program);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    var uniforms = {};
    ["viewport", "resolution", "card", "radius", "time", "lens"].forEach(function (name) {
      uniforms[name] = gl.getUniformLocation(program, "u_" + name);
    });

    function render(now) {
      frame = 0;
      if (disabled || document.hidden) return;
      if (motion.matches || now - lastFrame >= 1000 / 30) {
        lastFrame = now;
        if (sizeDirty) {
          sizeDirty = false;
          viewport = [document.documentElement.clientWidth, window.innerHeight];
          var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
          canvas.width = Math.round(viewport[0] * ratio);
          canvas.height = Math.round(viewport[1] * ratio);
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform2f(uniforms.viewport, viewport[0], viewport[1]);
          gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        }
        var card = gift.hidden ? gate : gift;
        var rect = card.getBoundingClientRect();
        gl.uniform4f(uniforms.card, rect.left, rect.top, rect.width, rect.height);
        gl.uniform1f(uniforms.radius, parseFloat(getComputedStyle(card).borderTopLeftRadius) || 36);
        gl.uniform1f(uniforms.time, motion.matches ? 0 : (now - started) / 1000);
        gl.uniform1f(uniforms.lens, transparency.matches || contrast.matches ? 0 : 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        document.documentElement.classList.add("has-liquid-glass");
      }
      if (!motion.matches) frame = requestAnimationFrame(render);
    }

    function refresh() {
      if (disabled) return;
      if (!frame && !document.hidden) frame = requestAnimationFrame(render);
    }
    function resize() { sizeDirty = true; refresh(); }
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", refresh, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else refresh();
    });
    [motion, transparency, contrast].forEach(function (query) { query.addEventListener("change", refresh); });
    canvas.addEventListener("webglcontextlost", function (event) { event.preventDefault(); fallback(); });
    // A hidden-to-visible card can change size after fonts, photos, or unlocking.
    observer = new ResizeObserver(refresh);
    observer.observe(gate);
    observer.observe(gift);
    refresh();
  } catch (error) {
    fallback();
  }
})();
