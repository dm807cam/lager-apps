import { test, expect } from "../../../tests/fixtures.mjs";

// Measures what reaches the speakers: every connection to the destination also feeds an analyser.
const TAP = `(() => {
  window.__peak = 0;
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...r) {
    if (dest === this.context.destination && !this.context.__tap) {
      const an = this.context.createAnalyser(); this.context.__tap = an; orig.call(this, an);
      const buf = new Float32Array(an.fftSize);
      setInterval(() => { an.getFloatTimeDomainData(buf); for (const v of buf) window.__peak = Math.max(window.__peak, Math.abs(v)); }, 20);
    }
    return orig.call(this, dest, ...r);
  };
  // Stand-in for Safari's Audio Session API.
  Object.defineProperty(navigator, "audioSession", { value: { type: "auto" }, configurable: true });
})();`;

test("Stillwater rings its bell when a sit begins, as media playback (not muted by the silent switch)", async ({ page, openApp }) => {
  await page.addInitScript(TAP);
  const { errors } = await openApp("stillwater", { waitFor: 1000 });
  expect(await page.evaluate(() => navigator.audioSession.type)).toBe("auto");
  await page.click("#begin");
  await expect.poll(() => page.evaluate(() => window.__peak), { timeout: 20000 }).toBeGreaterThan(0.05);
  expect(await page.evaluate(() => navigator.audioSession.type)).toBe("playback");
  expect(errors).toEqual([]);
});
