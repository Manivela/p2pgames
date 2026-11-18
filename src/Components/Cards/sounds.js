import { useRef } from "react";
import useSound from "use-sound";
import { useVolume } from "../../hooks/useStore";
import cards from "./assets/cards.mp3";

// Kenney's Casino Audio (CC0): four cards put down, one slid across the
// felt, a shuffle cut short and four cards dealt; where each starts in
// cards.mp3, and how long it lasts, in ms
const SPRITE = {
  0: [0, 700],
  1: [1000, 470],
  2: [2000, 890],
  3: [3000, 610],
  slide: [4000, 610],
  shuffle: [5000, 900],
  deal0: [6000, 590],
  deal1: [7000, 600],
  deal2: [8000, 460],
  deal3: [9000, 600],
};

// a card put down, each a little different, never the one just heard; a
// trick slid to its taker; a deck shuffled; a card dealt: at this
// device's sound level
export function useCardSounds() {
  const { volume } = useVolume();
  const [play] = useSound(cards, { volume: 0.5 * volume, sprite: SPRITE });
  const last = useRef(0);
  const next = () =>
    (last.current = (last.current + 1 + Math.floor(Math.random() * 3)) % 4);
  return {
    put: () => play({ id: String(next()) }),
    slide: () => play({ id: "slide" }),
    shuffle: () => play({ id: "shuffle" }),
    deal: () => play({ id: `deal${next()}` }),
  };
}
