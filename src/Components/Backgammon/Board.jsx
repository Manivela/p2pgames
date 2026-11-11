import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { BAR, OFF, move, roll, sources, targets, undo, whyNot } from "./rules";
import { t } from "../../i18n";

// The board as the viewer sits at it: their home bottom right, their
// checkers coming round from top right, the borne-off tray on the right,
// a case's other side compartment on the left. Everything is placed in
// point widths, --p (backgammon.css fits the board to the screen), from
// these:
const FRAME = 0.4;
const BAR_W = 1.1; // the two halves' walls, hinged
const TRAY_W = 1.1;
const POINT_H = 4.8; // five checkers
const MID = 1.4; // between the rows, for the dice
const C = 0.92; // a checker
const STEP = 0.96;
const FLAT = 0.3; // a borne-off checker, on its side
const W = FRAME * 4 + 12 + BAR_W + TRAY_W * 2;
const H = FRAME * 2 + POINT_H * 2 + MID;
const FIELD_X = FRAME * 2 + TRAY_W;
const BAR_X = FIELD_X + 6;
const TRAY_X = FIELD_X + 12 + BAR_W + FRAME;

// a point's column (0 left … 11 right) and row, as the viewer sees a seat's
// point n: their 1 bottom right, 12 bottom left, 13 top left, 24 top right
function spot(viewer, seat, n) {
  const v = seat === viewer ? n : 25 - n;
  return v <= 12 ? { col: 12 - v, top: false } : { col: v - 13, top: true };
}
const colX = (col) => FIELD_X + col + (col >= 6 ? BAR_W : 0);
const MIDDLE = BAR_X + BAR_W / 2;

// a compartment of the case, `w` wide, inside its frame
const inside = (w) => ({ "--y": FRAME, "--w": w, "--h": H - FRAME * 2 });

// a stack of more than five closes up to fit the point
const gap = (count) => (count > 5 ? (POINT_H - C) / (count - 1) : STEP);

// the top left of the i-th checker of `count` on a seat's `pos`
function place(viewer, seat, pos, i, count) {
  const near = seat === viewer;
  if (pos === OFF) {
    const x = TRAY_X + (TRAY_W - 1) / 2;
    return { x, y: near ? H - FRAME - FLAT * (i + 1) : FRAME + FLAT * i };
  }
  const g = gap(count);
  // out from the middle, clear of Roll there
  if (pos === BAR) {
    const x = BAR_X + (BAR_W - C) / 2;
    return { x, y: near ? H / 2 + 0.55 + i * g : H / 2 - 0.55 - C - i * g };
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

// When `value` last changed in a live game this page was already showing:
// 0 when it came with the game. Checkers slide and dice are tossed only for
// a play seen happen, not when the game arrives, the board turns to the
// viewer's side as they sit, or the screen resizes.
function useChangedAt(value, live) {
  const seen = useRef(null);
  const s = seen.current;
  if (!live) seen.current = null;
  else if (!s) seen.current = { value, at: 0 };
  else if (s.value !== value) seen.current = { value, at: Date.now() };
  return seen.current?.at ?? 0;
}

// as long as a checker takes to slide (backgammon.css); dice put up
// longer ago than that, shown again or already there, aren't tossed
const SLIDE_MS = 400;

// a die's pips, by row and column of three
const PIPS = {
  1: ["2/2"],
  2: ["1/1", "3/3"],
  3: ["1/1", "2/2", "3/3"],
  4: ["1/1", "1/3", "3/1", "3/3"],
  5: ["1/1", "1/3", "2/2", "3/1", "3/3"],
  6: ["1/1", "2/1", "3/1", "1/3", "2/3", "3/3"],
};

// A die is a cube: its faces where they are on a real one (opposite sides
// add up to 7), and the turn, about x and y, that shows each to the front
const FACES = {
  1: "",
  2: "rotateY(90deg)",
  3: "rotateX(90deg)",
  4: "rotateX(-90deg)",
  5: "rotateY(-90deg)",
  6: "rotateY(180deg)",
};
const SHOWN = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [0, 180],
};

// Where a roll's dice come to rest, as the one who threw them sits: in
// their right half of the board (the rule), on the strip between the rows
// where no checker goes, apart, each turned its own way
const DIE_GAP = 1.1;
function landing(count) {
  const room = 6 - 1.2 - (count - 1) * DIE_GAP;
  const xs = Array.from({ length: count }, () => Math.random() * room);
  const spots = xs
    .sort((a, b) => a - b)
    .map((x, i) => ({
      x: colX(6) + 0.6 + x + i * DIE_GAP,
      y: H / 2 + (Math.random() - 0.5) * 0.4,
      yaw: Math.random() * 90 - 45,
    }));
  // the first die isn't always the one on the left
  return Math.random() < 0.5 ? spots : spots.reverse();
}

// Thrown into the case once a roll, from the thrower's side (`from`: 1 the
// viewer's, -1 the other's): it flies in from a height, bounces on the felt
// as it tumbles and comes to rest at x, y on `n`, every throw its own way
// (backgammon.css), its shadow under it on the felt. Dice already up when
// the page opens are `still`.
function Die({ n, used, from, still, x, y, yaw }) {
  const [toss] = useState(() => {
    if (still) return null;
    const r = (a, b) => a + Math.random() * (b - a);
    // where it comes from, relative to where it stops: the thrower's side
    const fx = r(-2.4, 2.4);
    const fy = from * r(2.8, 5.2);
    // It tumbles the way it goes, over its leading edge: about the axis
    // across its path, (-fy, fx) turned a quarter, by one to three turns
    // (rotate3d, backgammon.css), twisting a little as it goes
    const go = Math.hypot(fx, fy);
    return {
      "--ax": fy / go,
      "--ay": -fx / go,
      "--roll0": `${-360 * r(1, 3)}deg`,
      "--rz0": `${yaw + r(-40, 40)}deg`,
      "--fx": fx,
      "--fy": fy,
      "--h0": r(4, 7),
      "--b1": r(0.8, 2),
      // under 0.5 it hardly leaves the felt again: one bounce, not two
      "--b2": r(0.4, 0.9),
      "--ease": r(0.05, 0.3),
      "--dur": `${Math.round(r(750, 1350))}ms`,
      "--delay": `${Math.round(r(0, 180))}ms`,
    };
  });
  return (
    <span
      className={`bg-die${used ? " used" : ""}${toss ? "" : " still"}`}
      data-n={n}
      style={{
        ...toss,
        "--x": x,
        "--y": y,
        "--rx": `${SHOWN[n][0]}deg`,
        "--ry": `${SHOWN[n][1]}deg`,
        "--rz": `${yaw}deg`,
      }}
    >
      <span className="shadow" />
      <span className="hop">
        <span className="cube">
          {Object.entries(FACES).map(([face, turn]) => (
            <span
              key={face}
              className="face"
              style={{ transform: `${turn} translateZ(calc(var(--p) * 0.4))` }}
            >
              {PIPS[face].map((at) => (
                <i key={at} style={{ gridArea: at }} />
              ))}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

// the roll, the dice played faded: tossed once, then they stay where they
// came to rest till the next roll (keyed by it, Board)
function Dice({ state, viewer, still }) {
  const { dice, left } = state;
  const all = dice[0] === dice[1] ? [...dice, ...dice] : dice;
  const [spots] = useState(() => landing(all.length));
  // the other's throw lands in their right half: the viewer's left
  const near = state.by === viewer;
  const unused = [...left];
  return all.map((n, i) => {
    const at = unused.indexOf(n);
    if (at >= 0) unused.splice(at, 1);
    const { x, y, yaw } = spots[i];
    return (
      <Die
        key={i}
        n={n}
        used={at < 0}
        from={near ? 1 : -1}
        still={still}
        x={near ? x : 2 * MIDDLE - x}
        y={near ? y : H - y}
        yaw={yaw}
      />
    );
  });
}

// how a dragged checker follows the pointer before it counts as a drag
const SLOP = 6;

// `mine`: the seats this page plays, both on one device, the one to move
// playing
export default function Board({ state, live, mine, viewer, names, note, act }) {
  const me = mine.includes(state.turn) ? state.turn : mine[0];
  const [picked, setPicked] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragged = useRef(false);
  const scene = useRef();
  const stacks = useCheckerStacks(state.checkers);
  const movedAt = useChangedAt(state.checkers, live);
  const sliding = Date.now() - movedAt < SLIDE_MS;
  // drawn again once it's slid, without the transition
  const [, slid] = useState(0);
  useEffect(() => {
    if (!sliding) return;
    const done = setTimeout(
      () => slid(movedAt),
      movedAt + SLIDE_MS - Date.now(),
    );
    return () => clearTimeout(done);
  }, [sliding, movedAt]);
  const rolledAt = useChangedAt(state.rolled, live);
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
      const { left, top } = scene.current.getBoundingClientRect();
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
      const dest = at && own(Number(at.dataset.pos));
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
  // a point as the viewer counts it (data-pos), as the one to move does:
  // the other way round when one device plays both sides
  const own = (pos) =>
    me === viewer || pos === BAR || pos === OFF ? pos : 25 - pos;
  const hit = (pos) => ({
    "data-pos": pos,
    onPointerDown: (e) => down(e, own(pos)),
    onClick: () => click(own(pos)),
  });

  const points = [];
  for (let n = 1; n <= 24; n++) {
    const { col, top } = spot(viewer, viewer, n);
    const dark = (col + (top ? 0 : 1)) % 2;
    points.push(
      <div
        key={n}
        className={`bg-point${top ? " top" : ""}${dark ? " dark" : ""}${to.has(own(n)) ? " target" : ""}`}
        style={{ "--x": colX(col), "--y": top ? FRAME : H - FRAME - POINT_H }}
        {...hit(n)}
      >
        <div className="bg-spike" />
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

  // Roll in the middle; the dice in the thrower's right half, and a word
  // and Undo in the other: the right one when the far player threw
  const rolled = state.dice.length > 0;
  const freeRight = rolled && state.by !== viewer;
  const canRoll =
    me !== undefined &&
    state.turn === me &&
    !state.left.length &&
    !state.winner;
  // the one who rolled takes back, the turn passed or not
  const canUndo =
    mine.includes(state.by) && state.undo.length > 0 && !state.winner;
  const passed =
    state.last.kind === "roll" && state.turn !== state.by && rolled;
  const name = (seat) => names[seat];

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

  // the board is a case seen from above (CSS); the dice fly in the air
  // over it, and a dragged checker follows the pointer over both
  return (
    <div
      ref={scene}
      className="bg-scene"
      style={{ "--board-w": W, "--board-h": H }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`bg-board${sliding ? " sliding" : ""}`}>
        <div className="bg-tray" style={{ "--x": FRAME, ...inside(TRAY_W) }} />
        <div className="bg-field" style={{ "--x": FIELD_X, ...inside(6) }} />
        <div className="bg-field" style={{ "--x": colX(6), ...inside(6) }} />
        <div
          className="bg-bar"
          style={{ "--x": BAR_X, "--y": 0, "--w": BAR_W, "--h": H }}
          {...hit(BAR)}
        />
        <div
          className={`bg-tray${to.has(OFF) ? " target" : ""}`}
          style={{ "--x": TRAY_X, ...inside(TRAY_W) }}
          {...hit(OFF)}
        />
        {points}
        {pieces}
        {marks}
        {status && (
          <span
            className="bg-status"
            style={{
              "--x": freeRight ? colX(6) + 6 - 0.2 - 3.3 : FIELD_X + 0.2,
              "--y": FRAME + POINT_H,
            }}
          >
            {status}
          </span>
        )}
        {canUndo && (
          <button
            className="bg-undo"
            style={{ "--x": MIDDLE + (freeRight ? 2.6 : -2.6), "--y": H / 2 }}
            aria-label={t("Undo")}
            title={t("Undo")}
            onClick={() => {
              act(undo(state, state.by));
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
        {canRoll && (
          <button
            className="bg-roll"
            style={{ "--x": MIDDLE, "--y": H / 2 }}
            onClick={() => act(rollFor(state, me))}
          >
            {t("Roll")}
          </button>
        )}
      </div>
      <div className="bg-air">
        {rolled && (
          <Dice
            key={state.rolled}
            state={state}
            viewer={viewer}
            still={Date.now() - rolledAt > SLIDE_MS}
          />
        )}
      </div>
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
