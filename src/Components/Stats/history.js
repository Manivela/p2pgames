import { isEqual, isPlainObject, omit, sortBy, sum } from "lodash";
import { outcome } from "../Okey/okey";
import { BAR } from "../Backgammon/rules";

// A game as this device records it (store.js): after every change seen, a
// step with what changed (`ops`) since the one before, a short hash of the
// game after it (`h`) and the hash it follows on from (`from`; null for the
// whole game: the first step, or the first after the page was closed, a
// gap). Nothing is said about what a move was: every stat is worked out
// afterwards from the replay (summarize), so one thought of later counts
// every game already recorded. A step that doesn't follow on from the hash
// so far (a second tab's copy of it) is passed over, so copies of a game
// can be put together as they are.

// JSON with every object's keys in order: the same game is the same text,
// and the same hash, on every page
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    isPlainObject(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );

// FNV-1a, 32 bits
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// Okey as it's recorded: where each tile is (`tiles`, its id → p the pile,
// h2 seat 2's rack, d2 its discards, i2 its inbox, m3 the fourth meld, f
// the tile that finished), and the rest of the state as it is. Not the
// order of a rack, rearranged all game long.
export function okeyView(s) {
  const tiles = {};
  const put = (list, at) => list?.forEach((t) => t && (tiles[t.id] = at));
  put(s.drawPile, "p");
  for (const p of s.players) {
    put(p.hand, `h${p.id}`);
    put(p.discardPile, `d${p.id}`);
    put(p.inbox, `i${p.id}`);
  }
  s.melds?.forEach((m, k) => put(m.tiles, `m${k}`));
  put([s.finishTile], "f");
  return {
    ...omit(s, ["drawPile", "finishTile"]),
    melds: s.melds?.map((m) => omit(m, "tiles")),
    players: s.players.map((p) =>
      omit(p, ["hand", "discardPile", "inbox", "rowSlots"]),
    ),
    tiles,
  };
}

// a game of `kind` as it's recorded, plain JSON, and its hash
export function snapshot(kind, state) {
  const text = canonical(kind === "okey" ? okeyView(state) : state);
  return { view: JSON.parse(text), h: hash(text) };
}

const isObject = (v) => v !== null && typeof v === "object";

// What changed from `a` to `b`, plain JSON both: [path, value] for each
// value set, [path] for a key gone; an array shorter by its length
export function diff(a, b, path = [], out = []) {
  if (isObject(a) && isObject(b) && Array.isArray(a) === Array.isArray(b)) {
    const list = Array.isArray(b);
    if (list && b.length < a.length) out.push([[...path, "length"], b.length]);
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (list && Number(k) >= b.length) continue;
      if (!(k in b)) out.push([[...path, k]]);
      else diff(a[k], b[k], [...path, k], out);
    }
  } else if (!isEqual(a, b)) out.push([path, b]);
  return out;
}

// `node` with `value` ([] to remove) at `path`, copying only the objects
// on the way: the step before keeps its own
function setIn(node, [k, ...rest], value) {
  if (k === undefined) return value[0];
  const copy = Array.isArray(node) ? [...node] : { ...node };
  if (rest.length) copy[k] = setIn(copy[k], rest, value);
  else if (value.length) copy[k] = value[0];
  else delete copy[k];
  return copy;
}

export const patch = (view, ops) =>
  ops.reduce((v, [path, ...value]) => setIn(v, path, value), view);

// the step from `last` ({ view, h }, or none) to `now`, at `at`, or null
// when nothing changed
export function step(last, now, at) {
  if (last?.h === now.h) return null;
  return {
    at,
    from: last?.h ?? null,
    h: now.h,
    ops: diff(last?.view ?? {}, now.view),
  };
}

// the game after each step that follows on, in order: { view, at, h, gap }
export function replay(steps) {
  const out = [];
  let last = null;
  for (const s of steps) {
    let view;
    // where it is already (the same step, or the whole game, again)
    if (last && s.h === last.h) continue;
    if (s.from === null) view = patch({}, s.ops);
    else if (last && s.from === last.h) view = patch(last.view, s.ops);
    else continue;
    last = { view, at: s.at, h: s.h, gap: s.from === null && !!last };
    out.push(last);
  }
  return out;
}

// What each seat did, by game, from two steps in a row: add(seat, count)

// Okey, within a round in play: who took whose discard (from the side, or
// claimed out of turn), whose tiles were caught by whom, who called wrongly,
// who finished the round and who opened first
function okeyCounts(prev, view, add) {
  // a deal, a round dealt again, a game set up: tiles dealt, not played
  if (
    prev.gameState !== "play" ||
    prev.deal !== view.deal ||
    prev.round !== view.round
  ) {
    return;
  }
  for (const [id, to] of Object.entries(view.tiles)) {
    const from = prev.tiles[id];
    if (!from || from === to) continue;
    const [a, x, b, y] = [from[0], from.slice(1), to[0], to.slice(1)];
    if (a === "d" && (b === "h" || b === "i") && x !== y) {
      add(y, b === "h" ? "took" : "claimed");
      add(x, "fed");
    }
    // a taken discard put back on its pile (101)
    if (a === "h" && b === "d" && x !== y) {
      add(x, "took", -1);
      add(y, "fed", -1);
    }
    if (b === "f") add(x, "finished");
  }
  for (const p of view.players) {
    const was = prev.players.find((q) => q.id === p.id);
    // a call of a tile that didn't fit (okey.catchDiscard)
    const wrong = (p.calls?.wrong ?? 0) - (was?.calls?.wrong ?? 0);
    if (wrong > 0) add(p.id, "wrong", wrong);
    const before = was?.caught ?? [];
    for (const id of p.caught ?? []) {
      if (before.includes(id)) continue;
      add(p.id, "caught");
      // still on the pile of whoever threw it
      if (view.tiles[id]?.[0] === "d") add(view.tiles[id].slice(1), "dropped");
    }
  }
  if (!Object.keys(prev.opened ?? {}).length) {
    for (const p of Object.keys(view.opened ?? {})) add(p, "first");
  }
}

// Backgammon (not the checkers on the back of its case): dice rolled,
// doubles among them, and checkers sent to the bar, by who sent them
function backgammonCounts(prev, view, add) {
  if (!view.checkers || !prev.checkers) return;
  if (view.rolled !== prev.rolled) {
    add(view.by, "rolls");
    if (view.dice[0] === view.dice[1]) add(view.by, "doubles");
  }
  for (const s of [0, 1]) {
    const hit = view.checkers[s][BAR] - prev.checkers[s][BAR];
    if (hit > 0) add(1 - s, "hits", hit);
  }
}

const COUNTS = { okey: okeyCounts, backgammon: backgammonCounts };

// the stats a game's summary has, worked out again for every game recorded
// whenever this changes
export const VERSION = 3;

// Okey's titles, a count each: who did it most at that game's table
export const TITLES = {
  took: "The Scavenger",
  fed: "The Feeder",
  claimed: "The Snatcher",
  caught: "Hawk-eye",
  dropped: "Butterfingers",
  finished: "The Closer",
  first: "Early Bird",
  wrong: "Cries Wolf",
};

// A title goes only to someone who stood out at this game, by its counts
// alone: at least LEAST of a thing, and more than chance gives, Z standard
// deviations over an even share of the table's (as if everyone seated were
// as likely to do each one), so doing it once, or about as often as the
// others, earns nothing; a tie at the top neither. One title a player,
// where they stood out most.
// ponytail: one bar for every count; give a count its own if some title
// turns out never, or always, to be earned
const LEAST = 3;
const Z = 1.5;

export function withTitles(players) {
  const n = players.length;
  const picks = Object.keys(TITLES)
    .flatMap((k) => {
      const counts = players.map((p) => Math.max(p[k] ?? 0, 0));
      const total = sum(counts);
      const [top, next = 0] = [...counts].sort((a, b) => b - a);
      const z = (top - total / n) / Math.sqrt((total * (n - 1)) / n ** 2);
      if (top < LEAST || top === next || !(z >= Z)) return [];
      return [{ id: players[counts.indexOf(top)].id, k, z }];
    })
    .sort((a, b) => b.z - a.z);
  const titles = {};
  for (const { id, k } of picks) titles[id] ??= k;
  return players.map((p) => ({ ...p, title: titles[p.id] ?? null }));
}

const MINUTE = 60 * 1000;

// who sits where, seat → { id, name, bot }: Okey's seats, a table's as it
// records them beside its game (`seats`)
const seatsIn = (kind, view) =>
  kind === "okey"
    ? Object.fromEntries(
        view.players.filter((p) => p.user).map((p) => [p.id, p.user]),
      )
    : Object.fromEntries(
        (view.seats ?? []).flatMap((u, i) => (u ? [[i, u]] : [])),
      );

// how it went for whoever had seat `seat` at the end
function resultOf(kind, view, seat) {
  if (kind === "okey") return outcome(view, seat);
  if (!view.winner) return "drawn";
  return view.winner.seat === seat ? "won" : "lost";
}

const sameName = (a, b) =>
  !!a && !!b && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

// Everyone who sat at the game, with what they did while sitting there (a
// count goes to whoever had the seat then) and how it went for whoever had
// each seat at the end; someone who left before it, none. A name that
// stood up and sat back down on another device (a laptop, then a phone:
// another player id) is one person, `ids` both, when the two were never
// seated at once. One page playing both seats has played both sides, and
// its result is none either.
function people(kind, views) {
  const byId = {};
  const lastIn = {};
  const count = COUNTS[kind];
  const add = (seat, key, by = 1) => {
    const p = lastIn[seat];
    if (p) p.n[key] = (p.n[key] ?? 0) + by;
  };
  views.forEach(({ view, gap }, i) => {
    for (const [seat, u] of Object.entries(seatsIn(kind, view))) {
      const p = (byId[u.id] ??= { ids: [u.id], first: i, n: {} });
      Object.assign(p, { name: u.name, bot: !!u.bot, seat: Number(seat) });
      p.last = i;
      lastIn[seat] = p;
    }
    if (count && i > 0 && !gap) count(views[i - 1].view, view, add);
  });
  const end = views.at(-1).view;
  const seats =
    kind === "okey"
      ? end.players.filter((p) => p.user || end.scores?.[p.id]).map((p) => p.id)
      : [0, 1];
  for (const seat of seats) {
    const p = lastIn[seat];
    if (p) p.result = p.result === undefined ? resultOf(kind, end, seat) : null;
  }
  const merged = [];
  for (const p of sortBy(Object.values(byId), "first")) {
    const same = merged.find(
      (q) => !q.bot && !p.bot && sameName(q.name, p.name) && q.last < p.first,
    );
    if (!same) {
      merged.push({ ...p, n: { ...p.n } });
      continue;
    }
    same.ids.push(...p.ids);
    for (const [k, v] of Object.entries(p.n)) same.n[k] = (same.n[k] ?? 0) + v;
    Object.assign(same, { name: p.name, seat: p.seat, last: p.last });
    same.result = p.result ?? same.result;
  }
  return merged.map(({ ids, name, bot, seat, result, n }) => ({
    id: ids[0],
    ids,
    name,
    bot,
    seat,
    result: result ?? null,
    ...n,
  }));
}

// A finished game's summary from its record (`meta`: its id, kind, mode,
// who recorded it, `me`), or null with nothing to replay: when it was
// played, for how long (the time between steps, at most five minutes each,
// so a table left open over dinner doesn't count, and none across a gap),
// and who played it (people), with Go's stones taken at the end, and
// Okey's titles.
// ponytail: each page summarizes its own record, so a page with a gap can
// count fewer and give other titles; copies put together later fix that
export function summarize(meta, steps) {
  const views = replay(steps);
  const last = views.at(-1);
  if (!last) return null;
  let players = people(meta.kind, views);
  if (meta.kind === "go") {
    players = players.map((p) => ({ ...p, taken: last.view.taken[p.seat] }));
  }
  return {
    id: meta.id,
    kind: meta.kind,
    mode: meta.mode ?? null,
    me: meta.me,
    v: VERSION,
    h: last.h,
    // Backgammon's won with a mars: the other had borne nothing off
    mars: last.view.winner?.points === 2,
    start: views[0].at,
    end: last.at,
    ms: sum(
      views
        .slice(1)
        .map((v, i) => (v.gap ? 0 : Math.min(v.at - views[i].at, 5 * MINUTE))),
    ),
    players: meta.kind === "okey" ? withTitles(players) : players,
  };
}

// Who's who across games (summaries `all`): each person's ids in a game
// joined up, so one seen switching devices in any game is one person in
// every game either device played, before it or after; a player's one id
// for them all
export function identities(all) {
  const root = {};
  const find = (id) => (root[id] && root[id] !== id ? find(root[id]) : id);
  for (const s of all) {
    for (const p of s.players) {
      for (const id of p.ids) root[find(id)] = find(p.ids[0]);
    }
  }
  return (p) => find(p.ids[0]);
}
