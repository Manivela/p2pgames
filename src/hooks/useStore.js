import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// define the initial state
const initialState = {
  currentUser: null,
};

// kept for this tab (sessionStorage): a reload, say for a new version,
// keeps you logged in; a new tab asks again, so tabs can be players
export const useAuthStore = create(
  persist(
    (set) => ({
      ...initialState,
      login: (currentUser) =>
        set(() => ({
          currentUser,
        })),
      logout: () => {
        set(initialState);
      },
    }),
    { name: "user", storage: createJSONStorage(() => sessionStorage) },
  ),
);
