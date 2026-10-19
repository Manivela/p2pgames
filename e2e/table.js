// Loaded in the page by the e2e tests (the dev server serves it): sets up
// positions through the real rules with the dev-only window.okey, and finds
// elements that overlap or fall off the screen.
import * as game from "../src/Components/Okey/game.js";
import * as americano from "../src/Components/Okey/americano.js";

const NAMES = { 2: "Bora", 3: "Can", 4: "Deniz" };
// seat 1 holds these from the deal: a küt that opens round 1
export const KUT = ["red7-0", "blue7-0", "black7-0"];

const ok = (s) => {
  if (typeof s === "string") throw new Error(s);
  return s;
};
const seat = (s, id) => s.players.find((p) => p.id === id);

// bots in seats 2..n; they share my awareness key, so they stay seated
function seatBots(n) {
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
// to i * 37 mod 106), seat 1's hand starting with KUT
export function start(n, mode = "americano") {
  seatBots(n);
  const drawPile = game.tiles.map((_, i) => ({
    ...game.tiles[(i * 37) % game.tiles.length],
    hidden: true,
  }));
  const rest = drawPile.map((t) => t.id).filter((id) => !KUT.includes(id));
  const hands = [[...KUT, ...rest.splice(0, 12)]];
  for (let i = 1; i < n; i++) hands.push(rest.splice(0, 14));
  const deal = { okeyTile: rest.find((id) => !id.includes("👌")), hands };
  const rules = mode === "americano" ? americano : game;
  window.okey.set(
    ok(rules.startGame({ ...window.okey.get(), drawPile }, deal)),
  );
}

// whoever's turn it is draws from the pile and throws their last tile
function turn(s) {
  const rules = s.mode === "americano" ? americano : game;
  const id = s.currentPlayer;
  if (!s.drawn) {
    const slot = seat(s, id).hand.indexOf(null);
    s = ok(rules.drawTile(s, id, s.drawPile.at(-1), slot, 0));
  }
  const last = seat(s, id).hand.findLast(Boolean);
  return ok(rules.discardTile(s, id, last, Infinity));
}

export function play(turns) {
  let s = window.okey.get();
  for (let i = 0; i < turns && s.gameState === "play"; i++) s = turn(s);
  window.okey.set(s);
}

// everyone plays until it's seat 1's turn again, and seat 1 draws
export function toMyTurn() {
  let s = turn(window.okey.get());
  while (s.currentPlayer !== 1) s = turn(s);
  const slot = seat(s, 1).hand.indexOf(null);
  window.okey.set(ok(americano.drawTile(s, 1, s.drawPile.at(-1), slot, 0)));
}

export function openKut() {
  window.okey.set(ok(americano.openHand(window.okey.get(), 1, [KUT])));
}

// nobody finishes: the round ends when the pile runs out
export function playToEnd() {
  let s = window.okey.get();
  while (s.gameState === "play") s = turn(s);
  window.okey.set(s);
}

const SEL = [
  ".board > .rack",
  ".opponents > .rack",
  ".discardPile",
  ".playerName",
  ".board > .drawPile",
  ".board > button",
  ".round",
  ".meld",
  ".scores",
  ".pile",
  ".actions > *",
  ".fullscreen-toggle",
  ".menu-toggle",
  ".table-menu",
  ".discardPile .catch",
];

const label = (e) =>
  `${e.tagName.toLowerCase()}.${[...e.classList].join(".")} "${e.textContent
    .trim()
    .slice(0, 18)}"`;

// the table's parts that overlap each other or leave the screen; `ignore`:
// selectors that open over the table on purpose
export function check(ignore = []) {
  const els = [
    ...new Set(SEL.flatMap((s) => [...document.querySelectorAll(s)])),
  ].filter((e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return (
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
