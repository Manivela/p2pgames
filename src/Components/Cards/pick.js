import { useEffect, useRef, useState } from "react";

// A card picked ahead: tapped while it isn't your turn yet (again to put it
// back, another to change it), it's played once your turn comes, `wait` ms
// on, so the card before yours is seen landing; `play` says why if it may
// not be played then, and it goes back. Kept on this device only, forgotten
// with the deal (`deal`), waiting while a ready check holds the table
// (`held`). `open`: while cards are played; `n`: the game's move count.
// Gives the card picked, and a tap: a card played on your turn, picked
// before it.
export function usePick({ deal, turn, open, wait, held, n, play }) {
  const [pick, setPick] = useState({ deal, card: null });
  const card = open && pick.deal === deal ? pick.card : null;
  // played as the game is then: one changed meanwhile without a move (a
  // game ended in ⋯) isn't written over
  const now = useRef(play);
  now.current = play;
  useEffect(() => {
    if (!turn || card === null || held) return;
    const timer = setTimeout(() => {
      setPick({ deal, card: null });
      now.current(card);
    }, wait);
    return () => clearTimeout(timer);
  }, [turn, card, held, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (c) => {
    if (turn) {
      setPick({ deal, card: null });
      play(c);
    } else if (open) setPick({ deal, card: c === card ? null : c });
  };
  return [card, tap];
}
