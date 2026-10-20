import { assert, test } from "vitest";
import { checkFinished } from "./checkFinish";
import { createTile, maxHandSize } from "./utils";

function makeHand(hand) {
  const paddedHand = hand.concat(Array(maxHandSize - hand.length));
  assert.equal(paddedHand.length, maxHandSize);
  assert.equal(paddedHand.filter((h) => h !== null).length, 14);
  return paddedHand;
}

const indicator = createTile("black", 13, 1);
const okey = createTile("black", 1, 1);

test("can finish with fake okey", () => {
  assert.isTrue(
    checkFinished(
      makeHand([
        createTile("yellow", 6),
        createTile("blue", 6),
        createTile("red", 6),
        null,
        createTile("yellow", "👌"),
        createTile("black", 2),
        createTile("black", 3),
        null,
        createTile("blue", 1),
        createTile("blue", 2),
        createTile("blue", 3),
        createTile("blue", 4),
        createTile("blue", 5),
        null,
        createTile("red", 12),
        createTile("yellow", 12),
        createTile("black", 12),
      ]),
      indicator,
    ),
  );
});

test("black-8 black-9 red-9 can't finish", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("yellow", 6),
        createTile("blue", 6),
        createTile("red", 6),
        null,
        createTile("black", 8),
        createTile("black", 9),
        createTile("red", 9),
        null,
        createTile("blue", 1),
        createTile("blue", 2),
        createTile("blue", 3),
        createTile("blue", 4),
        createTile("blue", 5),
        null,
        createTile("red", 12),
        createTile("yellow", 12),
        createTile("black", 12),
      ]),
      indicator,
    ),
  );
});

test("13 1 2 can't finish", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("yellow", 6),
        createTile("blue", 6),
        createTile("red", 6),
        null,
        createTile("yellow", 9),
        createTile("black", 9),
        createTile("red", 9),
        null,
        createTile("blue", 13),
        createTile("blue", 1),
        createTile("blue", 2),
        createTile("blue", 3),
        createTile("blue", 4),
        null,
        createTile("red", 12),
        createTile("yellow", 12),
        createTile("black", 12),
      ]),
      indicator,
    ),
  );
});

test("1 and 13 counts for series", () => {
  assert.isTrue(
    checkFinished(
      makeHand([
        createTile("red", 9),
        createTile("blue", 9),
        createTile("yellow", 9),
        createTile("black", 9),
        null,
        createTile("red", 12),
        createTile("red", 13),
        createTile("red", 1),
        null,
        createTile("red", 5),
        createTile("red", 6),
        createTile("red", 7),
        createTile("red", 8),
        null,
        createTile("blue", 13),
        createTile("black", 13),
        createTile("yellow", 13),
      ]),
      indicator,
    ),
  );
});

test("pairs and unfinished series combined can't win", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1, 1),
        createTile("red", 1, 2),
        createTile("yellow", 5, 1),
        createTile("yellow", 5, 2),
        createTile("yellow", 13, 1),
        createTile("yellow", 13, 2),
        createTile("blue", 4, 1),
        createTile("blue", 4, 2),
        createTile("black", 1, 1),
        createTile("black", 1, 2),
        createTile("red", 3, 1),
        createTile("red", 3, 2),
        createTile("red", 5),
        createTile("red", 6),
      ]),
      indicator,
    ),
  );
});

test("pairs and unfinished series combined can't win with okey", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1, 1),
        createTile("red", 1, 2),
        createTile("yellow", 5, 1),
        createTile("yellow", 5, 2),
        createTile("yellow", 13, 1),
        createTile("yellow", 13, 2),
        createTile("blue", 4, 1),
        createTile("blue", 4, 2),
        createTile("black", 3, 1),
        createTile("black", 3, 2),
        createTile("red", 3, 1),
        createTile("red", 3, 2),
        createTile("red", 5),
        okey,
      ]),
      indicator,
    ),
  );
});

test("pairs and series combined can't win", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1, 1),
        createTile("red", 1, 2),
        createTile("yellow", 5, 1),
        createTile("yellow", 5, 2),
        createTile("yellow", 13, 1),
        createTile("yellow", 13, 2),
        createTile("blue", 4, 1),
        createTile("blue", 4, 2),
        createTile("black", 1, 1),
        createTile("black", 1, 2),
        createTile("red", 3),
        createTile("red", 4),
        createTile("red", 5),
        createTile("red", 6),
      ]),
      indicator,
    ),
  );
});

test("pairs and series combined can't win with okey", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1, 1),
        createTile("red", 1, 2),
        createTile("yellow", 5, 1),
        createTile("yellow", 5, 2),
        createTile("yellow", 13, 1),
        createTile("yellow", 13, 2),
        createTile("blue", 4, 1),
        createTile("blue", 4, 2),
        createTile("black", 1, 1),
        createTile("black", 1, 2),
        createTile("red", 3),
        okey,
        createTile("red", 5),
        createTile("red", 6),
      ]),
      indicator,
    ),
  );
});

test("pairs can win", () => {
  assert.isTrue(
    checkFinished(
      makeHand([
        createTile("red", 1, 1),
        createTile("red", 1, 2),
        createTile("yellow", 5, 1),
        createTile("yellow", 5, 2),
        createTile("yellow", 13, 1),
        createTile("yellow", 13, 2),
        createTile("blue", 4, 1),
        createTile("blue", 4, 2),
        createTile("black", 1, 1),
        createTile("black", 1, 2),
        createTile("red", 3, 1),
        createTile("red", 3, 2),
        createTile("blue", 11, 1),
        createTile("blue", 11, 2),
      ]),
      indicator,
    ),
  );
});

test("same color sequences and multiple colors can win with okey", () => {
  assert.isTrue(
    checkFinished(
      makeHand([
        createTile("red", 1),
        okey,
        createTile("red", 3),
        createTile("black", 4),
        createTile("blue", 4),
        createTile("yellow", 4),
        createTile("red", 4),
        createTile("black", 1),
        createTile("black", 2),
        createTile("black", 3),
        createTile("black", 4),
        createTile("red", 3),
        createTile("yellow", 3),
        createTile("blue", 3),
      ]),
      indicator,
    ),
  );
});

test("same color sequences and multiple colors can win", () => {
  assert.isTrue(
    checkFinished(
      makeHand([
        createTile("red", 1),
        createTile("red", 2),
        createTile("red", 3),
        createTile("black", 4),
        createTile("blue", 4),
        createTile("yellow", 4),
        createTile("red", 4),
        createTile("black", 1),
        createTile("black", 2),
        createTile("black", 3),
        createTile("black", 4),
        createTile("red", 3),
        createTile("yellow", 3),
        createTile("blue", 3),
      ]),
      indicator,
    ),
  );
});

test("same color sequences can win", () => {
  assert.isTrue(
    checkFinished(
      makeHand([
        createTile("red", 1),
        createTile("red", 2),
        createTile("red", 3),
        createTile("blue", 4),
        createTile("blue", 5),
        createTile("blue", 6),
        createTile("blue", 7),
        createTile("blue", 8),
        createTile("black", 2),
        createTile("black", 3),
        createTile("black", 4),
        createTile("yellow", 4),
        createTile("yellow", 5),
        createTile("yellow", 6),
      ]),
      indicator,
    ),
  );
});

test("same color sequences can win with okey", () => {
  assert.isTrue(
    checkFinished(
      makeHand([
        okey,
        createTile("red", 2),
        createTile("red", 3),
        createTile("blue", 4),
        createTile("blue", 5),
        createTile("blue", 6),
        createTile("blue", 7),
        createTile("blue", 8),
        createTile("black", 2),
        createTile("black", 3),
        createTile("black", 4),
        createTile("yellow", 4),
        createTile("yellow", 5),
        createTile("yellow", 6),
      ]),
      indicator,
    ),
  );
});

test("same color sequences can win", () => {
  assert.isTrue(
    checkFinished(
      makeHand([
        createTile("red", 1),
        createTile("red", 2),
        createTile("red", 3),
        createTile("red", 4),
        createTile("red", 5),
        createTile("red", 6),
        createTile("red", 7),
        createTile("red", 8),
        createTile("red", 9),
        createTile("red", 10),
        createTile("red", 11),
        createTile("yellow", 4),
        createTile("yellow", 5),
        createTile("yellow", 6),
      ]),
      indicator,
    ),
  );
});

test("sequence of 2 can't win", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        null,
        createTile("red", 1),
        createTile("red", 2),
        null,
        createTile("blue", 3),
        createTile("blue", 4),
        createTile("blue", 5),
        createTile("blue", 6),
        createTile("blue", 7),
        createTile("blue", 8),
        createTile("black", 2),
        createTile("black", 3),
        createTile("black", 4),
        createTile("yellow", 4),
        createTile("yellow", 5),
        createTile("yellow", 6),
      ]),
      indicator,
    ),
  );
});

test("sequence of 2 without spaces can't win", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1),
        createTile("red", 2),
        createTile("blue", 3),
        createTile("blue", 4),
        createTile("blue", 5),
        createTile("blue", 6),
        createTile("blue", 7),
        createTile("blue", 8),
        createTile("black", 2),
        createTile("black", 3),
        createTile("black", 4),
        createTile("yellow", 4),
        createTile("yellow", 5),
        createTile("yellow", 6),
      ]),
      indicator,
    ),
  );
});

test("alternating colors can't win", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1),
        createTile("blue", 2),
        createTile("black", 3),
        createTile("yellow", 4),
        createTile("blue", 3),
        createTile("blue", 4),
        createTile("blue", 5),
        createTile("blue", 6),
        createTile("black", 2),
        createTile("black", 3),
        createTile("black", 4),
        createTile("yellow", 4),
        createTile("yellow", 5),
        createTile("yellow", 6),
      ]),
      indicator,
    ),
  );
});

test("different color sequences can't win", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1),
        createTile("black", 2),
        createTile("red", 3),
        createTile("red", 4),
        createTile("red", 5),
        createTile("red", 6),
        createTile("red", 7),
        createTile("red", 8),
        createTile("red", 9),
        createTile("red", 10),
        createTile("red", 11),
        createTile("yellow", 4),
        createTile("yellow", 5),
        createTile("yellow", 6),
      ]),
      indicator,
    ),
  );
});

test("different color sequences can't win", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1),
        createTile("black", 2),
        indicator,
        createTile("red", 4),
        createTile("red", 5),
        createTile("red", 6),
        createTile("red", 7),
        createTile("red", 8),
        createTile("red", 9),
        createTile("red", 10),
        createTile("red", 11),
        createTile("yellow", 4),
        createTile("yellow", 5),
        createTile("yellow", 6),
      ]),
      indicator,
    ),
  );
});

test("a lone tile can't win", () => {
  const groups = [
    ...[createTile("red", 1), createTile("red", 2), createTile("red", 3)],
    null,
    ...[createTile("blue", 5), createTile("blue", 6), createTile("blue", 7)],
    null,
    ...[createTile("black", 9), createTile("black", 10)],
    ...[createTile("black", 11), createTile("black", 12)],
    null,
    ...[createTile("red", 8), createTile("black", 8), createTile("blue", 8)],
    null,
  ];
  const lone = createTile("yellow", 2);
  const inMiddle = [...groups, lone, null];
  const inLastSlot = [...groups];
  inLastSlot[maxHandSize - 1] = lone;

  assert.isFalse(checkFinished(makeHand(inMiddle), indicator));
  assert.isFalse(checkFinished(inLastSlot, indicator));
});

// a hand in short: r5 is red 5 (k black, b blue, y yellow), ok the okey
// (black 1 here), fake a fake okey, | a gap; a tile written twice is its
// second copy
function hand(text) {
  const seen = {};
  const colors = { r: "red", k: "black", b: "blue", y: "yellow" };
  const tiles = text.split(" ").map((x) => {
    if (x === "|") return null;
    if (x === "ok") return okey;
    if (x === "fake") return createTile("yellow", "👌");
    seen[x] = (seen[x] ?? -1) + 1;
    return createTile(colors[x[0]], Number(x.slice(1)), seen[x]);
  });
  return makeHand(tiles);
}

// valid groups to make up 14 with the one under test
const fill9 = "| y1 y2 y3 | b10 r10 y10 | b2 b3 b4";
const fill10 = "| y1 y2 y3 | b10 r10 y10 | r2 r3 r4 r5";
const fill11 = "| y1 y2 y3 y4 | b10 r10 y10 k10 | r2 r3 r4";

test("a group is sets and runs side by side, never a mix of the two", () => {
  const refused = [
    `r5 r6 r7 b7 ${fill10}`, // a run turning into a set
    `k6 b6 r6 r7 ${fill10}`, // a set turning into a run
    `r5 r6 r7 b7 k7 ${fill9}`,
    `r5 b5 r5 ${fill11}`, // a set with a colour twice
    `r5 b5 k5 y5 r5 ${fill9}`,
    `r5 r6 r5 ${fill11}`, // a run going back
    `r2 r1 r13 ${fill11}`, // 13-1-2, backwards
    `r5 ok b9 ${fill11}`, // the okey doesn't join anything to anything
    `r5 fake b9 ${fill11}`, // a fake okey is the okey's face value, not wild
    `r5 r6 ok k9 b9 ${fill9}`,
    `r7 r5 r6 ${fill11}`, // a run as it lies on the rack
  ];
  for (const h of refused) assert.isFalse(checkFinished(hand(h), indicator), h);
  const finished = [
    "y1 y2 y3 y4 | b10 k10 y10 r10 | r11 r12 r13 r1 r2 r3", // two runs, no gap
    "r12 r13 r1 r2 r3 r4 | y1 y2 y3 y4 | b10 k10 y10 r10",
    "r5 r6 r7 b7 k7 y7 | y1 y2 y3 y4 | b2 b3 b4 b5", // a run, then a set
    `r7 r6 r5 ${fill11}`, // a run downwards
    `r5 ok r7 ${fill11}`, // the okey as the 6
  ];
  for (const h of finished) assert.isTrue(checkFinished(hand(h), indicator), h);
});
