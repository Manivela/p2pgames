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

// another tab's login or new name, here too: one player, one name
addEventListener("storage", (e) => {
  if (e.key === "user") useAuthStore.persist.rehydrate();
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
