import { create } from "zustand";

// define the initial state
const initialState = {
  currentUser: null,
};

export const useAuthStore = create((set) => ({
  ...initialState,
  login: (currentUser) =>
    set(() => ({
      currentUser,
    })),
  logout: () => {
    set(initialState);
  },
}));
