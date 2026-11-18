import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "react-hot-toast";
import { useDoc, useMap } from "../vendor/y-react";
import { useAuthStore, useWaitAllSeen } from "./useStore";
import { t } from "../i18n";

// The room's settings, everyone's in it: one value in the room's Yjs map
// `room` that every page plays by, anyone's to switch (the Settings
// dialog). "Next round waits for everyone", `waitAll`: { on, at, by }, on
// till someone switches it off (off in the e2e's, whose tests of it switch
// it on).
export const WAITS = import.meta.env.MODE !== "e2e";

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
  const set = (on) =>
    room.set("waitAll", {
      on,
      at: stamp(Date.now(), room.get("waitAll")),
      by: me && { id: me.id, name: me.name },
    });
  return [room.get("waitAll")?.on ?? WAITS, set];
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
  const on = shared?.on ?? WAITS;
  const was = useRef(null);
  useEffect(() => {
    if (was.current !== null && was.current !== on && shared?.by?.id !== me) {
      const by = shared?.by?.name ?? t("Someone");
      toast(
        t(
          on
            ? `${by}: next round waits for everyone`
            : `${by}: next round doesn't wait for everyone`,
        ),
        { id: "wait-all" },
      );
    }
    was.current = on;
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps
}

// The next round or game started together: once every player in it has
// pressed for it, while the room waits for everyone (useWaitAll); else, as
// before, the first press starts it. `need`: the players waited for,
// [{ key, here }], never a bot; one away (`here` false) holds it up till
// they're back or their seat's freed. Each press is its player's own key in
// `map`, `ready-<key>`, holding the `round` it's for, so nothing carries
// into the next. `mine`: the keys this page presses for; `starts`: whether
// this page, the one page, calls `go` once all have pressed.
// Returns `press` (null for someone not playing, while it waits), whether
// this page has pressed, and who has (`ready`).
export function useTogether({ map, round, need, mine, starts, go }) {
  const [on] = useWaitAll();
  const waits = on && need.length > 0;
  const has = (key) => round != null && map.get(`ready-${key}`) === round;
  const ready = waits
    ? need.filter((p) => p.here && has(p.key)).map((p) => p.key)
    : [];
  const all = waits && round != null && ready.length === need.length;
  // once a round: a deal refused (too few players) isn't tried again
  const went = useRef(null);
  useEffect(() => {
    if (!all || !starts || went.current === round) return;
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
          .forEach((k) => map.set(`ready-${k}`, pressed ? null : round)),
      ),
    [map, ours, pressed, round],
  );
  // the same object till something in it changes: Okey's context holds it
  const shown = ready.join();
  return useMemo(
    () => ({
      waits,
      ready: shown ? shown.split(",").map(Number) : [],
      pressed,
      press: !waits ? go : ours ? press : null,
    }),
    [waits, shown, pressed, go, ours, press],
  );
}
