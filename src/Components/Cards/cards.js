// A deck of 52 for the card tables (Batak; Pişti and King to come). A card
// is a number: 13 to a suit, 2 to the ace (14) within it, the suits in an
// order that alternates their colours as a hand is sorted.
export const SUITS = ["♠", "♥", "♣", "♦"];
export const suitOf = (c) => Math.floor(c / 13);
export const rankOf = (c) => (c % 13) + 2;
export const red = (c) => suitOf(c) % 2 === 1;
const FACES = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export const rankName = (c) => FACES[rankOf(c)] ?? String(rankOf(c));

// a hand as it's held: by suit, the highest first
export const sorted = (hand) =>
  [...hand].sort((a, b) => suitOf(a) - suitOf(b) || b - a);

// the deck shuffled and dealt out to `players`, each hand sorted
export function deal(players) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const each = deck.length / players;
  return Array.from({ length: players }, (_, p) =>
    sorted(deck.slice(p * each, (p + 1) * each)),
  );
}

// of a trick, [{ seat, card }…] in the order played, the play that takes
// it: the highest trump, or with none, the highest of the suit led
export function takes(trick, trump) {
  const led = suitOf(trick[0].card);
  const rank = ({ card }) =>
    suitOf(card) === trump ? 100 + card : suitOf(card) === led ? card : -1;
  return trick.reduce((best, p) => (rank(p) > rank(best) ? p : best));
}
