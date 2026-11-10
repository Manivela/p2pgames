import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { BAR, OFF, move, roll, sources, targets, undo, whyNot } from "./rules";
import { t } from "../../i18n";

// The board as the viewer sits at it: their home bottom right, their
// checkers coming round from top right, the borne-off tray on the right.
// Everything is placed in point widths, --p (backgammon.css fits the board
// to the screen), from these:
const FRAME = 0.45;
const BAR_W = 1.1;
const TRAY_W = 1.2;
const POINT_H = 4.8; // five checkers
const MID = 1.4; // between the rows, for the dice
const C = 0.92; // a checker
const STEP = 0.96;
const FLAT = 0.3; // a borne-off checker, on its side
const W = FRAME * 3 + 12 + BAR_W + TRAY_W;
const H = FRAME * 2 + POINT_H * 2 + MID;
const BAR_X = FRAME + 6;
const TRAY_X = FRAME * 2 + 12 + BAR_W;

// a point's column (0 left … 11 right) and row, as the viewer sees a seat's
// point n: their 1 bottom right, 12 bottom left, 13 top left, 24 top right
function spot(viewer, seat, n) {
  const v = seat === viewer ? n : 25 - n;
  return v <= 12 ? { col: 12 - v, top: false } : { col: v - 13, top: true };
}
const colX = (col) => FRAME + col + (col >= 6 ? BAR_W : 0);

// a stack of more than five closes up to fit the point
const gap = (count) => (count > 5 ? (POINT_H - C) / (count - 1) : STEP);

// the top left of the i-th checker of `count` on a seat's `pos`
function place(viewer, seat, pos, i, count) {
  const near = seat === viewer;
  if (pos === OFF) {
    const x = TRAY_X + 0.1;
    return { x, y: near ? H - FRAME - FLAT * (i + 1) : FRAME + FLAT * i };
  }
  const g = gap(count);
  if (pos === BAR) {
    const x = BAR_X + (BAR_W - C) / 2;
    return { x, y: near ? H / 2 + 0.15 + i * g : H / 2 - 0.15 - C - i * g };
  }
  const { col, top } = spot(viewer, seat, pos);
  const x = colX(col) + (1 - C) / 2;
  return { x, y: top ? FRAME + i * g : H - FRAME - C - i * g };
}

// Each checker keeps who it is from one state to the next, so it slides
// from where it was to where it's gone (a CSS transition): the ones that
// left a point are matched to the points that gained one, nearest first.
function useCheckerStacks(checkers) {
  const ref = useRef(null);
  const prev = ref.current;
  if (prev?.checkers === checkers) return prev.stacks;
  const stacks = checkers.map((counts, seat) => {
    let next = 0;
    if (!prev)
      return counts.map((n) => Array.from({ length: n }, () => next++));
    const s = prev.stacks[seat].map((ids) => [...ids]);
    const loose = [];
    s.forEach((ids, pos) => {
      while (ids.length > counts[pos]) loose.push({ id: ids.pop(), pos });
    });
    for (let pos = BAR; pos >= OFF; pos--) {
      while (s[pos].length < counts[pos]) {
        loose.sort((a, b) => Math.abs(a.pos - pos) - Math.abs(b.pos - pos));
        s[pos].push(loose.shift().id);
      }
    }
    return s;
  });
  ref.current = { checkers, stacks };
  return stacks;
}

// a die's pips, by row and column of three
const PIPS = {
  1: ["2/2"],
  2: ["1/1", "3/3"],
  3: ["1/1", "2/2", "3/3"],
  4: ["1/1", "1/3", "3/1", "3/3"],
  5: ["1/1", "1/3", "2/2", "3/1", "3/3"],
  6: ["1/1", "2/1", "3/1", "1/3", "2/3", "3/3"],
};

function Die({ n, used }) {
  return (
    <span className={`bg-die${used ? " used" : ""}`} data-n={n}>
      {PIPS[n].map((at) => (
        <i key={at} style={{ gridArea: at }} />
      ))}
    </span>
  );
}

// the roll on the roller's side, the dice played faded
function Dice({ state }) {
  const { dice, left } = state;
  const all = dice[0] === dice[1] ? [...dice, ...dice] : dice;
  const unused = [...left];
  return all.map((n, i) => {
    const at = unused.indexOf(n);
    if (at >= 0) unused.splice(at, 1);
    return <Die key={`${state.last.n}-${i}`} n={n} used={at < 0} />;
  });
}

// how a dragged checker follows the pointer before it counts as a drag
const SLOP = 6;

export default function Board({ state, me, viewer, names, note, act }) {
  const [picked, setPicked] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragged = useRef(false);
  const board = useRef();
  const stacks = useCheckerStacks(state.checkers);
  const playing = me !== undefined && state.turn === me && state.left.length;
  const from = playing ? sources(state) : [];
  // the only checker that can move (from the bar, often) is picked already
  const sel = playing
    ? ((picked !== null && from.includes(picked) ? picked : null) ??
      (from.length === 1 ? from[0] : null))
    : null;
  const to = sel === null ? new Map() : targets(state, sel);

  const tap = (pos) => {
    if (!playing) return;
    if (sel !== null && to.has(pos)) {
      act(move(state, me, sel, pos));
      setPicked(null);
    } else if (pos !== sel && from.includes(pos)) {
      setPicked(pos);
    } else {
      const why =
        (sel !== null && pos !== sel && whyNot(state, sel, pos)) ||
        (state.checkers[me][pos] && whyNot(state, pos));
      if (why) toast(t(why), { id: "why" });
      setPicked(pos === sel && from.length > 1 ? null : picked);
    }
  };

  // a checker dragged from a point it can leave, dropped where it can go
  const down = (e, pos) => {
    if (!playing || !from.includes(pos) || e.button > 0) return;
    const start = { x: e.clientX, y: e.clientY };
    dragged.current = false;
    const moveTo = (ev) => {
      const far = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
      if (!dragged.current && far < SLOP) return;
      dragged.current = true;
      setPicked(pos);
      // on the board, where the pointer is
      const { left, top } = board.current.getBoundingClientRect();
      setDrag({ pos, x: ev.clientX - left, y: ev.clientY - top });
    };
    const up = (ev) => {
      removeEventListener("pointermove", moveTo);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      setDrag(null);
      if (!dragged.current) return;
      // past the click, if any, that this pointerup sends
      setTimeout(() => (dragged.current = false));
      if (ev.type === "pointercancel") return;
      const at = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest("[data-pos]");
      const dest = at && Number(at.dataset.pos);
      const steps = at && targets(state, pos).get(dest);
      if (steps) act(move(state, me, pos, dest));
      else if (at && dest !== pos) {
        const why = whyNot(state, pos, dest);
        if (why) toast(t(why), { id: "why" });
      }
      setPicked(null);
    };
    addEventListener("pointermove", moveTo);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  };
  // a drag that ends on its own point sends a click: not a tap
  const click = (pos) => !dragged.current && tap(pos);
  const hit = (pos) => ({
    "data-pos": pos,
    onPointerDown: (e) => down(e, pos),
    onClick: () => click(pos),
  });

  const points = [];
  for (let n = 1; n <= 24; n++) {
    const { col, top } = spot(viewer, viewer, n);
    const dark = (col + (top ? 0 : 1)) % 2;
    points.push(
      <div
        key={n}
        className={`bg-point${top ? " top" : ""}${to.has(n) ? " target" : ""}`}
        style={{ "--x": colX(col), "--y": top ? FRAME : H - FRAME - POINT_H }}
        {...hit(n)}
      >
        <div className={`bg-spike${dark ? " dark" : ""}`} />
      </div>,
    );
  }

  const pieces = [];
  stacks.forEach((seatStacks, seat) =>
    seatStacks.forEach((ids, pos) =>
      ids.forEach((id, i) => {
        const { x, y } = place(viewer, seat, pos, i, ids.length);
        const top = i === ids.length - 1;
        const mine = seat === me;
        const cls = [
          "bg-checker",
          seat ? "black" : "white",
          pos === OFF && "off",
          mine && top && pos === sel && "picked",
          mine && top && sel === null && from.includes(pos) && "movable",
          drag && mine && top && pos === drag.pos && "lifted",
        ];
        pieces.push(
          <div
            key={`${seat}-${id}`}
            className={cls.filter(Boolean).join(" ")}
            style={{ "--x": x, "--y": y }}
          >
            {top && ids.length > 5 && pos !== OFF && <b>{ids.length}</b>}
          </div>,
        );
      }),
    ),
  );

  // where the picked checker can go, each with what it takes: 2, 3 or 5
  const marks = [...to].map(([pos, steps]) => {
    const pips = steps.reduce((sum, s) => sum + s.die, 0);
    if (pos === OFF) {
      return (
        <span
          key="off"
          className="bg-mark off"
          style={{ "--x": TRAY_X, "--y": H / 2 + MID / 2 }}
        >
          {pips}
        </span>
      );
    }
    const count = state.checkers[me][pos];
    // on top of the stack, closed up as it will be (over a blot it hits)
    const { x, y } = place(viewer, me, pos, count, count + 1);
    return (
      <span key={pos} className="bg-mark" style={{ "--x": x, "--y": y }}>
        {pips}
      </span>
    );
  });

  // the roll on the roller's side: the viewer's on the right, the other's left
  const rolled = state.dice.length > 0;
  const mineRolled = state.by === viewer;
  const canRoll =
    me !== undefined &&
    state.turn === me &&
    !state.left.length &&
    !state.winner;
  const canUndo =
    me !== undefined &&
    state.by === me &&
    state.undo.length > 0 &&
    !state.winner;
  const passed =
    state.last.kind === "roll" && state.turn !== state.by && rolled;
  const name = (seat) => names[seat] ?? t(seat ? "Black" : "White");

  // a word in the middle of the board: `note` before a game, then who
  // starts, who couldn't move, whose roll it is
  const status =
    note ??
    (state.opening && !state.undo.length
      ? t(`${name(state.turn)} starts`)
      : passed
        ? t(`${name(state.by)}: no moves`)
        : !state.winner && state.turn !== me && !state.left.length
          ? t(`Waiting for ${name(state.turn)}`)
          : null);

  const side = (mine) => (
    <div
      className="bg-strip"
      style={{ "--x": mine ? colX(6) : colX(0), "--y": FRAME + POINT_H }}
    >
      {mine && canRoll ? (
        <button className="bg-roll" onClick={() => act(rollFor(state, me))}>
          {t("Roll")}
        </button>
      ) : (
        rolled && mineRolled === mine && <Dice state={state} />
      )}
      {mine && canUndo && (
        <button
          className="bg-undo"
          aria-label={t("Undo")}
          title={t("Undo")}
          onClick={() => {
            act(undo(state, me));
            setPicked(null);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
          </svg>
        </button>
      )}
      {!mine && status && <span className="bg-status">{status}</span>}
    </div>
  );

  return (
    <div
      ref={board}
      className="bg-board"
      style={{ "--board-w": W, "--board-h": H }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="bg-field" style={{ "--x": FRAME, "--w": 6 }} />
      <div className="bg-field" style={{ "--x": colX(6), "--w": 6 }} />
      <div
        className="bg-bar"
        style={{ "--x": BAR_X, "--w": BAR_W }}
        {...hit(BAR)}
      />
      <div
        className={`bg-tray${to.has(OFF) ? " target" : ""}`}
        style={{ "--x": TRAY_X, "--w": TRAY_W }}
        {...hit(OFF)}
      />
      {points}
      {side(false)}
      {side(true)}
      {pieces}
      {marks}
      {drag && (
        <div
          className={`bg-checker drag ${me ? "black" : "white"}`}
          style={{ left: drag.x, top: drag.y }}
        />
      )}
    </div>
  );
}

// in development a script can set the next roll: window.backgammon.dice
function rollFor(state, me) {
  const set = import.meta.env.DEV && window.backgammon?.dice;
  return set ? roll(state, me, set) : roll(state, me);
}
