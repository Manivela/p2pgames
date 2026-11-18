import { useContext, useEffect, useLayoutEffect, useRef } from "react";
import { OkeyContext } from "./OkeyContext";
import { symbols } from "./constants";
import { isOkey } from "./melds";
import { t } from "../../i18n";

// Moves animate from state diffs: tiles keep their ids within a deal, so
// comparing where each tile was and is now tells what happened, and a copy
// of it flies there (Web Animations, transform and opacity only). Other
// players' moves arrive over the network and would otherwise just appear.
// The tile you dragged has already landed; it only bounces. Tiles and the
// places they fly to are found by data-tile-id, data-seat, data-pile,
// data-meld and data-hand; a flight measures screen rects, which Chrome and
// WebKit both report right inside `zoom` (small piles, melds, shown hands).

const EASE = "cubic-bezier(.2,.8,.2,1)";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// the tab was hidden since the last diff: the next one is a catch-up
let wasHidden = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) wasHidden = true;
});

const q = (sel) => document.querySelector(sel);
// my rack's slot i; my rack is the first one
const slotEl = (i) =>
  q(".rack")?.querySelectorAll(
    ":scope > .top > .slot, :scope > .bottom > .slot",
  )[i];
// the tea glass in front of whoever's turn it is (TeaGlass.jsx)
const GLASS = ".glass:not(.idle)";
const seatEl = (p) =>
  q(`[data-seat="${p}"] .avatar`) ?? q(`[data-seat="${p}"]`);

// where every tile is
function places(s) {
  const at = new Map();
  s.drawPile?.forEach((tile) => at.set(tile.id, { in: "pile", tile }));
  for (const p of s.players) {
    p.hand?.forEach(
      (tile, i) => tile && at.set(tile.id, { in: "hand", p: p.id, i, tile }),
    );
    p.discardPile?.forEach((tile) =>
      at.set(tile.id, { in: "discard", p: p.id, tile }),
    );
    p.inbox?.forEach((tile) => at.set(tile.id, { in: "inbox", p: p.id, tile }));
  }
  s.melds?.forEach((m, k) =>
    m.tiles.forEach((tile) => at.set(tile.id, { in: "meld", m: k, tile })),
  );
  const last = s.finishTile;
  if (last) at.set(last.id, { in: "finish", tile: last });
  return at;
}

const same = (a, b) =>
  a.in === b.in && a.p === b.p && a.i === b.i && a.m === b.m;

// a tile as the table shows it, for a copy flying into a seat
function face(tile, up) {
  if (!up) return `<div class="tile back"></div>`;
  const color = tile.id.match(/^[a-z]+/)[0];
  const sym =
    tile.rank === "👌" ? "" : `<div class="sym">${symbols[color]}</div>`;
  return `<div class="tile c-${color}"><div class="rank">${tile.rank}</div>${sym}</div>`;
}

// the copies fly in a layer over the page, in screen pixels
let layer;
function overlay() {
  if (!layer?.isConnected) {
    layer = Object.assign(document.createElement("div"), {
      className: "flights",
    });
    document.body.append(layer);
  }
  return layer;
}

function copy(html) {
  const box = document.createElement("div");
  box.innerHTML = html;
  const el = box.firstElementChild;
  el.classList.remove("selected");
  el.removeAttribute("style");
  overlay().append(el);
  return el;
}

const place = (r, s) => `translate(${r.left}px, ${r.top}px) scale(${s})`;

// where a tile leaves or lands: a box holding tiles (a meld) or slots (the
// rack of a player you watch, its tiles hidden) is one of them in its
// middle, or the copy would be as wide as all of them
function tileRect(el) {
  const r = el.getBoundingClientRect();
  const t = el.querySelector(".tile, .slot")?.getBoundingClientRect();
  if (!t) return r;
  const { width: w, height: h } = t;
  return new DOMRect(r.x + (r.width - w) / 2, r.y + (r.height - h) / 2, w, h);
}

const land = (el) =>
  el.animate(
    [
      { translate: "0 -5px", scale: 1.06 },
      { translate: "0 0", scale: 1 },
    ],
    { duration: 180, easing: "ease-out" },
  );

// A copy flies from the rect `from` to the element `to`, which stays hidden
// until it lands; `into` a seat, it shrinks and fades into the avatar. One
// that lies turned (the latest discard, the tile thrown to finish) is
// measured upright, and the copy turns to its angle on the way, about its
// middle as the tile does, so it lands as the tile lies.
function fly(from, to, { html, delay = 0, duration = 360, into = false }) {
  if (!from || !to) return;
  const angle = into ? "none" : getComputedStyle(to).rotate;
  if (angle !== "none") to.style.rotate = "none";
  const b = tileRect(to);
  to.style.rotate = "";
  const el = copy(html ?? to.outerHTML);
  if (import.meta.env.DEV) window.okeyFlights = (window.okeyFlights ?? 0) + 1;
  // its own size, before scaling (an svg has no offsetWidth)
  const { width: w, height: h } = el.getBoundingClientRect();
  const s = from.width / w;
  const turn = (deg) =>
    into
      ? ""
      : ` translate(${w / 2}px, ${h / 2}px) rotate(${deg}) translate(${-w / 2}px, ${-h / 2}px)`;
  const end = into
    ? `translate(${b.left + b.width / 2 - (w * s) / 4}px, ${
        b.top + b.height / 2 - (h * s) / 4
      }px) scale(${s / 2})`
    : place(b, b.width / w) + turn(angle === "none" ? "0deg" : angle);
  if (!into) to.style.visibility = "hidden";
  const done = () => {
    el.remove();
    if (into) return;
    to.style.visibility = "";
    land(to);
  };
  el.animate(
    [
      { transform: place(from, s) + turn("0deg"), opacity: 1 },
      { transform: end, opacity: into ? 0 : 1 },
    ],
    { duration, delay, easing: EASE, fill: "both" },
  ).finished.then(done, done);
}

// The element itself slides from the rect `from` to where it is, over the
// table as a copy would fly: for the tea glass, whose copy (80 elements)
// held up the frame of each turn
function slide(from, el, duration) {
  const b = el.getBoundingClientRect();
  const s = from.width / b.width;
  const at = { zIndex: 20, transformOrigin: "0 0" };
  el.animate(
    [
      {
        ...at,
        transform: `translate(${from.left - b.left}px, ${from.top - b.top}px) scale(${s})`,
      },
      { ...at, transform: "none" },
    ],
    { duration, easing: EASE },
  ).finished.then(
    () => land(el),
    () => {},
  );
}

// a word or number rising off an element
function pop(at, text, className = "pop") {
  if (!at) return;
  const r = at.getBoundingClientRect();
  const el = copy(`<div class="${className}"></div>`);
  el.textContent = text;
  const x = r.left + r.width / 2 - el.offsetWidth / 2;
  // near the top edge it drops below instead of rising off the screen
  const y = r.top > 60 ? r.top - el.offsetHeight - 6 : r.bottom + 6;
  const go = (dy, s) => `translate(${x}px, ${y + dy}px) scale(${s})`;
  return el
    .animate(
      [
        { opacity: 0, transform: go(10, 0.6) },
        { opacity: 1, transform: go(-6, 1.1), offset: 0.25 },
        { opacity: 1, transform: go(-10, 1), offset: 0.8 },
        { opacity: 0, transform: go(-22, 1) },
      ],
      { duration: 1300, easing: "ease-out" },
    )
    .finished.then(() => el.remove());
}

// a number rises off `from` and drifts to `to`
function drift(from, to, text) {
  if (!from || !to) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const el = copy(`<div class="score fine"></div>`);
  el.textContent = text;
  const x = a.left + a.width / 2 - el.offsetWidth / 2;
  const at = (dx, dy, s = 1) =>
    `translate(${x + dx}px, ${a.top + dy}px) scale(${s})`;
  const dx = b.left + b.width / 2 - a.left - a.width / 2;
  const dy = b.top + b.height / 2 - a.top;
  el.animate(
    [
      { transform: at(0, 0), opacity: 0 },
      { transform: at(0, -18), opacity: 1, offset: 0.25 },
      { transform: at(dx, dy), opacity: 1, offset: 0.85 },
      { transform: at(dx, dy, 0.6), opacity: 0 },
    ],
    { duration: 1300, easing: "ease-in-out", fill: "forwards" },
  ).finished.then(() => el.remove());
}

// a round score counting up by a seat, then fading
function countUp(at, value) {
  if (!at) return;
  const r = at.getBoundingClientRect();
  const el = copy(`<div class="score"></div>`);
  el.textContent = `${value}`;
  // towards the table: under a seat along the top, over your name
  const x = r.left + r.width / 2 - el.offsetWidth / 2;
  const y =
    r.top < innerHeight / 2 ? r.bottom + 6 : r.top - 6 - el.offsetHeight;
  el.style.transform = `translate(${x}px, ${y}px)`;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / 700);
    el.textContent = `${Math.round(value * k)}`;
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], {
    duration: 2400,
  }).finished.then(() => el.remove());
}

function deal(next, me) {
  const pile = q(".draw .stack")?.getBoundingClientRect();
  const indicator = q(".draw .indicator");
  const mine = next.players.find((p) => p.id === me)?.hand ?? [];
  const others = next.players.filter((p) => p.id !== me);
  const rounds = Math.max(
    ...next.players.map((p) => p.hand.filter(Boolean).length),
  );
  let i = 0;
  mine.forEach((tile, slot) => {
    const el = tile && slotEl(slot)?.querySelector(".tile");
    if (el)
      fly(pile, el, {
        html: face(tile, false),
        delay: i++ * 110,
        duration: 300,
      });
  });
  for (let k = 0; k < rounds; k++) {
    others.forEach((p, j) => {
      if (k < p.hand.filter(Boolean).length) {
        fly(pile, seatEl(p.id), {
          html: face(null, false),
          delay: k * 110 + (j + 1) * 27,
          duration: 300,
          into: true,
        });
      }
    });
  }
  indicator?.animate(
    [
      { transform: "rotateY(90deg)", opacity: 1 },
      { transform: "rotateY(0)", opacity: 1 },
    ],
    {
      duration: 280,
      delay: rounds * 110 + 300,
      easing: EASE,
      fill: "backwards",
    },
  );
}

export function useMoves() {
  const { okeyState, me, dragged } = useContext(OkeyContext);
  const last = useRef(null);
  const glass = useRef(null);
  // where tiles won into my inbox came from, to fly from once they're racked
  const won = useRef(new Map());
  useEffect(() => () => layer?.remove(), []);

  // after Melds' layout effect (AmericanoTable.jsx), which rescales them
  useLayoutEffect(() => {
    const next = okeyState;
    const prev = last.current;
    last.current = {
      deal: next.deal,
      gameState: next.gameState,
      currentPlayer: next.currentPlayer,
      at: places(next),
      caught: next.players.flatMap((p) =>
        (p.caught ?? []).map((id) => [p.id, id]),
      ),
      wrong: next.players.map((p) => [p.id, p.calls?.wrong ?? 0]),
    };
    const oldGlass = glass.current;
    glass.current = q(GLASS)?.getBoundingClientRect() ?? null;
    const drop = dragged.current;
    dragged.current = null;
    const skip = !prev || reduced() || wasHidden || document.hidden;
    wasHidden = false;
    if (skip) return;

    // a new deal: the next one reuses tile ids, so there's nothing to compare
    if (next.deal !== prev.deal) {
      won.current.clear();
      const fresh =
        next.gameState === "play" &&
        !next.lastDiscard &&
        next.players.every((p) => !p.discardPile.length);
      if (fresh) deal(next, me);
      return;
    }

    const moves = [];
    for (const [id, to] of last.current.at) {
      const from = prev.at.get(id);
      if (from && !same(from, to)) moves.push({ id, from, to });
    }
    // ponytail: a catch-up (a phone waking, a script) moves many tiles at
    // once; skip it whole. A turn moves a handful, a full lay up to 14.
    const discards = moves.filter((m) => m.to.in === "discard").length;
    if (discards > 1 || moves.length > 20) return;

    let laid = 0;
    for (const { id, from, to } of moves) {
      const fromEl =
        from.in === "pile"
          ? q(".draw .stack")
          : from.in === "discard"
            ? q(`[data-pile="${from.p}"] .slot`)
            : from.in === "meld"
              ? q(`[data-meld="${from.m}"]`)
              : from.p === me && from.in === "hand"
                ? slotEl(from.i)
                : seatEl(from.p);
      const fromRect = fromEl && tileRect(fromEl);
      const upFrom = from.in === "discard" || from.in === "meld";

      if (to.in === "hand" && to.p === me) {
        const el = slotEl(to.i)?.querySelector(".tile");
        if (!el) continue;
        if (from.in === "inbox") {
          fly(won.current.get(id), el, {});
          won.current.delete(id);
        } else if (id === drop) land(el);
        // only my own drops move tiles along my rack, and the rack showed
        // where they'd go while the tile was held (Rack.jsx)
        else if (from.in !== "hand") fly(fromRect, el, {});
      } else if (to.in === "inbox" && to.p === me) {
        // they fly once my rack takes them, into their slots
        won.current.set(id, fromRect);
      } else if (to.in === "hand" || to.in === "inbox") {
        if (from.in === "inbox" || from.in === "hand") continue;
        const target = to.p === me ? q(".rack") : seatEl(to.p);
        // an okey on the table lies face down (Tile.jsx)
        const up =
          upFrom && !(from.in === "meld" && isOkey(from.tile, next.okeyTile));
        fly(fromRect, target, { html: face(from.tile, up), into: true });
      } else if (to.in === "discard" || to.in === "finish") {
        const el =
          to.in === "finish"
            ? q(".draw .thrown")
            : q(`[data-pile="${to.p}"] [data-tile-id="${id}"]`);
        if (id === drop) el && land(el);
        else fly(fromRect, el, {});
      } else if (to.in === "meld") {
        const el =
          q(`.melds [data-tile-id="${id}"]`) ?? q(`[data-meld="${to.m}"]`);
        fly(fromRect, el, {
          html: el?.matches(".tile") ? undefined : face(to.tile, true),
          delay: laid++ * 90,
        });
      }
    }

    // the turn passed: the tea glass slides to the next seat
    const newGlass = q(GLASS);
    if (
      oldGlass &&
      newGlass &&
      next.gameState === "play" &&
      next.currentPlayer !== prev.currentPlayer
    ) {
      slide(oldGlass, newGlass, 400);
    }

    // a catch: the tile stays on its pile, stamped; the catcher calls it,
    // and the penalty drifts to whoever threw it
    const seen = new Set(prev.caught.map(([p, id]) => `${p}:${id}`));
    for (const [p, id] of last.current.caught) {
      if (seen.has(`${p}:${id}`)) continue;
      const tile = q(`.discardPile [data-tile-id="${id}"]`);
      const from = next.players.find((x) =>
        x.discardPile.some((y) => y.id === id),
      );
      tile?.animate([{ scale: 1.35 }, { scale: 1 }], {
        duration: 320,
        easing: EASE,
      });
      pop(p === me ? q(".rack > .playerName") : seatEl(p), t("Call!"));
      if (from)
        drift(
          tile,
          from.id === me ? q(".rack > .playerName") : seatEl(from.id),
          `+${next.rules?.catchPenalty}`,
        );
    }

    // a wrong call (okey.catchDiscard), over whoever made it
    const before = new Map(prev.wrong);
    for (const [p, wrong] of last.current.wrong) {
      if (wrong <= (before.get(p) ?? wrong)) continue;
      pop(p === me ? q(".rack > .playerName") : seatEl(p), t("Wrong call!"));
    }

    // round over: the finisher's tiles wave, the others' scores count up
    if (prev.gameState === "play" && next.gameState !== "play") {
      const i = next.round - 1;
      // nobody finishes when the pile runs out
      const finisher = next.turnMoves?.find((m) => m.move === "finished")?.by;
      const tiles =
        finisher === undefined
          ? []
          : [
              ...document.querySelectorAll(`[data-hand="${finisher}"] .tile`),
              ...(next.melds ?? []).flatMap((m, k) =>
                m.owner === finisher
                  ? [...document.querySelectorAll(`[data-meld="${k}"] .tile`)]
                  : [],
              ),
            ];
      tiles.forEach((el, j) =>
        el.animate(
          [
            { translate: "0 0" },
            { translate: "0 -10px" },
            { translate: "0 0" },
          ],
          { duration: 420, delay: j * 40, easing: "ease-in-out" },
        ),
      );
      if (next.rules) {
        for (const p of next.players) {
          const score = next.scores?.[p.id]?.[i];
          if (p.id === finisher || !score) continue;
          countUp(p.id === me ? q(".rack > .playerName") : seatEl(p.id), score);
        }
      }
    }
  }, [okeyState, me, dragged]);
}
