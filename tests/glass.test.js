// No browser dependency: checks the rendering lifecycle, lens collection and safe fallbacks.
// Run with: node tests/glass.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "../glass.js"), "utf8");

function element(kind, rect, extra = {}) {
  return {
    nodeType: 1, hidden: false, kind, style: { opacity: "1" }, parentNode: null,
    getAttribute: key => key === "data-glass" ? kind : (extra.attrs || {})[key] ?? null,
    getBoundingClientRect: () => rect,
    ...extra,
  };
}

function boot({ webgl = true, compile = true, framebuffer = true, reducedMotion = false, reducedTransparency = false } = {}) {
  const events = {}, pending = new Map(), classes = new Set(), uniforms = {};
  let sequence = 0, draws = 0;
  const gl = new Proxy({}, { get(_, key) {
    if (key === "FRAMEBUFFER_COMPLETE") return "complete";
    if (key === "checkFramebufferStatus") return () => framebuffer ? "complete" : "incomplete";
    if (key === "getShaderParameter") return () => compile;
    if (key === "getProgramParameter") return () => true;
    if (key === "getUniformLocation") return (_, name) => name;
    if (key === "drawArrays") return () => draws++;
    if (String(key).startsWith("uniform")) return (loc, ...values) => { uniforms[loc] = values.length > 1 ? values : values[0]; };
    return () => ({});
  } });
  const canvas = { getContext: () => webgl ? gl : null, addEventListener: (key, fn) => events[key] = fn };
  const gate = element("card", { left: 22, top: 160, width: 346, height: 430, bottom: 590 });
  const field = element("field", { left: 50, top: 300, width: 290, height: 58, bottom: 358 }, { parentNode: gate });
  const button = element("button", { left: 50, top: 370, width: 290, height: 58, bottom: 428 }, { parentNode: gate });
  const gift = element("card", { left: 0, top: 0, width: 0, height: 0, bottom: 0 }, { hidden: true, attrs: { "data-glass-veil": ".15" } });
  const nodes = [gift, gate, field, button];
  const document = {
    hidden: false,
    body: {},
    documentElement: { clientWidth: 390, classList: { add: x => classes.add(x), remove: x => classes.delete(x) } },
    getElementById: id => id === "liquidBackdrop" ? canvas : gift,
    querySelectorAll: selector => selector === "[data-glass]" ? nodes : [gate, gift],
    addEventListener: (key, fn) => events[key] = fn,
  };
  const window = {
    innerHeight: 844, devicePixelRatio: 3,
    matchMedia: key => ({ matches: (key.includes("reduced-motion") && reducedMotion) ||
                                    (key.includes("reduced-transparency") && reducedTransparency), addEventListener() {} }),
    addEventListener: (key, fn) => events[key] = fn,
  };
  vm.runInNewContext(source, {
    window, document, performance: { now: () => 0 }, Float32Array, Math,
    getComputedStyle: el => ({ borderTopLeftRadius: el.kind === "card" ? "34px" : "20px", opacity: el.style.opacity }),
    requestAnimationFrame: fn => { pending.set(++sequence, fn); return sequence; },
    cancelAnimationFrame: id => pending.delete(id),
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  return { canvas, document, classes, pending, events, uniforms, gate, field, button, gift,
    get draws() { return draws; },
    tick(time) { const work = [...pending.values()]; pending.clear(); work.forEach(fn => fn(time)); } };
}

// 1. Anything that stops WebGL leaves the CSS fallback in charge, with no loop running.
for (const options of [{ webgl: false }, { compile: false }, { framebuffer: false }]) {
  const page = boot(options);
  assert.equal(page.pending.size, 0, `no render loop when ${JSON.stringify(options)}`);
  assert.equal(page.classes.has("has-liquid-glass"), false);
}

// 2. A normal frame: two passes, capped pixel density, glass class on.
const page = boot();
page.tick(100);
assert.equal(page.draws, 2, "Each frame paints the colour field, then the glass");
assert.equal(page.canvas.width, 585, "Pixel density is capped for mobile GPU load");
assert.equal(page.classes.has("has-liquid-glass"), true);

// 3. Lenses: visible [data-glass] elements only, in DOM order, with their kind and radius.
assert.equal(page.uniforms.u_count, 3, "Hidden gift card is skipped; gate, field and button are lenses");
const lights = page.uniforms["u_light[0]"], shapes = page.uniforms["u_shape[0]"], rects = page.uniforms["u_rect[0]"];
assert.deepEqual([lights[0], lights[4], lights[8]], [0, 2, 1], "card, concave field, convex button");
assert.deepEqual([rects[0], rects[1], rects[2], rects[3]], [22, 160, 346, 430]);
assert.equal(shapes[0], 34, "Lens radius follows the CSS radius");

// 4. Lens opacity follows the element and its ancestors, so the glass fades with the card.
page.gate.style.opacity = "0.5";
page.tick(200);
assert.equal(page.uniforms["u_light[0]"][1], 0.5);
assert.equal(page.uniforms["u_light[0]"][5], 0.5, "Children inherit the card's fade");

// 5. Unlocking: the gift becomes the card and keeps its own veil.
page.gate.style.opacity = "0";
page.gift.hidden = false;
page.gift.getBoundingClientRect = () => ({ left: 22, top: 120, width: 346, height: 600, bottom: 720 });
page.tick(300);
assert.equal(page.uniforms.u_count, 1, "Faded-out gate is dropped, gift is drawn");
assert.equal(Math.round(page.uniforms["u_shape[0]"][3] * 100), 15);

// 6. Hidden pages stop; visible pages resume; a lost context falls back.
page.document.hidden = true;
page.events.visibilitychange();
assert.equal(page.pending.size, 0, "Hidden pages stop rendering");
page.document.hidden = false;
page.events.visibilitychange();
assert.equal(page.pending.size, 1, "Visible pages resume rendering");
page.events.webglcontextlost({ preventDefault() {} });
assert.equal(page.classes.has("has-liquid-glass"), false);
assert.equal(page.pending.size, 0);

// 7. Reduced motion: one still frame, no loop, but the lens still realigns on scroll.
const still = boot({ reducedMotion: true });
still.tick(100);
assert.equal(still.draws, 2);
assert.equal(still.pending.size, 0, "Reduced motion draws once, with no animation loop");
still.events.scroll();
still.tick(200);
assert.equal(still.draws, 4, "Static lens still realigns after scrolling");

// 8. Reduced transparency: the field still flows but no lenses are drawn (CSS goes opaque).
const plain = boot({ reducedTransparency: true });
plain.tick(100);
assert.equal(plain.uniforms.u_count, 0);

console.log("Glass lifecycle checks passed");
