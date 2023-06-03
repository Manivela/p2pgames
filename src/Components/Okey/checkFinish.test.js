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
        createTile("black", 11),
        createTile("black", 12),
        createTile("yellow", "👌"),
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
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
      indicator
    )
  );
});
