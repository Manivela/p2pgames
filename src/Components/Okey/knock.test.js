import { assert, test } from "vitest";
import { panOf } from "./knock";

const seats = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));
const near = (a, b) => assert.closeTo(a, b, 1e-9);

test("a knock is heard from where it was, as each player sits", () => {
  const four = seats(4);
  // seat 1 knocks in front of themselves, on their right
  const k = { x: 0.8, y: -0.8, by: 1 };
  near(panOf(k, four, 1), 0.8); // their own right
  near(panOf(k, four, 2), -0.8); // seat 2 sits on their right: on 2's left
  near(panOf(k, four, 3), -0.8); // across: the knocker's right is 3's left
  near(panOf(k, four, 4), 0.8); // seat 4 on their left: close, to 4's right
  // the middle of the table is in front of everyone
  near(panOf({ x: 0, y: 0, by: 2 }, four, 1), 0);
  // three at the table: the next one sits right and a little across
  near(panOf({ x: 0, y: -1, by: 2 }, seats(3), 1), Math.sin((2 * Math.PI) / 3));
  // someone watching hears it as the first seat does
  near(panOf(k, four, undefined), 0.8);
  // never past full left or right
  near(panOf({ x: 1, y: -1, by: 2 }, four, 1), 1);
});
