import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BUILD } from "../../version";
import { decodeSave, encodeSave } from "../saveCode";
import { snapshot, step, summarize, VERSION } from "./history";

// This device's record of the games its player sat at (history.js), in
// IndexedDB: `games` what each game is (its kind, mode, who recorded it,
// whether it's over, its steps `packed` once it is, `pruned` once they're
// gone), `steps` the steps of a game in play as they were seen, each one's
// changes deflated as a save code is (saveCode.js), so the racks of a game
// in play aren't there to read in the browser's storage, and `summaries`
// what's worked out from them once it's over, worked out again from the
// steps whenever the stats change (VERSION). The steps of the last KEPT games finished are kept, and those
// are what goes to another device (Export); older games keep their summary
// alone, unless this device keeps every game's steps (useKeepAll), which
// then stay on it.
const KEPT = 100;

// the browser asked, once, to keep this site's storage when it's short of
// room (Firefox asks the player; Safari still clears it after 7 days
// without a visit): only once the player asks to keep something, an import
// or every game's steps, never as a page first plays
let persisted;
const keepForGood = () =>
  (persisted ??= navigator.storage?.persist?.().catch(() => {}));

// keep every game's steps on this device (the stats' toggle)
export const useKeepAll = create(
  persist(
    (set) => ({
      all: false,
      setAll: (all) => {
        if (all) keepForGood();
        set({ all });
      },
    }),
    {
      name: "stats-keep-all",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// none where the browser keeps this site from storing anything (site data
// blocked, some private windows): nothing's recorded, and the games play on
const stores = (() => {
  try {
    return !!globalThis.indexedDB;
  } catch {
    return false; // reading it throws in some browsers then
  }
})();

let opened;
const db = () =>
  (opened ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("stats", 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore("games", { keyPath: "id" });
      d.createObjectStore("steps", { autoIncrement: true }).createIndex(
        "game",
        "game",
      );
      d.createObjectStore("summaries", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));

const answer = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const committed = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error);
  });

const get = async (store, key) =>
  answer((await db()).transaction(store).objectStore(store).get(key));

const getAll = async (store) =>
  answer((await db()).transaction(store).objectStore(store).getAll());

// a step's changes as they're kept, and back: a list of [path, value?],
// each path's keys strings and never __proto__ (a file from elsewhere),
// or none
const isOps = (ops) =>
  Array.isArray(ops) &&
  ops.every(
    (op) =>
      Array.isArray(op) &&
      op.length <= 2 &&
      Array.isArray(op[0]) &&
      op[0].every((k) => typeof k === "string" && k !== "__proto__"),
  );
const decoded = async (s) => {
  const ops = await decodeSave(s.ops);
  return { ...s, ops: isOps(ops) ? ops : [] };
};

// A finished game's steps packed into one (`packed` on the game): four
// times smaller than each deflated on its own, the same tiles in step after
// step; and back, each step as [at, from, h, ops]
const pack = (steps) =>
  encodeSave(steps.map(({ at, from, h, ops }) => [at, from, h, ops]));
async function unpack(packed) {
  const steps = await decodeSave(packed);
  return Array.isArray(steps)
    ? steps.map(([at, from, h, ops]) => ({
        at,
        from,
        h,
        ops: isOps(ops) ? ops : [],
      }))
    : [];
}

// game `id` as kept, its steps in order (any packed, then any written
// since), and the keys of those written since
async function read(id) {
  const tx = (await db()).transaction(["games", "steps"]);
  const rows = tx.objectStore("steps").index("game");
  const [meta, kept, keys] = await Promise.all([
    answer(tx.objectStore("games").get(id)),
    answer(rows.getAll(id)),
    answer(rows.getAllKeys(id)),
  ]);
  const steps = [
    ...(meta?.packed ? await unpack(meta.packed) : []),
    ...(await Promise.all(kept.map(decoded))),
  ];
  return { meta, steps, keys };
}

// a summary written: the pages showing one read it again
const useStatsTick = create(() => ({ n: 0 }));

// game `id`'s summary from its steps once it's over, kept; null till then
async function summarizeGame(id) {
  const { meta, steps } = await read(id);
  if (!meta?.over) return null;
  const summary = summarize(meta, steps);
  if (!summary) return null;
  const write = (await db()).transaction("summaries", "readwrite");
  write.objectStore("summaries").put(summary);
  await committed(write);
  useStatsTick.setState(({ n }) => ({ n: n + 1 }));
  return summary;
}

// a finished game's steps packed into one, those written one by one gone
async function compact(id) {
  const { meta, steps, keys } = await read(id);
  if (!meta || !keys.length) return;
  const packed = await pack(steps);
  const tx = (await db()).transaction(["games", "steps"], "readwrite");
  tx.objectStore("games").put({ ...meta, packed });
  for (const key of keys) tx.objectStore("steps").delete(key);
  await committed(tx);
}

// the finished games whose steps are kept, the latest first
async function latest() {
  const [games, kept] = await Promise.all([
    getAll("games"),
    getAll("summaries"),
  ]);
  const end = new Map(kept.map((s) => [s.id, s.end]));
  return games
    .filter((g) => g.over && !g.pruned)
    .sort((a, b) => (end.get(b.id) ?? 0) - (end.get(a.id) ?? 0));
}

// the steps of finished games past the last KEPT gone, their summaries kept
async function prune() {
  if (useKeepAll.getState().all) return;
  const old = (await latest()).slice(KEPT);
  if (!old.length) return;
  const tx = (await db()).transaction(["games", "steps"], "readwrite");
  for (const g of old) {
    const steps = tx.objectStore("steps");
    steps.index("game").getAllKeys(g.id).onsuccess = (e) =>
      e.target.result.forEach((key) => steps.delete(key));
    const { packed, ...rest } = g; // eslint-disable-line no-unused-vars
    tx.objectStore("games").put({ ...rest, pruned: true });
  }
  await committed(tx);
}

// one write at a time, in the order the steps were seen
let queue = Promise.resolve();

async function keep(meta, s) {
  // a page come back to a game it has already summarized at its end
  if (
    meta.over &&
    s.from === null &&
    (await get("summaries", meta.id))?.h === s.h
  ) {
    return;
  }
  const ops = await encodeSave(s.ops);
  const tx = (await db()).transaction(["games", "steps"], "readwrite");
  // over what's kept of it (its packed steps)
  const games = tx.objectStore("games");
  games.get(meta.id).onsuccess = (e) =>
    games.put({ ...e.target.result, ...meta });
  tx.objectStore("steps").add({ game: meta.id, ...s, ops });
  await committed(tx);
  if (meta.over && (await summarizeGame(meta.id))) {
    await compact(meta.id);
    await prune();
  }
}

// Records game `id` (`state`, of `kind`) on this device as it changes,
// while this page's player is `seated` at it, `over` once it's finished:
// `me`, the player; `mode`, how it's played.
// ponytail: a snapshot every render (~0.15 ms an Okey table on a laptop);
// run it on the Yjs map's changes instead if it shows in a profile
export function useRecord(id, state, { kind, mode, me, seated, over }) {
  const last = useRef(null);
  // the page was hidden since (a phone locked, another app): what it sees
  // next is everything it missed at once, kept as a gap, nothing counted
  // across it (as moves.js flies no tiles for it)
  const away = useRef(false);
  useEffect(() => {
    const hide = () => document.hidden && (away.current = true);
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (!id || !state || !seated || !stores) return;
    const now = snapshot(kind, state);
    const same = last.current?.id === id;
    if (same && last.current.h === now.h) return;
    const prev = same && !away.current ? last.current : null;
    away.current = false;
    const s = step(prev, now, Date.now());
    const at = { id, ...now };
    last.current = at;
    const meta = { id, kind, mode, me, build: BUILD, over: !!over };
    queue = queue
      .then(() => keep(meta, s))
      .catch(() => {
        // storage blocked or full: this step isn't kept, so the next one
        // seen starts over whole, as after a gap
        if (last.current === at) last.current = null;
      });
  });
}

// game `id`'s summary once it's over and worked out, else null
export function useSummary(id) {
  const tick = useStatsTick((s) => s.n);
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    if (!id || !stores) return;
    let live = true;
    get("summaries", id)
      .then((s) => live && setSummary(s ?? null))
      .catch(() => {});
    return () => (live = false);
  }, [id, tick]);
  return summary?.id === id ? summary : null;
}

// every finished game's summary, those from older stats worked out again
// where their steps are kept (a game that can't be is passed over)
export async function summaries() {
  const [games, kept] = await Promise.all([
    getAll("games"),
    getAll("summaries"),
  ]);
  const byId = new Map(kept.map((s) => [s.id, s]));
  const stale = games.filter(
    (g) => g.over && !g.pruned && byId.get(g.id)?.v !== VERSION,
  );
  const fresh = await Promise.all(
    stale.map((g) => summarizeGame(g.id).catch(() => null)),
  );
  for (const s of fresh) if (s) byId.set(s.id, s);
  return [...byId.values()];
}

// To take to another device: every game's summary, and the steps of the
// last KEPT games finished, packed (games older still go as their summary
// alone)
export async function exportAll() {
  const send = new Set((await latest()).slice(0, KEPT).map((g) => g.id));
  const [games, steps, kept] = await Promise.all([
    getAll("games"),
    getAll("steps"),
    getAll("summaries"),
  ]);
  return {
    stats: 1,
    games: games
      .filter((g) => g.over)
      .map((g) => {
        if (send.has(g.id)) return g;
        const { packed, ...rest } = g; // eslint-disable-line no-unused-vars
        return { ...rest, pruned: true };
      }),
    steps: steps.filter((s) => send.has(s.game)),
    summaries: kept,
  };
}

// A file from Export, checked as it comes from outside: its games not here
// yet, each with its steps (packed, or one by one), summarized afresh, or
// its summary alone; how many were added, or null when it isn't one
const isGame = (g) =>
  typeof g?.id === "string" &&
  typeof g.kind === "string" &&
  typeof g.me === "string";
const isStep = (s) =>
  typeof s?.game === "string" &&
  Number.isFinite(s.at) &&
  typeof s.h === "string" &&
  (s.from === null || typeof s.from === "string") &&
  typeof s.ops === "string";
const isSummary = (s) =>
  isGame(s) &&
  Array.isArray(s.players) &&
  s.players.every(
    (p) =>
      Array.isArray(p?.ids) &&
      p.ids.length > 0 &&
      p.ids.every((id) => typeof id === "string"),
  );

export async function importAll(file) {
  if (file?.stats !== 1 || !Array.isArray(file.games)) return null;
  keepForGood();
  const have = new Set((await getAll("games")).map((g) => g.id));
  const games = file.games.filter(
    (g) => isGame(g) && g.over && !have.has(g.id),
  );
  const ids = new Set(games.map((g) => g.id));
  const steps = (file.steps ?? []).filter((s) => isStep(s) && ids.has(s.game));
  const withSteps = new Set([
    ...steps.map((s) => s.game),
    ...games.filter((g) => typeof g.packed === "string").map((g) => g.id),
  ]);
  const alone = (file.summaries ?? []).filter(
    (s) => isSummary(s) && ids.has(s.id) && !withSteps.has(s.id),
  );
  const tx = (await db()).transaction(
    ["games", "steps", "summaries"],
    "readwrite",
  );
  for (const { packed, ...g } of games) {
    tx.objectStore("games").put({
      ...g,
      ...(typeof packed === "string" && { packed }),
      pruned: !withSteps.has(g.id),
    });
  }
  for (const s of steps) tx.objectStore("steps").add(s);
  for (const s of alone) tx.objectStore("summaries").put(s);
  await committed(tx);
  for (const id of withSteps) await summarizeGame(id).catch(() => null);
  await prune();
  return withSteps.size + alone.length;
}
