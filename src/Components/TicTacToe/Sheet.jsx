import { useState } from "react";
import { Undo, tell, useChangedAt } from "../Table";
import { t } from "../../i18n";
import { useKey } from "../../hooks/useKey";
import { mark, undo, whyNot } from "./rules";

// A sheet of squared paper on the table, the grid drawn by hand in pencil,
// each X and O in ink, each its own way: drawn as it's made, only for a
// mark seen made (not when the page opens on the game). In units of a
// hundredth of the sheet's width, the grid in the middle, a margin above
// and below it for a word to each side of the table. Super's small boards
// sit in the big grid's squares, PAD in from their lines.
const W = 100;
const H = 124;
const CELL = 26;
const X0 = (W - CELL * 3) / 2;
const Y0 = (H - CELL * 3) / 2;
const PAD = 2.6;
// as long as the ink takes: a mark, the board it takes, the line through
// a win (tictactoe.css)
const INK_MS = 1400;

// a big square's box: its top left and width
const square = (i) => ({
  x: X0 + CELL * (i % 3),
  y: Y0 + CELL * Math.floor(i / 3),
  w: CELL,
});
// a square's: Super's in its small board
function box(cell, small) {
  if (!small) return square(cell);
  const board = square(Math.floor(cell / 9));
  const w = (CELL - PAD * 2) / 3;
  return {
    x: board.x + PAD + w * (cell % 3),
    y: board.y + PAD + w * Math.floor((cell % 9) / 3),
    w,
  };
}
const middle = ({ x, y, w }) => [x + w / 2, y + w / 2];

// a hand's wobble, up to `by` either way
const wob = (by) => (Math.random() - 0.5) * 2 * by;
const f = (n) => n.toFixed(1);

// a line drawn by hand: its ends a little off, bowed a little
function line(x1, y1, x2, y2, by = 0.8) {
  const [mx, my] = [(x1 + x2) / 2 + wob(by), (y1 + y2) / 2 + wob(by)];
  return `M${f(x1 + wob(by))} ${f(y1 + wob(by))}Q${f(mx)} ${f(my)} ${f(x2 + wob(by))} ${f(y2 + wob(by))}`;
}

// a ring drawn by hand: round once and a little past where it began
function ring(cx, cy, size) {
  const r = size * (1 + wob(0.06));
  const a0 = Math.random() * 2 * Math.PI;
  const k = Math.random() * 6;
  const points = Array.from({ length: 29 }, (_, i) => {
    const a = a0 + (i / 28) * 2.15 * Math.PI;
    const rr = r * (1 + 0.05 * Math.sin(2 * a + k)) * (1 - i * 0.002);
    return `${f(cx + rr * Math.cos(a))} ${f(cy + 0.92 * rr * Math.sin(a))}`;
  });
  return `M${points.join("L")}`;
}

// an X's two strokes or an O's one, in a box
const strokes = (seat, at) => {
  const [x, y] = middle(at);
  const s = at.w * 0.29;
  const by = at.w * 0.03;
  return seat
    ? [ring(x, y, at.w * 0.33)]
    : [
        line(x - s, y - s, x + s, y + s, by),
        line(x + s, y - s, x - s, y + s, by),
      ];
};

// a seat's mark, X or O, drawn as it's made (`fresh`) or there already:
// `kind` small (Super's squares), big (a board taken), or plain
function Ink({ seat, at, fresh, kind = "" }) {
  const [paths] = useState(() => strokes(seat, at));
  return (
    <g className={`tt-ink ${seat ? "o" : "x"} ${kind}${fresh ? " fresh" : ""}`}>
      {paths.map((d) => (
        <path key={d} d={d} pathLength="1" />
      ))}
    </g>
  );
}

// the seats' marks, as the players' plates show them (Table)
export function Glyph({ seat }) {
  return (
    <svg className={`tt-glyph ${seat ? "o" : "x"}`} viewBox="0 0 24 24">
      {seat ? (
        <circle cx="12" cy="12" r="7" />
      ) : (
        <path d="M6 6 18 18M18 6 6 18" />
      )}
    </svg>
  );
}

// the pencil grid, Super's small ones in it, and a win's line, drawn once
// for the sheet
function Pencil({ small, winner, fresh }) {
  const [grid] = useState(() => {
    const big = [1, 2].flatMap((i) => [
      line(X0 + CELL * i, Y0 - 3, X0 + CELL * i, Y0 + CELL * 3 + 3),
      line(X0 - 3, Y0 + CELL * i, X0 + CELL * 3 + 3, Y0 + CELL * i),
    ]);
    if (!small) return { big, fine: [] };
    const w = (CELL - PAD * 2) / 3;
    const fine = Array.from({ length: 9 }, (_, b) => square(b)).flatMap(
      ({ x, y }) =>
        [1, 2].flatMap((i) => [
          line(
            x + PAD + w * i,
            y + PAD - 0.6,
            x + PAD + w * i,
            y + CELL - PAD + 0.6,
            0.3,
          ),
          line(
            x + PAD - 0.6,
            y + PAD + w * i,
            x + CELL - PAD + 0.6,
            y + PAD + w * i,
            0.3,
          ),
        ]),
    );
    return { big, fine };
  });
  const [strike, setStrike] = useState(null);
  if (winner && !strike) {
    // from beyond the first of the three to beyond the last
    const [[x1, y1], [x2, y2]] = [winner.line[0], winner.line[2]].map((i) =>
      middle(square(i)),
    );
    const [dx, dy] = [(x2 - x1) / 8, (y2 - y1) / 8];
    setStrike(line(x1 - dx, y1 - dy, x2 + dx, y2 + dy));
  }
  return (
    <>
      <g className="tt-grid">
        {grid.big.map((d) => (
          <path key={d} d={d} />
        ))}
        {grid.fine.map((d) => (
          <path key={d} className="fine" d={d} />
        ))}
      </g>
      {winner && strike && (
        <g
          className={`tt-ink tt-strike ${winner.seat ? "o" : "x"}${fresh ? " fresh" : ""}`}
        >
          <path d={strike} pathLength="1" />
        </g>
      )}
    </>
  );
}

// The game on its sheet (`table`, Table's useTable): the seat to move
// marks a square, the last mark is its maker's to take back (Undo), and
// once the game's over a tap on the sheet starts the next.
export default function Sheet({ state, table }) {
  const { live, mine, near: viewer, across, names, note, act, deal } = table;
  const me = mine.includes(state.turn) ? state.turn : mine[0];
  const playing = me !== undefined && state.turn === me;
  // across the table from the viewer, on this device: turned to them, in
  // their margin
  const away = (seat) => across && seat !== viewer;
  const seenAt = useChangedAt(state.last.n, live);
  const fresh = Date.now() - seenAt < INK_MS;
  const { last, winner, boards } = state;
  const small = !!boards;

  const tap = (cell) => {
    if (!playing) return;
    const why = whyNot(state, cell);
    if (why) tell(why, away(me));
    else act(mark(state, me, cell));
  };

  const over = state.turn === null && !note;
  const status =
    note ??
    (winner
      ? t(`${names[winner.seat]} wins!`)
      : over
        ? t("Draw")
        : me !== undefined && !playing
          ? t(`Waiting for ${names[state.turn]}`)
          : null);
  const back = state.back?.seat;
  const canUndo = state.back && mine.includes(back);
  const next = over && deal;
  useKey("n", next);

  return (
    <div
      className={`tt-sheet${small ? " super" : ""}${fresh && last.kind === "new" ? " fresh" : ""}${next ? " ready" : ""}`}
    >
      {/* drawn afresh for each game, and for another mode: the blank sheet
          and a room's first game share a number */}
      <svg key={`${state.sheet}-${state.mode}`} viewBox={`0 0 ${W} ${H}`}>
        {/* Super: the board(s) the next mark goes in, a highlighter's */}
        {small &&
          state.turn !== null &&
          boards.map(
            (owner, b) =>
              owner === null &&
              (state.next === null || state.next === b) && (
                <rect
                  key={b}
                  className="tt-lit"
                  x={square(b).x + 1}
                  y={square(b).y + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                />
              ),
          )}
        <Pencil
          small={small}
          winner={winner}
          fresh={fresh && last.kind === "mark"}
        />
        {state.cells.map(
          (seat, cell) =>
            seat !== null && (
              <Ink
                key={cell}
                seat={seat}
                at={box(cell, small)}
                kind={
                  small
                    ? `small${boards[Math.floor(cell / 9)] !== null ? " done" : ""}`
                    : ""
                }
                fresh={fresh && last.kind === "mark" && last.cell === cell}
              />
            ),
        )}
        {/* Super: a board taken, its taker's mark over it, big */}
        {small &&
          boards.map(
            (owner, b) =>
              owner !== null &&
              owner >= 0 && (
                <Ink
                  key={`board-${b}`}
                  seat={owner}
                  at={square(b)}
                  kind="big"
                  fresh={
                    fresh &&
                    last.kind === "mark" &&
                    last.took &&
                    Math.floor(last.cell / 9) === b
                  }
                />
              ),
          )}
        {state.cells.map((seat, cell) => {
          const { x, y, w } = box(cell, small);
          return (
            <rect
              key={cell}
              className={`tt-cell${playing && seat === null ? " open" : ""}`}
              data-cell={cell}
              x={x}
              y={y}
              width={w}
              height={w}
              onClick={() => tap(cell)}
            />
          );
        })}
      </svg>
      {/* face to face: a copy turned to each, in their margins */}
      {status && across && (
        <div className="tt-margin over">
          <p>{status}</p>
        </div>
      )}
      <div className="tt-margin">{status && <p>{status}</p>}</div>
      {canUndo && (
        <Undo
          className={`tt-undo${away(back) ? " over" : ""}`}
          onClick={() => act(undo(state, back))}
        />
      )}
      {next && (
        <button
          className="tt-next"
          aria-label={t("Next game")}
          title={t("Next game")}
          onClick={deal}
        >
          <kbd>N</kbd>
        </button>
      )}
    </div>
  );
}
