import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { customNanoid } from "../utils/customNanoid";

// define the initial state
const initialState = {
  currentUser: null,
};

const colors = ["red", "green", "blue", "orange", "yellow"];

// a new player, this browser's from now on
export const newUser = (name) => ({
  id: customNanoid(),
  name,
  color: colors[Math.floor(Math.random() * colors.length)],
});

// Kept on this browser for good (localStorage): every tab and every visit
// is the same player, under the name given once. None in a private window
// that won't keep it: asked again next time.
export const useAuthStore = create(
  persist(
    (set) => ({
      ...initialState,
      login: (currentUser) => set(() => ({ currentUser })),
      // a new name (the sidebar): the same player
      rename: (name) =>
        set(({ currentUser }) => ({ currentUser: { ...currentUser, name } })),
      logout: () => set(initialState),
    }),
    { name: "user", storage: createJSONStorage(() => localStorage) },
  ),
);

// this device's sound level, 0 to 1, for every game (each table's ⋯ menu)
export const useVolume = create(
  persist((set) => ({ volume: 1, setVolume: (volume) => set({ volume }) }), {
    name: "volume",
    storage: createJSONStorage(() => localStorage),
  }),
);

// the keys' keycaps on the tables' buttons (their ⋯ menus): on at first on
// a computer, off on a touch screen, which can still turn them on
const computer = globalThis.matchMedia?.(
  "(hover: hover) and (pointer: fine)",
).matches;
export const useKeyHints = create(
  persist(
    (set) => ({ hints: !!computer, setHints: (hints) => set({ hints }) }),
    {
      name: "key-hints",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// backgammon's home on the left on this device, as some play it (its ⋯ menu)
export const useLeftHome = create(
  persist((set) => ({ left: false, setLeft: (left) => set({ left }) }), {
    name: "left-home",
    storage: createJSONStorage(() => localStorage),
  }),
);

// two playing on this device sit face to face, the screen between them:
// what's one's to read is turned to them (each table's ⋯ menu)
export const useFacing = create(
  persist(
    (set) => ({ facing: false, setFacing: (facing) => set({ facing }) }),
    {
      name: "facing",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// your Okey rack's row length on this device, any game you sit at (the
// Settings dialog); null: the table's (OkeyContext writes it on your seat)
export const useRackRow = create(
  persist((set) => ({ row: null, setRow: (row) => set({ row }) }), {
    name: "rack-row",
    storage: createJSONStorage(() => localStorage),
  }),
);

// the room's "next round waits for" as this device last saw it:
// { wait, at, by }, `at` when someone last switched it (0: never), carried
// to every room this device joins, where the newest switch wins
// (hooks/useRoom.js)
export const useWaitAllSeen = create(
  persist(() => ({ wait: "all", at: 0, by: null }), {
    name: "wait-all",
    storage: createJSONStorage(() => localStorage),
  }),
);

// the level the Okey table kept for itself before, moved here once: set,
// so it's saved (loading alone saves nothing)
try {
  const old = localStorage.getItem("okey-volume");
  if (old !== null) {
    const v = Number(old);
    if (localStorage.getItem("volume") === null && Number.isFinite(v)) {
      useVolume.getState().setVolume(v);
    }
    localStorage.removeItem("okey-volume");
  }
} catch {
  // storage blocked: full volume
}

// another tab's login or new name, here too: one player, one name; and a
// switch another tab saw, so this one never saves an older one over it
addEventListener("storage", (e) => {
  if (e.key === "user") useAuthStore.persist.rehydrate();
  if (e.key === "wait-all") useWaitAllSeen.persist.rehydrate();
});

// the name an older build remembered, for a player kept for each tab: in
// as that, once
try {
  const name = localStorage.getItem("name");
  if (name && !useAuthStore.getState().currentUser) {
    useAuthStore.getState().login(newUser(name));
  }
  localStorage.removeItem("name");
} catch {
  // blocked storage: asked for a name
}
