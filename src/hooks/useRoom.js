import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "react-hot-toast";
import { useDoc, useMap } from "../vendor/y-react";
import { useAuthStore, useWaitAllSeen } from "./useStore";
import { t } from "../i18n";

// The room's settings, everyone's in it: one value in the room's Yjs map
// `room` that every page plays by, anyone's to switch (the Settings
// dialog). "Next round waits for", `waitAll`: { wait, at, by }, `wait`
// "all" (everyone), "half" or "off", everyone till someone picks another
// (off in the e2e's, whose tests of it pick one).
export const WAITS = import.meta.env.MODE !== "e2e" ? "all" : "off";

// how many of `n` players' presses start the next round
export const needed = (wait, n) => (wait === "half" ? Math.ceil(n / 2) : n);

// Every device remembers the last switch it saw (useWaitAllSeen) and brings
// it to each room it's in: whichever was switched last wins, written into
// the room or saved on the device. Never switched (`at` 0): never written.
export function agree(seen, room) {
  const at = room?.at ?? 0;
  if (seen.at > at) return "room";
  if (at > seen.at) return "device";
  return null;
}

// a switch's time: now, or just after the room's own where this device's
// clock is behind the last switcher's, so it still counts as the latest
export const stamp = (now, room) => Math.max(now, (room?.at ?? 0) + 1);

export function useWaitAll() {
  useMap("room"); // re-render on every change
  const room = useDoc().getMap("room");
  const me = useAuthStore((s) => s.currentUser);
  const set = (wait) =>
    room.set("waitAll", {
      wait,
      at: stamp(Date.now(), room.get("waitAll")),
      by: me && { id: me.id, name: me.name },
    });
  return [room.get("waitAll")?.wait ?? WAITS, set];
}

// Keeps the room and this device agreed (agree), once the room's state is
// known (root.jsx), and says a switch on the table, but not to the one who
// made it, nor as a page arrives.
export function useRoomSync() {
  useMap("room");
  const room = useDoc().getMap("room");
  const shared = room.get("waitAll");
  const seen = useWaitAllSeen();
  const me = useAuthStore((s) => s.currentUser?.id);
  useEffect(() => {
    const way = agree(seen, shared);
    if (way === "room") room.set("waitAll", seen);
    if (way === "device") useWaitAllSeen.setState(shared);
  }, [shared?.at, seen.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const wait = shared?.wait ?? WAITS;
  const was = useRef(null);
  useEffect(() => {
    if (was.current !== null && was.current !== wait && shared?.by?.id !== me) {
      const by = shared?.by?.name ?? t("Someone");
      const said = {
        all: "next round waits for everyone",
        half: "next round waits for half the players",
        off: "next round doesn't wait",
      };
      toast(t(`${by}: ${said[wait]}`), { id: "wait-all" });
    }
    was.current = wait;
  }, [wait]); // eslint-disable-line react-hooks/exhaustive-deps
}

// The next round or game started together: once every player in it has
// pressed for it, or half of them, as the room waits (useWaitAll, needed);
// else, as before, the first press starts it. `need`: the players waited for,
// [{ key, here }], never a bot; one away (`here` false) holds it up till
// they're back or their seat's freed. Each press is its player's own key in
// `map`, `ready-<key>`, holding the `round` it's for, so nothing carries
// into the next. `mine`: the keys this page presses for; `starts`: whether
// this page, the one page, calls `go` once all have pressed; not while
// `hold` (a ready check open), but as soon as it's let go. `prefix`: the
// presses' keys, `<prefix>-<key>`; `always`: waits for everyone whatever
// the room's setting (a ready check's).
// Returns `press` (null for someone not playing, while it waits), whether
// this page has pressed, who has (`ready`), and `force`: any player's way on
// without the rest (⋯), for one who can't press (a phone gone flat).
export function useTogether({
  map,
  round,
  need,
  mine,
  starts,
  go,
  hold = false,
  prefix = "ready",
  always = false,
}) {
  const [wait] = useWaitAll();
  const waits = (always || wait !== "off") && need.length > 0;
  const has = (key) => round != null && map.get(`${prefix}-${key}`) === round;
  const ready = waits
    ? need.filter((p) => p.here && has(p.key)).map((p) => p.key)
    : [];
  const all =
    waits &&
    round != null &&
    ready.length >= needed(always ? "all" : wait, need.length);
  // once a round: a deal refused (too few players) isn't tried again
  const went = useRef(null);
  useEffect(() => {
    if (!all || !starts || hold || went.current === round) return;
    went.current = round;
    go();
  });
  const ours = mine.filter((k) => need.some((p) => p.key === k)).join();
  const pressed = waits && ours !== "" && ours.split(",").every(has);
  const press = useCallback(
    () =>
      map.doc.transact(() =>
        ours
          .split(",")
          .forEach((k) => map.set(`${prefix}-${k}`, pressed ? null : round)),
      ),
    [map, ours, pressed, round, prefix],
  );
  // the same object till something in it changes: Okey's context holds it
  const shown = ready.join();
  return useMemo(
    () => ({
      waits,
      ready: shown ? shown.split(",").map(Number) : [],
      pressed,
      // none while held: the check's Ready is the one to press
      press: hold ? null : !waits ? go : ours ? press : null,
      force: !hold && waits && round != null && ours ? go : null,
    }),
    [waits, shown, pressed, go, ours, press, hold, round],
  );
}

// A ready check, back from a break: any player starts it (⋯, `start`), at
// any time, a game on or not, and the table's moves wait, each table
// refusing them while it's `open`, its bots and its Start too, till every
// player in it (`need`, as for useTogether, someone away holding it up) has
// pressed Ready, or any player ends it (`cancel`); `waiting`: the others not
// back yet. The check is `check` in `map`, { id, by }, each press
// `back-<key>`, apart from the next round's, which still counts after.
// Everyone standing up leaves it open, for the next to sit to press or end.
export function useReadyCheck({ map, need, mine, starts }) {
  const me = useAuthStore((s) => s.currentUser);
  const check = map.get("check") ?? null;
  const close = useCallback(
    () =>
      map.doc.transact(() => {
        map.delete("check");
        for (const k of [...map.keys()]) {
          if (k.startsWith("back-")) map.delete(k);
        }
      }),
    [map],
  );
  const together = useTogether({
    map,
    round: check?.id ?? null,
    need,
    mine,
    starts,
    go: close,
    prefix: "back",
    always: true,
  });
  const player = mine.some((k) => need.some((p) => p.key === k));
  // said on the table: a check someone else started, and its end, everyone
  // back or ended in ⋯; not as a page arrives
  const was = useRef(undefined);
  const all = need.length > 0 && together.ready.length === need.length;
  const allWas = useRef(false);
  useEffect(() => {
    const id = check?.id ?? null;
    if (was.current !== undefined && was.current !== id) {
      if (id && check.by?.id !== me?.id) {
        toast(t(`${check.by?.name ?? t("Someone")}: ready check`), {
          id: "check",
        });
      } else if (!id) {
        toast(t(allWas.current ? "Everyone's ready" : "Ready check ended"), {
          id: "check",
        });
      }
    }
    was.current = id;
  }, [check?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // after the toast's, which reads it as it was
  useEffect(() => {
    allWas.current = !!check && all;
  });
  const begin = useCallback(
    () =>
      map.set("check", {
        id: Math.random().toString(36).slice(2),
        by: me && { id: me.id, name: me.name },
      }),
    [map, me?.id, me?.name], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const open = !!check;
  const canStart = !open && player && need.length > 1;
  const waiting = need
    .filter((p) => !together.ready.includes(p.key) && !mine.includes(p.key))
    .map((p) => p.key)
    .join();
  // the same object till something in it changes: Okey's context holds it
  return useMemo(
    () => ({
      open,
      ready: together.ready,
      waiting: waiting ? waiting.split(",").map(Number) : [],
      pressed: together.pressed,
      press: open ? together.press : null,
      start: canStart ? begin : null,
      cancel: open && player ? close : null,
    }),
    [open, together, waiting, canStart, begin, player, close],
  );
}

// a move tried while a ready check holds the table
export const WAIT_READY = "Waiting for everyone to be ready";
