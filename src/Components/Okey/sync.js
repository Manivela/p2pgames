import { isEqual, omit } from "lodash";

// The game state is split into Yjs keys by who writes them, so moves made at
// the same moment by different players don't overwrite each other: a hand is
// moved by its owner, the draw pile and turn by the player whose turn it is,
// seats by whoever sits or leaves, a claim by its claimer, and an inbox is
// filled at a discard and emptied by its owner, a caught list and wrong
// calls by the caller, a player's own rack rows by them, and the lobby's settings (`setup`, the ruleset the next game
// starts with) by anyone in the room. Start / new game / reset go
// under fresh keys behind one "deal" pointer, so a move racing them can't mix
// in. Two writes to the *same* key at once still resolve last-writer-wins.
// A client that hasn't received the doc yet (a phone rejoining) writes to the
// "lobby" deal and never moves the pointer, so its empty table can't replace
// a game in progress; once the doc arrives, the pointer wins over the lobby.
// Outside the state, at the map's root and each its writer's: the fake okeys'
// spin (`spun`, kept through every deal), and each player's press for the
// next round (`ready-<seat>`, hooks/useRoom.js), gone with the deal.
function parts(s) {
  return {
    seats: s.players.map((p) =>
      omit(p, [
        "hand",
        "discardPile",
        "inbox",
        "claim",
        "caught",
        "calls",
        "rowSlots",
      ]),
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
        [`calls-${p.id}`, p.calls ?? null],
        [`row-${p.id}`, p.rowSlots ?? null],
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
        ...(get(`calls-${seat.id}`) && { calls: get(`calls-${seat.id}`) }),
        ...(get(`row-${seat.id}`) && { rowSlots: get(`row-${seat.id}`) }),
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

// What a `turn` written over another took back, if anything: within a deal
// the discards, melds, openings and penalties only grow, and a round's end
// doesn't go back to play, so less of any is a write made from an older
// state than the one it replaced (a page that slept, a move racing
// another). OkeyContext reports it, to find who writes it. Doesn't see a
// penalty's value going back at the same discard (202 to 101): only one
// that's gone.
export function wentBack(before, after) {
  if (!before || !after) return null;
  if ((after.discards ?? 0) < (before.discards ?? 0)) return "discards";
  if ((after.melds?.length ?? 0) < (before.melds?.length ?? 0)) return "melds";
  for (const key of ["penalties", "opened"]) {
    const kept = after[key] ?? {};
    if (Object.keys(before[key] ?? {}).some((id) => !(id in kept))) return key;
  }
  if (before.gameState !== "play" && after.gameState === "play") {
    return "gameState";
  }
  return null;
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
