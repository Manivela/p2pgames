import { assert, test } from "vitest";
import { isEqual } from "lodash";
import * as okey from "../Okey/okey";
import * as bot from "../Okey/bot";
import * as game from "../Okey/game";
import { AMERICANO } from "../Okey/rulesets";
import * as tictactoe from "../TicTacToe/rules";
import * as backgammon from "../Backgammon/rules";
import backgammonBot from "../Backgammon/bot";
import * as batak from "../Batak/rules";
import batakBot from "../Batak/bot";
import {
  diff,
  identities,
  patch,
  replay,
  snapshot,
  step,
  summarize,
  together,
  withTitles,
} from "./history";

// four bots play an Americano round out from `s`, every state a page
// would see
function play(s) {
  const states = [s];
  for (let now = 0; s.gameState === "play";) {
    now += 60000; // past the others' time to take the discard
    s = bot.step(s, s.currentPlayer, now);
    states.push(s);
    // the others, between moves: tiles won onto the rack, or a claim
    for (const p of s.players) {
      if (s.gameState !== "play") break;
      const next = p.inbox?.length
        ? okey.collectInbox(s, p.id)
        : bot.claim(s, p.id) || bot.catchTile(s, p.id);
      if (next) states.push((s = next));
    }
  }
  return states;
}

const round = (number) =>
  play(
    okey.setUp(
      {
        ...game.initialState,
        drawPile: game.tiles.map((t) => ({ ...t, hidden: true })),
        players: game.initialState.players.map((p) =>
          p.id <= 4
            ? {
                ...p,
                user: { id: `u${p.id}`, name: `P${p.id}` },
                userKey: p.id,
              }
            : p,
        ),
      },
      number,
      {},
      1,
      AMERICANO,
    ),
  );

// the side takes in `states`, by seat: each new tookDiscard
function sideTakes(states) {
  const took = {};
  states.forEach((s, i) => {
    const t = s.tookDiscard;
    if (t && !isEqual(t, states[i - 1]?.tookDiscard)) {
      took[t.player] = (took[t.player] ?? 0) + 1;
    }
  });
  return took;
}

// each state recorded as a page records it, at a second apart
function record(kind, states) {
  const steps = [];
  let last = null;
  states.forEach((state, i) => {
    const now = snapshot(kind, state);
    const s = step(last, now, i * 1000);
    if (s) steps.push(s);
    last = now;
  });
  return steps;
}

test("a diff patched on gives the same, and leaves the old alone", () => {
  const a = { x: [1, null, { y: 2 }], z: { gone: 1, kept: [3] } };
  const b = { x: [1, { y: 3 }], z: { kept: [3, 4] }, w: "new" };
  const before = structuredClone(a);
  assert.deepEqual(patch(a, diff(a, b)), b);
  assert.deepEqual(a, before);
  assert.deepEqual(diff(a, structuredClone(a)), []);
});

test("an Okey round replays step by step as it was seen", () => {
  const states = round(5);
  const steps = record("okey", states);
  const seen = states
    .map((s) => snapshot("okey", s))
    .filter((s, i, all) => i === 0 || s.h !== all[i - 1].h);
  const replayed = replay(steps);
  assert.equal(replayed.length, seen.length);
  replayed.forEach((r, i) => assert.deepEqual(r.view, seen[i].view));
});

test("an Okey round's takes, claims and finish are counted as they happened", () => {
  for (const number of [1, 5]) {
    const states = round(number);
    const meta = { id: "g", kind: "okey", me: "u1" };
    const { players } = summarize(meta, record("okey", states));
    const end = states.at(-1);
    // the state's own tallies: a claim each, a side take each (the
    // tookDiscard it leaves), and the tile thrown to finish
    const took = sideTakes(states);
    for (const p of players) {
      assert.equal(
        p.claimed ?? 0,
        end.takes?.[p.seat] ?? 0,
        `claims ${p.seat}`,
      );
      assert.equal(p.took ?? 0, took[p.seat] ?? 0, `takes ${p.seat}`);
    }
    const fed = players.reduce((n, p) => n + (p.fed ?? 0), 0);
    const taken = players.reduce(
      (n, p) => n + (p.took ?? 0) + (p.claimed ?? 0),
      0,
    );
    assert.equal(fed, taken);
    // "P2 finished round 5": the round's message names who finished it
    const finisher = end.message.match(/^P(\d) finished/)?.[1];
    assert.deepEqual(
      players.filter((p) => p.finished).map((p) => String(p.seat)),
      finisher ? [finisher] : [],
    );
  }
});

// wrong calls as each one's count went up (okey.catchDiscard), the jump
// over a missed step too
test("an Okey round's wrong calls are counted by who made them", () => {
  const states = round(1);
  const n = states.length;
  const calls = (s, wrong) => ({
    ...s,
    players: s.players.map((p) =>
      p.id === 3 ? { ...p, calls: { wrong, tile: "x", at: 0 } } : p,
    ),
  });
  const marked = states.map((s, i) =>
    i < n / 4 ? s : calls(s, i < n / 2 ? 1 : 3),
  );
  const meta = { id: "g", kind: "okey", me: "u1" };
  const { players } = summarize(meta, record("okey", marked));
  assert.deepEqual(
    players.map((p) => p.wrong ?? 0),
    [0, 0, 3, 0],
  );
});

test("a second tab's copy of the steps is passed over", () => {
  const steps = record("okey", round(5));
  const twice = steps.flatMap((s) => [s, { ...s }]);
  assert.deepEqual(replay(twice), replay(steps));
});

test("after a gap, the game starts over whole and nothing is counted across it", () => {
  const states = round(5);
  const steps = record("okey", states);
  const cut = Math.floor(steps.length / 2);
  // the page closed for ten steps, then came back to the game as it was
  const back = snapshot(
    "okey",
    (() => {
      const later = replay(steps)[cut + 10];
      return states.find((s) => snapshot("okey", s).h === later.h);
    })(),
  );
  const gapped = [
    ...steps.slice(0, cut),
    step(null, back, 0),
    ...steps.slice(cut + 11),
  ];
  const replayed = replay(gapped);
  assert.isTrue(replayed[cut].gap);
  assert.deepEqual(replayed.at(-1).view, replay(steps).at(-1).view);
  const full = summarize({ id: "g", kind: "okey" }, steps).players;
  const less = summarize({ id: "g", kind: "okey" }, gapped).players;
  const count = (ps) => ps.reduce((n, p) => n + (p.fed ?? 0), 0);
  assert.isAtMost(count(less), count(full));
});

test("a title only for standing out: 3 or more, well beyond an even share", () => {
  const titles = (players) => withTitles(players).map((p) => p.title);
  // opened first once, nobody else did: nothing; 3 times to 2: nothing;
  // every round of three: the title
  assert.deepEqual(titles([{ id: "a", first: 1 }, { id: "b" }]), [null, null]);
  assert.deepEqual(
    titles([
      { id: "a", first: 3 },
      { id: "b", first: 2 },
    ]),
    [null, null],
  );
  assert.deepEqual(titles([{ id: "a", first: 3 }, { id: "b" }]), [
    "first",
    null,
  ]);
  // level with someone: nothing; well ahead: the title
  assert.deepEqual(
    titles([
      { id: "a", took: 4, fed: 1 },
      { id: "b", took: 4, fed: 5 },
      { id: "c", caught: 2 },
    ]),
    [null, "fed", null],
  );
  // a little ahead of an even share: nothing; far ahead, though not twice
  // the next player's: the title
  const took = (...n) => titles(n.map((took, i) => ({ id: `${i}`, took })));
  assert.deepEqual(took(16, 15, 13, 12), [null, null, null, null]);
  assert.deepEqual(took(25, 15, 10, 10), ["took", null, null, null]);
  // ahead at two things: the one they stood out at most, the other nobody's
  assert.deepEqual(
    titles([
      { id: "a", fed: 9, caught: 4 },
      { id: "b", fed: 1 },
    ]),
    ["fed", null],
  );
});

// a game of Tic-tac-toe, X winning, as a table records it: the game and
// who sits in each seat at each mark (`seats` by mark)
function ttt(seats) {
  let s = tictactoe.newGame(null, ["a", "b"], "classic");
  const marks = [
    [0, 0],
    [1, 3],
    [0, 1],
    [1, 4],
    [0, 2],
  ];
  const states = [{ ...s, seats: seats(0) }];
  marks.forEach(([seat, cell], i) => {
    s = tictactoe.mark(s, seat, cell);
    states.push({ ...s, seats: seats(i + 1) });
  });
  return summarize(
    { id: "t", kind: "tictactoe", me: "a" },
    record("tictactoe", states),
  );
}
const ayse = { id: "a", name: "Ayşe" };

test("a table game's summary: who played, and who won", () => {
  const summary = ttt(() => [ayse, { id: "b", name: "Bora" }]);
  assert.deepEqual(
    summary.players.map((p) => [p.name, p.ids, p.result]),
    [
      ["Ayşe", ["a"], "won"],
      ["Bora", ["b"], "lost"],
    ],
  );
  assert.equal(summary.ms, 5000);
});

test("a player who sits back down on another device is one person; someone else isn't", () => {
  // Bora stands after two marks and sits again on his phone, another id
  const phone = ttt((i) => [
    ayse,
    i < 2
      ? { id: "b", name: "Bora" }
      : i === 2
        ? null
        : { id: "b2", name: "bora " },
  ]);
  assert.deepEqual(
    phone.players.map((p) => [p.ids, p.result]),
    [
      [["a"], "won"],
      [["b", "b2"], "lost"],
    ],
  );
  // Can takes his seat instead: Bora left before the end
  const other = ttt((i) => [
    ayse,
    i < 2 ? { id: "b", name: "Bora" } : { id: "c", name: "Can" },
  ]);
  assert.deepEqual(
    other.players.map((p) => [p.name, p.result]),
    [
      ["Ayşe", "won"],
      ["Bora", null],
      ["Can", "lost"],
    ],
  );
  // one page in both seats: both sides played, no result
  const both = ttt(() => [ayse, ayse]);
  assert.deepEqual(
    both.players.map((p) => [p.name, p.result]),
    [["Ayşe", null]],
  );
});

test("a device switch seen once joins both devices' games, before and after", () => {
  const game = (...players) => ({
    players: players.map((ids) => ({ ids })),
  });
  const all = [
    game(["a"], ["b"]), // Bora on his laptop
    game(["a"], ["b", "b2"]), // switching to his phone mid-game
    game(["c"], ["b2"]), // on his phone, against Can
  ];
  const who = identities(all);
  assert.equal(who({ ids: ["b"] }), who({ ids: ["b2"] }));
  assert.notEqual(who({ ids: ["a"] }), who({ ids: ["b"] }));
  assert.notEqual(who({ ids: ["c"] }), who({ ids: ["b2"] }));
});

test("counts carry across rounds, and tiles dealt into a new round count nothing", () => {
  const first = round(1);
  const second = play(okey.nextRound(first.at(-1)));
  const { players } = summarize(
    { id: "g", kind: "okey" },
    record("okey", [...first, ...second]),
  );
  const took = [sideTakes(first), sideTakes(second)];
  for (const p of players) {
    const claims = (s) => s.at(-1).takes?.[p.seat] ?? 0;
    assert.equal(
      p.claimed ?? 0,
      claims(first) + claims(second),
      `claims ${p.seat}`,
    );
    assert.equal(
      p.took ?? 0,
      (took[0][p.seat] ?? 0) + (took[1][p.seat] ?? 0),
      `takes ${p.seat}`,
    );
  }
});

test("backgammon: rolls and doubles by who rolled, the mars, who won", () => {
  const seats = [ayse, { id: "b", name: "Bora" }];
  let s = backgammon.newGame(null, ["a", "b"]);
  const states = [{ ...s, seats }];
  while (!s.winner)
    states.push({ ...(s = backgammonBot.play(s, s.turn)), seats });
  const summary = summarize(
    { id: "bg", kind: "backgammon", me: "a" },
    record("backgammon", states),
  );
  const rolls = (seat) =>
    states.filter(
      (x, i) => i > 0 && x.rolled !== states[i - 1].rolled && x.by === seat,
    );
  summary.players.forEach((p) => {
    assert.equal(p.rolls, rolls(p.seat).length);
    assert.equal(
      p.doubles ?? 0,
      rolls(p.seat).filter((x) => x.dice[0] === x.dice[1]).length,
    );
    assert.equal(p.result, p.seat === s.winner.seat ? "won" : "lost");
  });
  assert.equal(summary.mars, s.winner.points === 2);
});

test("batak: a match of four, won by the most points", () => {
  const seats = [ayse, ...["b", "c", "d"].map((id) => ({ id, name: id }))];
  let s = batak.newGame(null, ["a", "b", "c", "d"], "4");
  const states = [{ ...s, seats }];
  while (s.turn !== null)
    states.push({ ...(s = batakBot.play(s, s.turn)), seats });
  const summary = summarize(
    { id: "bk", kind: "batak", me: "a" },
    record("batak", states),
  );
  assert.lengthOf(summary.players, 4);
  const top = Math.max(...s.score);
  summary.players.forEach((p) =>
    assert.equal(p.result, s.score[p.seat] === top ? "won" : "lost"),
  );
});

test("pages' summaries put together: the most each counted, alike on every page", () => {
  const player = (id, seat, counts) => ({
    id,
    name: id,
    seat,
    result: "lost",
    ...counts,
  });
  // Ayşe's page saw all three tiles she caught; Bora's missed them (a gap)
  const ayse = [
    player("a", 1, { caught: 3, took: 1 }),
    player("b", 2, { took: 2 }),
    player("c", 3, {}),
  ];
  const bora = [
    player("a", 1, { took: 1, title: null }),
    player("b", 2, { took: 4 }),
    player("c", 3, {}),
  ];
  const one = together([
    ["g/a", ayse],
    ["g/b", bora],
  ]);
  const other = together([
    ["g/b", bora],
    ["g/a", ayse],
  ]);
  assert.deepEqual(one, other);
  const byId = Object.fromEntries(one.map((p) => [p.id, p]));
  assert.equal(byId.a.caught, 3);
  assert.equal(byId.b.took, 4);
  assert.equal(byId.a.title, "caught");
  assert.equal(byId.b.title, "took");
  assert.isNull(byId.c.title);
});
