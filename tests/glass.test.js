// No browser dependency: checks the rendering lifecycle and its safe fallbacks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "../glass.js"), "utf8");

function boot({ webgl = true, compile = true, reducedMotion = false } = {}) {
  const events = {}, queries = {}, pending = new Map(), classes = new Set();
  let sequence = 0, draws = 0;
  const gl = new Proxy({}, { get(_, key) {
    if (key === "getShaderParameter") return () => compile;
    if (key === "getProgramParameter") return () => true;
    if (key === "drawArrays") return () => draws++;
    return () => ({});
  } });
  const canvas = { getContext: () => webgl ? gl : null, addEventListener: (key, fn) => events[key] = fn };
  const card = { hidden: true, getBoundingClientRect: () => ({ left: 22, top: 160, width: 346, height: 430 }) };
  const document = {
    hidden: false,
    documentElement: { clientWidth: 390, classList: { add: x => classes.add(x), remove: x => classes.delete(x) } },
    getElementById: id => id === "liquidBackdrop" ? canvas : card,
    querySelector: () => card,
    addEventListener: (key, fn) => events[key] = fn,
  };
  const window = {
    innerHeight: 844, devicePixelRatio: 3,
    matchMedia: key => queries[key] = { matches: key.includes("reduced-motion") && reducedMotion, addEventListener() {} },
    addEventListener: (key, fn) => events[key] = fn,
  };
  vm.runInNewContext(source, {
    window, document, performance: { now: () => 0 }, Float32Array,
    getComputedStyle: () => ({ borderTopLeftRadius: "36px" }),
    requestAnimationFrame: fn => { pending.set(++sequence, fn); return sequence; },
    cancelAnimationFrame: id => pending.delete(id),
    ResizeObserver: class { observe() {} disconnect() {} },
  });
  return { canvas, document, classes, pending, events, get draws() { return draws; },
    tick(time) { const work = [...pending.values()]; pending.clear(); work.forEach(fn => fn(time)); } };
}

for (const options of [{ webgl: false }, { compile: false }]) {
  const page = boot(options);
  assert.equal(page.pending.size, 0);
  assert.equal(page.classes.has("has-liquid-glass"), false);
}
const page = boot();
page.tick(100);
assert.equal(page.draws, 1);
assert.equal(page.canvas.width, 585, "Pixel density is capped for mobile GPU load");
assert.equal(page.classes.has("has-liquid-glass"), true);
page.document.hidden = true;
page.events.visibilitychange();
assert.equal(page.pending.size, 0, "Hidden pages stop rendering");
page.document.hidden = false;
page.events.visibilitychange();
assert.equal(page.pending.size, 1, "Visible pages resume rendering");
page.events.webglcontextlost({ preventDefault() {} });
assert.equal(page.classes.has("has-liquid-glass"), false);
assert.equal(page.pending.size, 0);
const still = boot({ reducedMotion: true });
still.tick(100);
assert.equal(still.draws, 1);
assert.equal(still.pending.size, 0, "Reduced motion draws once, with no animation loop");
still.events.scroll();
still.tick(200);
assert.equal(still.draws, 2, "Static lens still realigns after scrolling");
console.log("Glass lifecycle checks passed");
