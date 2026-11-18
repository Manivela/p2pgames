// A deal seen being dealt, at a card table (Batak's, the next ones'): the
// deck lies in the middle a moment (`wait`, its shuffle heard meanwhile),
// then the cards go out round the table, one each at a time, in dealing
// order: the viewer's own fly from the deck to their places in the hand,
// each landing with `onCard` (its sound); the others' go face down into
// their seats and fade there. Screen rects, as Okey's tiles fly
// (Okey/moves.js); nothing when motion is reduced.
// `table`: the board, its --cw a card's width; `deck`: the element whose
// middle the deck lies in; `hands`, in dealing order: { cards } (the
// viewer's hand, its card elements) or { seat, count } (someone else's:
// where they sit, how many they're dealt). Returns how long it takes, in
// ms, 0 when nothing's shown.

const EASE = "cubic-bezier(.2,.8,.2,1)";
const ROUND_MS = 120; // a card to each, round the table
const NEXT_MS = 30; // between one seat's card and the next's in a round
const FLY_MS = 300;

const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];

export function dealCards(table, deck, hands, { wait = 0, onCard } = {}) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  // a card's size here, from one laid on the table a moment
  const probe = document.createElement("span");
  probe.className = "cd-card";
  table.append(probe);
  const { width, height } = probe.getBoundingClientRect();
  probe.remove();
  const [x, y] = centre(deck.getBoundingClientRect());
  const layer = document.createElement("div");
  layer.className = "cd-flights";
  document.body.append(layer);
  const flights = [];
  hands.forEach((hand, m) => {
    const rounds = hand.cards?.length ?? hand.count;
    for (let k = 0; k < rounds; k++) {
      const delay = wait + k * ROUND_MS + m * NEXT_MS;
      if (hand.cards) {
        // the card itself, from the deck to its place, unseen in the deck
        // till it's dealt; untouchable till it's there
        const el = hand.cards[k];
        const [cx, cy] = centre(el.getBoundingClientRect());
        const from = `translate(${x - cx}px, ${y - cy}px)`;
        el.style.pointerEvents = "none";
        const flight = el.animate(
          [
            { transform: from, opacity: 0 },
            { transform: from, opacity: 1, offset: 0.01 },
            {},
          ],
          { duration: FLY_MS, delay, easing: EASE, fill: "backwards" },
        );
        flight.finished
          .then(() => (el.style.pointerEvents = ""))
          .catch(() => {});
        setTimeout(() => onCard?.(), delay + FLY_MS * 0.6);
        flights.push(flight);
      } else if (hand.seat) {
        const back = document.createElement("span");
        back.className = "cd-card back";
        Object.assign(back.style, {
          width: `${width}px`,
          height: `${height}px`,
        });
        layer.append(back);
        const [sx, sy] = centre(hand.seat.getBoundingClientRect());
        const at = (px, py, s) =>
          `translate(${px - width / 2}px, ${py - height / 2}px) scale(${s})`;
        flights.push(
          back.animate(
            [
              { transform: at(x, y, 1), opacity: 1 },
              { transform: at(sx, sy, 0.4), opacity: 0 },
            ],
            { duration: FLY_MS, delay, easing: EASE, fill: "both" },
          ),
        );
      }
    }
  });
  Promise.allSettled(flights.map((f) => f.finished)).then(() => layer.remove());
  const rounds = Math.max(...hands.map((h) => h.cards?.length ?? h.count));
  return wait + (rounds - 1) * ROUND_MS + (hands.length - 1) * NEXT_MS + FLY_MS;
}
