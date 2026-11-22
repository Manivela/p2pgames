import { describe, expect, it } from "vitest";
import { cappedAt, causeOf } from "./hitches";

describe("causeOf", () => {
  const frame = (startTime, duration, scripts = []) => ({
    startTime,
    duration,
    scripts,
  });

  it("is the main thread when a long animation frame covers the hitch", () => {
    const scripts = [
      { duration: 20, invoker: "a", sourceURL: "x.js" },
      { duration: 90, invoker: "TimerHandler", sourceURL: "okey.js" },
    ];
    expect(causeOf(1000, 1120, [frame(990, 130, scripts)])).toEqual({
      cause: "main thread",
      script: {
        ms: 90,
        invoker: "TimerHandler",
        source: "okey.js",
        function: undefined,
      },
    });
  });

  it("is the GPU or the browser when none does", () => {
    expect(causeOf(1000, 1120, [frame(500, 80), frame(1200, 60)])).toEqual({
      cause: "gpu or browser",
    });
  });

  it("is unknown where the browser has no long animation frames", () => {
    expect(causeOf(1000, 1120, [], false)).toEqual({ cause: "unknown" });
  });
});

describe("cappedAt", () => {
  it("finds a frame rate held near 30", () => {
    expect(cappedAt(Array(12).fill(33.4))).toBe(33);
  });

  it("isn't a full frame rate, nor a few frames", () => {
    expect(cappedAt(Array(12).fill(16.7))).toBeNull();
    expect(cappedAt(Array(5).fill(33.4))).toBeNull();
  });

  it("takes the median: a hitch among them doesn't move it", () => {
    expect(cappedAt([...Array(11).fill(16.7), 300])).toBeNull();
  });
});
