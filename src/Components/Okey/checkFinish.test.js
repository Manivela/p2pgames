import { assert, test } from "vitest";
import { checkFinished } from "./checkFinish";
import { createTile, maxHandSize } from "./OkeyContext";

function makeHand(hand) {
  const paddedHand = hand.concat(Array(maxHandSize - hand.length));
  assert.equal(paddedHand.length, maxHandSize);
  assert.equal(paddedHand.filter((h) => h !== null).length, 14);
  return paddedHand;
}

const okey = createTile("black", 13, 1);

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
      okey
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
        createTile("black", 1, 1),
        createTile("black", 1, 2),
        createTile("red", 3, 1),
        createTile("red", 3, 2),
        createTile("red", 5),
        okey,
      ]),
      okey
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
      okey
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
      okey
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
      okey
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
      okey
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
      okey
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
      okey
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
      okey
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
      okey
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
      okey
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
      okey
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
      okey
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
      okey
    )
  );
});

test("different color sequences can't win", () => {
  assert.isFalse(
    checkFinished(
      makeHand([
        createTile("red", 1),
        createTile("black", 2),
        okey,
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
      okey
    )
  );
});
