import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { customNanoid } from "../utils/customNanoid";

// define the initial state
const initialState = {
  currentUser: null,
};

const colors = ["red", "green", "blue", "orange", "yellow"];

// a new player: one per tab, so tabs can be players
export const newUser = (name) => ({
  id: customNanoid(),
  name,
  color: colors[Math.floor(Math.random() * colors.length)],
});

// the name this device remembers (localStorage), for the next tab; none in
// a private window that won't keep it
function remember(name) {
  try {
    localStorage.setItem("name", name);
  } catch {
    // asked again next time
  }
}
function remembered() {
  try {
    return localStorage.getItem("name");
  } catch {
    return null;
  }
}

// kept for this tab (sessionStorage): a reload, say for a new version,
// keeps you logged in; a new tab goes in with the name this device
// remembers, as a new player, or asks for one
export const useAuthStore = create(
  persist(
    (set) => ({
      ...initialState,
      login: (currentUser) => {
        remember(currentUser.name);
        set(() => ({
          currentUser,
        }));
      },
      // a new name (the sidebar): the same player
      rename: (name) => {
        remember(name);
        set(({ currentUser }) => ({ currentUser: { ...currentUser, name } }));
      },
      logout: () => {
        set(initialState);
      },
    }),
    { name: "user", storage: createJSONStorage(() => sessionStorage) },
  ),
);

// sessionStorage is read as the store is made, so this tab's login is in
// by now
if (!useAuthStore.getState().currentUser && remembered()) {
  useAuthStore.getState().login(newUser(remembered()));
}
