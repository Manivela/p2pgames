import { isEqual, omit } from "lodash";

// The game state is split into Yjs keys by who writes them, so moves made at
// the same moment by different players don't overwrite each other: a hand is
// moved by its owner, the draw pile and turn by the player whose turn it is,
// seats by whoever sits or leaves, a claim by its claimer, and an inbox is
// filled at a discard and emptied by its owner, and a caught list by its
// catcher, and the lobby's settings (`setup`, the ruleset the next game
// starts with) by anyone in the room. Start / new game / reset go
// under fresh keys behind one "deal" pointer, so a move racing them can't mix
// in. Two writes to the *same* key at once still resolve last-writer-wins.
// A client that hasn't received the doc yet (a phone rejoining) writes to the
// "lobby" deal and never moves the pointer, so its empty table can't replace
// a game in progress; once the doc arrives, the pointer wins over the lobby.
function parts(s) {
  return {
    seats: s.players.map((p) =>
      omit(p, ["hand", "discardPile", "inbox", "claim", "caught"]),
    ),
    turn: omit(s, ["deal", "players", "message", "drawPile", "rules", "setup"]),
    // the same all game: apart, so it isn't sent again with every move
    rules: s.rules ?? null,
    setup: s.setup ?? null,
    message: s.message,
    drawPile: s.drawPile,
    ...Object.fromEntries(
      s.players.flatMap((p) => [
        [`hand-${p.id}`, p.hand],
        [`discard-${p.id}`, p.discardPile],
        [`inbox-${p.id}`, p.inbox ?? []],
        [`claim-${p.id}`, p.claim ?? null],
        [`caught-${p.id}`, p.caught ?? []],
      ]),
    ),
  };
}

export function readState(map) {
  const deal = map.get("deal") ?? "lobby";
  const get = (key) => map.get(`${deal}/${key}`);
  const seats = get("seats");
  return (
    seats && {
      ...get("turn"),
      rules: get("rules") ?? null,
      setup: get("setup") ?? null,
      deal,
      message: get("message"),
      drawPile: get("drawPile"),
      players: seats.map((seat) => ({
        ...seat,
        hand: get(`hand-${seat.id}`) ?? [],
        discardPile: get(`discard-${seat.id}`) ?? [],
        inbox: get(`inbox-${seat.id}`) ?? [],
        claim: get(`claim-${seat.id}`) ?? null,
        caught: get(`caught-${seat.id}`) ?? [],
      })),
    }
  );
}

export function replaceState(map, next) {
  const deal = Math.random().toString(36).slice(2);
  map.doc.transact(() => {
    // the fake okeys' spin (OkeyContext) stays through every game
    for (const key of [...map.keys()]) if (key !== "spun") map.delete(key);
    for (const [key, value] of Object.entries(parts(next))) {
      map.set(`${deal}/${key}`, value);
    }
    map.set("deal", deal);
  });
}

// Writes only the keys `next` changed relative to `prev`, the state it was
// computed from, into prev's deal, so a stale `prev` can't revert someone
// else's move or leak into a newer deal.
export function writeState(map, prev, next) {
  const before = prev ? parts(prev) : {};
  const deal = prev?.deal ?? "lobby";
  map.doc.transact(() => {
    for (const [key, value] of Object.entries(parts(next))) {
      if (!isEqual(before[key], value)) map.set(`${deal}/${key}`, value);
    }
  });
}
