import { describe, expect, test, vi } from "vitest";
import { agree, needed, stamp } from "./useRoom";

// the stores and Yjs hooks aren't reached by the pure functions tested here
vi.mock("./useStore", () => ({}));
vi.mock("../vendor/y-react", () => ({}));

describe("a room setting, between the room and each device", () => {
  const never = { wait: "all", at: 0, by: null };
  const off = { wait: "off", at: 100, by: { id: "a", name: "Ada" } };
  const on = { wait: "all", at: 200, by: { id: "b", name: "Bo" } };

  test("a device that saw a later switch brings it to the room", () => {
    expect(agree(off, undefined)).toBe("room");
    expect(agree(on, off)).toBe("room");
  });

  test("a device keeps a later switch the room had", () => {
    expect(agree(never, off)).toBe("device");
    expect(agree(off, on)).toBe("device");
  });

  test("never switched, nothing is written", () => {
    expect(agree(never, undefined)).toBe(null);
    expect(agree(off, off)).toBe(null);
  });

  test("a switch counts as the latest on a device whose clock is behind", () => {
    expect(stamp(50, off)).toBe(101);
    expect(stamp(500, off)).toBe(500);
    expect(stamp(500, undefined)).toBe(500);
  });
});

test("the presses that start the next round: all, or half rounded up", () => {
  expect([1, 2, 3, 4].map((n) => needed("all", n))).toEqual([1, 2, 3, 4]);
  expect([1, 2, 3, 4].map((n) => needed("half", n))).toEqual([1, 1, 2, 2]);
});
