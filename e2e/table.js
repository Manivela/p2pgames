// Loaded in the page by the e2e tests (the dev server serves it): sets up
// positions through the real rules with the dev-only window.okey, and finds
// elements that overlap or fall off the screen.
import * as okey from "../src/Components/Okey/okey.js";
import {
  AMERICANO,
  CLASSIC,
  ONE_O_ONE,
} from "../src/Components/Okey/rulesets.js";

const NAMES = {
  2: "Bora",
  3: "Can",
  4: "Deniz",
  5: "Ece",
  6: "Ferhat",
  7: "Gül",
  8: "Hakan",
};
// seat 1 holds these from the deal: a küt that opens round 1
export const KUT = ["red7-0", "blue7-0", "black7-0"];

const ok = (s) => {
  if (typeof s === "string") throw new Error(s);
  return s;
};
const seat = (s, id) => s.players.find((p) => p.id === id);

// bots in seats 2..n; they share my awareness key, so they stay seated
export function seatBots(n) {
  const s = window.okey.get();
  const { userKey } = seat(s, 1);
  window.okey.set({
    ...s,
    players: s.players.map((p) =>
      p.id > 1 && p.id <= n
        ? { ...p, user: { id: `bot${p.id}`, name: NAMES[p.id] }, userKey }
        : p,
    ),
  });
}

// n players dealt the same tiles every run: a fixed shuffle (tile i goes
// to i * 37 mod the pile's size), seat 1's hand starting with KUT. mode:
// "americano", "101" or "classic"; options: changes to its rules (101's
// partners, doubling; seats and tileSets for more players)
export function start(n, mode = "americano", options = {}) {
  seatBots(n);
  const preset = { americano: AMERICANO, 101: ONE_O_ONE, classic: CLASSIC };
  const rules = { ...preset[mode], ...options };
  const size = rules.handSize;
  const tiles = okey.tileSet(rules.tileSets);
  const drawPile = tiles.map((_, i) => ({
    ...tiles[(i * 37) % tiles.length],
    hidden: true,
  }));
  const rest = drawPile.map((t) => t.id).filter((id) => !KUT.includes(id));
  const hands = [[...KUT, ...rest.splice(0, size + 1 - KUT.length)]];
  for (let i = 1; i < n; i++) hands.push(rest.splice(0, size));
  const deal = { okeyTile: rest.find((id) => !id.includes("👌")), hands };
  const s = { ...window.okey.get(), drawPile };
  window.okey.set(ok(okey.startGame(s, deal, rules)));
}

// whoever's turn it is draws from the pile and throws their last tile
function turn(s) {
  const id = s.currentPlayer;
  if (!s.drawn) {
    const slot = seat(s, id).hand.indexOf(null);
    s = ok(okey.drawTile(s, id, s.drawPile.at(-1), slot, 0));
  }
  const last = seat(s, id).hand.findLast(Boolean);
  return ok(okey.discardTile(s, id, last, Infinity));
}

export function play(turns) {
  let s = window.okey.get();
  for (let i = 0; i < turns && s.gameState === "play"; i++) s = turn(s);
  window.okey.set(s);
}

// everyone plays until it's seat 1's turn again, and seat 1 draws (unless
// `draw` is false)
export function toMyTurn(draw = true) {
  let s = turn(window.okey.get());
  while (s.currentPlayer !== 1) s = turn(s);
  const slot = seat(s, 1).hand.indexOf(null);
  if (draw) s = ok(okey.drawTile(s, 1, s.drawPile.at(-1), slot, 0));
  window.okey.set(s);
}

// seat id asks for the discard on offer, into its first free slot
export function claim(id) {
  const s = window.okey.get();
  const slot = seat(s, id).hand.indexOf(null);
  window.okey.set(ok(okey.claimDiscard(s, id, slot)));
}

export function openKut() {
  window.okey.set(ok(okey.openHand(window.okey.get(), 1, [KUT])));
}

// nobody finishes: the round ends when the pile runs out
export function playToEnd() {
  let s = window.okey.get();
  while (s.gameState === "play") s = turn(s);
  window.okey.set(s);
}

// classic: everyone plays until the pile runs out, then it's seat 1's turn
export function emptyPile() {
  let s = window.okey.get();
  while (s.drawPile.length) s = turn(s);
  window.okey.set({ ...s, currentPlayer: 1 });
}

// tile `id` into my slot `at` (the first), swapped with the tile there
function intoMyFirstSlot(s, id, at = 0) {
  const me = seat(s, 1);
  const mine = me.hand[at];
  const places = [
    s.drawPile,
    ...s.players.flatMap((p) => [p.hand, p.discardPile]),
  ];
  const list = places.find((l) => l.some((t) => t?.id === id));
  const i = list.findIndex((t) => t?.id === id);
  me.hand[at] = { ...list[i], source: "hand-1", hidden: false };
  list[i] = mine && { ...mine, source: list[i].source, hidden: list[i].hidden };
}

// I've opened, and my rack starts with red 3-4-5 and a gap after them
export function runFirst() {
  const s = structuredClone(window.okey.get());
  const hand = seat(s, 1).hand;
  hand[hand.indexOf(null)] = hand[3];
  hand[3] = null;
  ["red3-1", "red4-1", "red5-1"].forEach((id, i) => intoMyFirstSlot(s, id, i));
  s.opened = { ...s.opened, 1: true };
  s.justOpened = null;
  window.okey.set(s);
}

// I've opened, an okey is in my first slot (swapped with the tile there),
// and a 6-7-8 seri in another colour is on the table
export function okeyAndSeri() {
  const s = structuredClone(window.okey.get());
  const name = (id) => id.replace(/\d+-\d+$/, "");
  const wild = `${name(s.okeyTile.id)}${(s.okeyTile.rank % 13) + 1}-0`;
  intoMyFirstSlot(s, wild);
  const color = ["red", "blue", "black", "yellow"].find(
    (c) => c !== name(wild),
  );
  const tiles = [6, 7, 8].map((r) => ({
    ...okey.tiles.find((t) => t.id === `${color}${r}-1`),
    source: "table",
    hidden: false,
  }));
  s.melds = [{ type: "seri", owner: 2, tiles }];
  s.opened = { ...s.opened, 1: true };
  s.justOpened = null;
  window.okey.set(s);
  return wild;
}

// okeyAndSeri, and the tiles either side of its seri in my slots 1 and 2
export function seriAndEnds() {
  okeyAndSeri();
  const s = structuredClone(window.okey.get());
  const ends = [5, 9].map((r) =>
    s.melds[0].tiles[0].id.replace(/\d+-1$/, `${r}-0`),
  );
  ends.forEach((id, i) => intoMyFirstSlot(s, id, i + 1));
  window.okey.set(s);
  return ends;
}

// n more runs on the table, for a crowded one (only shown: they don't come
// out of anyone's hand)
export function crowd(n = 8) {
  const s = window.okey.get();
  const tile = (id) => ({
    ...okey.tiles.find((t) => t.id === id),
    source: "table",
    hidden: false,
  });
  const starts = [
    ["red", 1],
    ["blue", 5],
    ["black", 9],
    ["yellow", 2],
    ["red", 8],
    ["blue", 10],
    ["yellow", 6],
    ["black", 3],
  ];
  const runs = Array.from({ length: n }, (_, i) => {
    const [color, from] = starts[i % starts.length];
    const copy = 1 - Math.floor(i / starts.length);
    return {
      type: "seri",
      owner: (i % 4) + 1,
      tiles: [0, 1, 2, 3].map((k) => tile(`${color}${from + k}-${copy}`)),
    };
  });
  window.okey.set({ ...s, melds: [...s.melds, ...runs] });
}

const SEL = [
  ".foot > .rack",
  ".seat",
  ".seat .badges",
  ".glass",
  ".hand",
  ".draw .stack",
  ".draw .indicator",
  ".discardPile",
  ".playerName",
  ".rack > .playerName .tilesLeft",
  ".side > *",
  ".center > button",
  ".meld",
  ".scores",
  ".update",
  ".corner button",
  ".table-menu",
  ".discardPile .catch",
  ".discardPile .take",
];

const label = (e) =>
  `${e.tagName.toLowerCase()}.${[...e.classList].join(".")} "${e.textContent
    .trim()
    .slice(0, 18)}"`;

// the table's parts that overlap each other or leave the screen; `ignore`:
// selectors that open over the table on purpose. Measured two frames on:
// the table sizes itself (--t, Board.jsx) in a ResizeObserver, in the
// frame after it renders, before that frame is painted
export async function check(ignore = []) {
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  );
  const els = [
    ...new Set(SEL.flatMap((s) => [...document.querySelectorAll(s)])),
  ].filter((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return (
      // a copy flying from one place to the next (moves.js) isn't laid out,
      // nor the tea glass sliding to the next seat
      !e.closest(".flights") &&
      !(e.matches(".glass") && e.getAnimations().length) &&
      r.width > 0 &&
      r.height > 0 &&
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      !ignore.some((s) => e.matches(s))
    );
  });
  // melds scrolled out of their band aren't visible
  const band = document.querySelector(".melds")?.getBoundingClientRect();
  const rect = (e) => {
    const r = e.getBoundingClientRect();
    if (!band || !e.classList.contains("meld")) return r;
    return {
      left: r.left,
      right: r.right,
      top: Math.max(r.top, band.top),
      bottom: Math.min(r.bottom, band.bottom),
    };
  };
  const overlaps = [];
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      const [a, b] = [els[i], els[j]];
      if (a.contains(b) || b.contains(a)) continue;
      const [p, q] = [rect(a), rect(b)];
      const w = Math.min(p.right, q.right) - Math.max(p.left, q.left);
      const h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (w > 1 && h > 1) overlaps.push(`${label(a)} × ${label(b)}`);
    }
  }
  const offscreen = els
    .filter((e) => {
      const r = e.getBoundingClientRect();
      return (
        r.left < -1 ||
        r.top < -1 ||
        r.right > innerWidth + 1 ||
        r.bottom > innerHeight + 1
      );
    })
    .map(label);
  return { overlaps, offscreen };
}
