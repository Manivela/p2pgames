import { countBy } from "lodash";
import { colorOf, meldOrder, rankOf } from "./melds";

// The classic finish (and Elden's): every group of tiles between gaps on
// the rack cuts into sets and runs of 3+ side by side, or the hand is seven
// pairs. The same meld rules as Americano's (melds.js): a set is one rank in
// different colours, a run one colour in a row (12-13-1 but not 13-1-2),
// the okey wild in either and a fake okey the okey's face value.

// a run as it lies on the rack, up or down; an okey stands where it was put
const inOrder = (tiles, ind) => meldOrder(tiles, "seri", ind) === tiles;
const isMeld = (tiles, ind) =>
  inOrder(tiles, ind) ||
  inOrder([...tiles].reverse(), ind) ||
  !!meldOrder(tiles, "kut", ind);

// whether a group cuts into melds: done[j], its first j tiles do
function cuts(group, ind) {
  const done = [true];
  for (let j = 3; j <= group.length; j++) {
    done[j] = done.some(
      (ok, i) => ok && j - i >= 3 && isMeld(group.slice(i, j), ind),
    );
  }
  return !!done[group.length];
}

export const checkFinished = (hand, ind) => {
  const tiles = hand.filter(Boolean);
  // seven pairs: each tile twice (the okey isn't wild here)
  const twice = countBy(tiles, (t) => `${colorOf(t, ind)}-${rankOf(t, ind)}`);
  if (Object.values(twice).every((n) => n === 2)) return true;
  const groups = [[]];
  for (const t of hand) t ? groups.at(-1).push(t) : groups.push([]);
  return groups.every((g) => !g.length || cuts(g, ind));
};
