// Checkers, on the back of the backgammon case (its modes, Backgammon/
// index.jsx): American checkers, "checkers", and Turkish dama, "dama", on
// an 8×8 board. Seat 0 plays white from the bottom rows (as seat 0 sees
// it), seat 1 black from the top. A move is one hop: a step, or a jump over
// a piece of the other's, which comes off at once; a piece that has jumped
// and can jump again must, the same turn (`jumping`).
//
// American (English draughts): 12 men each on the dark squares of the three
// nearest rows, black first. Men step and jump diagonally forward; kings,
// one square, any diagonal. A jump must be taken, any one of them, and a
// man reaching the far row is crowned and stops there.
//
// Dama: 16 men each on the second and third rows, white first. Men step and
// jump straight forward or sideways; kings fly any distance straight, and
// jump a piece any way off, landing anywhere past it, but never straight
// back the way they came. A jump must be taken, and of them the most pieces
// there are to take. A man is crowned once its move ends on the far row
// (one reaching it mid-jump jumps on as a man: our call, the rules we read
// don't say). A king against a lone man is a draw.
//
// Both: no move left (none to move, or all blocked) loses; 40 moves each
// with no jump and no man gone forward is a draw (ours, so a game of kings,
// or of dama men going sideways, two bots' too, ends).
//
// The state, the same in every page (Table: `turn`, `winner`, `score`):
// - cells: the squares row by row, from the top as seat 0 sees it, each a
//   piece { id, seat, king } or null; a piece keeps its id as it moves, to
//   slide (Board.jsx)
// - jumping: { at, dir }, the piece in the middle of its jumps, or null
// - quiet: hops since a jump or a man's move forward; draw: true once drawn
// - back: { seat, was }, the turn so far and what was before it, its
//   mover's to take back till the other moves
// - last: { n, kind: "hop", from, to, over }, what happened last

const N = 8;
export const QUIET = 80;

export const rowOf = (i) => Math.floor(i / N);
export const colOf = (i) => i % N;
const at = (r, c) => (r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1);
// the row a seat's men head for, and their way there
const far = (seat) => (seat === 0 ? 0 : N - 1);
const ahead = (seat) => (seat === 0 ? -1 : 1);

const DIAGONAL = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const STRAIGHT = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// the ways a piece goes: a man's forward (dama: and sideways), a king's all
function ways(mode, p) {
  const all = mode === "dama" ? STRAIGHT : DIAGONAL;
  return p.king
    ? all
    : all.filter(([dr]) => dr === ahead(p.seat) || (mode === "dama" && !dr));
}
const flies = (mode, p) => mode === "dama" && p.king;

function setUp(mode) {
  const cells = Array(N * N).fill(null);
  let id = 0;
  const put = (r, c, seat) =>
    (cells[at(r, c)] = { id: id++, seat, king: false });
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (mode === "dama") {
        if (r === 1 || r === 2) put(r, c, 1);
        if (r === 5 || r === 6) put(r, c, 0);
      } else if ((r + c) % 2) {
        if (r < 3) put(r, c, 1);
        if (r > 4) put(r, c, 0);
      }
    }
  }
  return cells;
}

// `ids`: the seated players' ids: the score carries over while the same
// two sit in the same seats
export function newGame(prev, ids, mode = "checkers") {
  const same =
    !!prev && prev.players[0] === ids[0] && prev.players[1] === ids[1];
  return {
    mode,
    cells: setUp(mode),
    players: ids,
    score: same ? prev.score : [0, 0],
    turn: mode === "dama" ? 0 : 1,
    jumping: null,
    quiet: 0,
    back: null,
    winner: null,
    draw: false,
    last: { n: (prev?.last?.n ?? 0) + 1, kind: "new" },
  };
}

// the jumps the piece `p` on `from` has: { to, over, dir }; never straight
// back along `not` (a dama king's last jump)
function jumps(mode, cells, from, p, not) {
  const out = [];
  const [r, c] = [rowOf(from), colOf(from)];
  for (const dir of ways(mode, p)) {
    const [dr, dc] = dir;
    if (not && dr === -not[0] && dc === -not[1]) continue;
    let k = 1;
    if (flies(mode, p))
      while (
        at(r + k * dr, c + k * dc) >= 0 &&
        !cells[at(r + k * dr, c + k * dc)]
      )
        k++;
    const over = at(r + k * dr, c + k * dc);
    if (over < 0 || cells[over]?.seat !== 1 - p.seat) continue;
    for (let m = k + 1; ; m++) {
      const to = at(r + m * dr, c + m * dc);
      if (to < 0 || cells[to]) break;
      out.push({ to, over, dir });
      if (!flies(mode, p)) break;
    }
  }
  return out;
}

// the squares the piece on `from` can step to
function steps(mode, cells, from, p) {
  const out = [];
  const [r, c] = [rowOf(from), colOf(from)];
  for (const [dr, dc] of ways(mode, p)) {
    for (let k = 1; ; k++) {
      const to = at(r + k * dr, c + k * dc);
      if (to < 0 || cells[to]) break;
      out.push({ to, over: null });
      if (!flies(mode, p)) break;
    }
  }
  return out;
}

// every way the piece on `from` can jump on to the end, a list of jumps
// each; an American man crowned on the way stops there
function chains(mode, cells, from, p, not) {
  const out = [];
  for (const j of jumps(mode, cells, from, p, not)) {
    const next = cells.slice();
    next[from] = null;
    next[j.over] = null;
    next[j.to] = p;
    const stops = mode === "checkers" && !p.king && rowOf(j.to) === far(p.seat);
    const more = stops
      ? []
      : chains(mode, next, j.to, p, flies(mode, p) ? j.dir : null);
    if (!more.length) out.push([j]);
    for (const m of more) out.push([j, ...m]);
  }
  return out;
}

// The ways the one to move can play out the turn, each { from, hops }: the
// jumps when there are any (dama: those taking the most), else the steps;
// once jumping, only that piece's jumps on.
const known = new WeakMap();
export function plays(state) {
  if (known.has(state)) return known.get(state);
  const { mode, cells, turn, jumping } = state;
  let out = [];
  if (turn !== null) {
    const froms = jumping
      ? [jumping.at]
      : cells.flatMap((p, i) => (p?.seat === turn ? [i] : []));
    out = froms.flatMap((from) =>
      chains(mode, cells, from, cells[from], jumping?.dir).map((hops) => ({
        from,
        hops,
      })),
    );
    if (mode === "dama" && out.length) {
      const most = Math.max(...out.map((x) => x.hops.length));
      out = out.filter((x) => x.hops.length === most);
    }
    if (!out.length && !jumping) {
      out = froms.flatMap((from) =>
        steps(mode, cells, from, cells[from]).map((s) => ({
          from,
          hops: [s],
        })),
      );
    }
  }
  known.set(state, out);
  return out;
}

// where the piece on `from` can hop to now
export const targets = (state, from) => [
  ...new Set(
    plays(state).flatMap((x) => (x.from === from ? [x.hops[0].to] : [])),
  ),
];
// the pieces that can move now
export const movable = (state) => [...new Set(plays(state).map((x) => x.from))];

// the state as it was before a turn, for taking it back
const was = ({ cells, turn, jumping, quiet }) => ({
  cells,
  turn,
  jumping,
  quiet,
});

// the game decided, or not, for the one now to move
function settle(state) {
  const { cells, turn } = state;
  const left = cells.filter(Boolean);
  const loneKingMan =
    state.mode === "dama" &&
    left.length === 2 &&
    left[0].seat !== left[1].seat &&
    left[0].king !== left[1].king;
  if (loneKingMan || state.quiet >= QUIET) {
    return { ...state, turn: null, back: null, draw: true };
  }
  if (plays(state).length) return state;
  const won = 1 - turn;
  return {
    ...state,
    turn: null,
    back: null,
    winner: { seat: won },
    score: state.score.with(won, state.score[won] + 1),
  };
}

// One hop of the piece on `from` to `to`: the turn goes on while it has to
// jump on, else passes, the piece crowned on the far row.
export function hop(state, seat, from, to) {
  if (state.turn !== seat) return;
  const play = plays(state).find((x) => x.from === from && x.hops[0].to === to);
  if (!play) return;
  const { over, dir } = play.hops[0];
  const p = state.cells[from];
  const cells = state.cells.slice();
  cells[from] = null;
  if (over !== null) cells[over] = null;
  cells[to] = p;
  const next = {
    ...state,
    cells,
    back: state.jumping ? state.back : { seat, was: was(state) },
    // a jump, or a man gone forward, is headway; anything else is quiet
    quiet:
      over !== null || (!p.king && rowOf(to) !== rowOf(from))
        ? 0
        : state.quiet + 1,
    last: { n: state.last.n + 1, kind: "hop", from, to, over },
  };
  if (over !== null) {
    const on = { ...next, jumping: { at: to, dir } };
    const crowned =
      state.mode === "checkers" && !p.king && rowOf(to) === far(seat);
    if (!crowned && plays(on).length) return on;
  }
  if (!p.king && rowOf(to) === far(seat)) cells[to] = { ...p, king: true };
  return settle({ ...next, jumping: null, turn: 1 - seat });
}

// why the piece on `from` can't go to `to` (or, `to` left out, can't move)
export function whyNot(state, from, to) {
  if (state.turn === null) return;
  const all = plays(state);
  if (!all.length) return;
  const p = state.cells[from];
  if (p?.seat !== state.turn) return;
  if (state.jumping && from !== state.jumping.at) {
    return "Jump on with the same piece";
  }
  if (
    all.some(
      (x) => x.from === from && (to === undefined || x.hops[0].to === to),
    )
  ) {
    return;
  }
  // no jump to take: the board shows where it can go
  if (all[0].hops[0].over === null) return;
  if (
    state.mode === "dama" &&
    chains(state.mode, state.cells, from, p).length
  ) {
    return "Take the most pieces you can";
  }
  return "A jump has to be taken";
}

// takes back the turn so far, till the other moves
export function undo(state, seat) {
  if (state.back?.seat !== seat || state.turn === null) return;
  return {
    ...state,
    ...state.back.was,
    back: null,
    last: { n: state.last.n + 1, kind: "undo" },
  };
}
