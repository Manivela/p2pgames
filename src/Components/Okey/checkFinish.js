import { countBy } from "lodash";
import { colorOf, meldOrder, rankOf } from "./melds";

// The classic finish (and Elden's): every group of tiles between gaps on
// the rack cuts into sets and runs of 3+ side by side, or the hand is seven
// pairs. The same meld rules as Americano's (melds.js): a set is one rank in
// different colours, a run one colour in a row (12-13-1 but not 13-1-2;
// no 12-13-1 without `wrap`, as in Americano), the okey wild in either and
// a fake okey the okey's face value.

// a run as it lies on the rack, up or down; an okey stands where it was put
const inOrder = (tiles, ind, wrap) =>
  meldOrder(tiles, "seri", ind, wrap) === tiles;
const isMeld = (tiles, ind, wrap) =>
  inOrder(tiles, ind, wrap) ||
  inOrder([...tiles].reverse(), ind, wrap) ||
  !!meldOrder(tiles, "kut", ind);

// whether a group cuts into melds: done[j], its first j tiles do
function cuts(group, ind, wrap) {
  const done = [true];
  for (let j = 3; j <= group.length; j++) {
    done[j] = done.some(
      (ok, i) => ok && j - i >= 3 && isMeld(group.slice(i, j), ind, wrap),
    );
  }
  return !!done[group.length];
}

export const checkFinished = (hand, ind, wrap = true) => {
  const tiles = hand.filter(Boolean);
  // seven pairs: each tile twice (the okey isn't wild here)
  const twice = countBy(tiles, (t) => `${colorOf(t, ind)}-${rankOf(t, ind)}`);
  if (Object.values(twice).every((n) => n === 2)) return true;
  const groups = [[]];
  for (const t of hand) t ? groups.at(-1).push(t) : groups.push([]);
  return groups.every((g) => !g.length || cuts(g, ind, wrap));
};
