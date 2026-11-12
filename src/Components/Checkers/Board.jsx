import { useEffect, useState } from "react";
import { Modes, Undo, tell, useChangedAt } from "../Table";
import { t } from "../../i18n";
import { colOf, hop, movable, rowOf, targets, undo, whyNot } from "./rules";
import "./checkers.css";

// The back of the backgammon case: a board of eight by eight, walnut and
// ash, the backgammon checkers on it (backgammon.css) and each player's
// word, Undo and the game's modes at their side of it (checkers.css lays
// them out). Each sees their own pieces at the bottom.
const COLOR = ["white", "black"];
// as long as a piece takes to slide (checkers.css)
const SLIDE_MS = 400;

// the square `i`'s column and row as `viewer` sees the board
const spot = (i, viewer) =>
  viewer === 0 ? [colOf(i), rowOf(i)] : [7 - colOf(i), 7 - rowOf(i)];

// a side of the board: its player's word, Undo, and the modes on yours
function Side({ far, over, said, modes, onUndo }) {
  return (
    <div className={`ck-side${far ? " far" : ""}${over ? " over" : ""}`}>
      {said && <p className="ck-said">{said}</p>}
      {modes}
      {onUndo && <Undo className="ck-undo" onClick={onUndo} />}
    </div>
  );
}

// The game on its board (`table`, Table's useTable): the seat to move taps
// a piece and where it goes, a hop at a time, jumping on while it must;
// the turn is its mover's to take back till the other moves; once it's
// over, a tap on the board starts the next game.
export default function Board({ state, table }) {
  const { live, mine, near, far, across, names, note, act, deal } = table;
  const me = mine.includes(state.turn) ? state.turn : mine[0];
  const playing = me !== undefined && state.turn === me;
  const away = (seat) => across && seat !== near;
  const [picked, setPicked] = useState(null);
  const from = playing ? movable(state) : [];
  // mid-jump, or the only piece that can go, it's picked already
  const sel = !playing
    ? null
    : state.jumping
      ? state.jumping.at
      : picked !== null && from.includes(picked)
        ? picked
        : from.length === 1
          ? from[0]
          : null;
  const to = sel === null ? [] : targets(state, sel);

  // pieces slide only for a hop seen happen, and are simply in place once
  // they have, or when the game arrives or the board turns
  const movedAt = useChangedAt(state.last.n, live);
  const sliding = Date.now() - movedAt < SLIDE_MS;
  const [, slid] = useState(0);
  useEffect(() => {
    if (!sliding) return;
    const timer = setTimeout(
      () => slid(movedAt),
      movedAt + SLIDE_MS - Date.now(),
    );
    return () => clearTimeout(timer);
  }, [sliding, movedAt]);

  const tap = (i) => {
    if (!playing) return;
    if (sel !== null && to.includes(i)) {
      act(hop(state, me, sel, i));
      setPicked(null);
    } else if (from.includes(i)) {
      setPicked(i === sel ? null : i);
    } else {
      const why =
        state.cells[i]?.seat === me
          ? whyNot(state, i)
          : sel !== null && whyNot(state, sel, i);
      if (why) tell(why, away(me));
    }
  };

  const over = state.turn === null && state.last.kind !== "new";
  const said = state.winner
    ? t(`${names[state.winner.seat]} wins!`)
    : state.draw
      ? t("Draw")
      : note;
  const back = state.back?.seat;
  const canUndo = mine.includes(back) && state.turn !== null;
  const side = (seat, isFar) => (
    <Side
      far={isFar}
      over={away(seat)}
      // what's said is for both: the far side's copy only face to face
      said={(!isFar || across) && said}
      modes={!isFar && <Modes table={table} />}
      onUndo={
        canUndo && back === seat
          ? () => {
              act(undo(state, back));
              setPicked(null);
            }
          : null
      }
    />
  );

  const squares = [];
  const pieces = [];
  state.cells.forEach((p, i) => {
    const [x, y] = spot(i, near);
    const dark = (rowOf(i) + colOf(i)) % 2 === 1;
    squares.push(
      <button
        key={i}
        className={`ck-square${dark ? " dark" : ""}${to.includes(i) ? " target" : ""}`}
        style={{ "--x": x, "--y": y }}
        data-at={i}
        aria-label={String.fromCharCode(97 + colOf(i)) + (8 - rowOf(i))}
        onClick={() => tap(i)}
      />,
    );
    if (!p) return;
    const cls = [
      "bg-checker",
      COLOR[p.seat],
      p.king && "king",
      i === sel && "picked",
      sel === null && from.includes(i) && "movable",
    ];
    pieces.push(
      <div
        key={p.id}
        className={cls.filter(Boolean).join(" ")}
        style={{ "--x": x + 0.04, "--y": y + 0.04 }}
      />,
    );
  });
  // in the same order every time: a piece moved in the page doesn't slide
  pieces.sort((a, b) => a.key - b.key);

  return (
    <div className="ck-scene">
      {side(far, true)}
      <div className={`ck-board${sliding ? " sliding" : ""}`}>
        <div className="ck-squares">
          {squares}
          {pieces}
        </div>
        {over && deal && (
          <button
            className="ck-next"
            aria-label={t("Next game")}
            title={t("Next game")}
            onClick={deal}
          />
        )}
      </div>
      {side(near, false)}
    </div>
  );
}
