import { create } from "zustand";

export const useStore = create((set) => ({
  texture: "dirt",
  setTexture: (texture) =>
    set(() => ({
      texture,
    })),
}));
