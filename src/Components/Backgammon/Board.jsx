import { useEffect, useMemo, useRef, useState } from "react";
import useSound from "use-sound";
import { useVolume } from "../../hooks/useStore";
import {
  BAR,
  OFF,
  apply,
  move,
  roll,
  sources,
  targets,
  best,
  forced,
  undo,
  whyNot,
} from "./rules";
import { t } from "../../i18n";
import { useKey } from "../../hooks/useKey";
import { Undo, tell as told, useChangedAt, useHeard, useTok } from "../Table";
import diceSound from "./assets/dice.mp3";

// The board as the viewer sits at it: their home bottom right, their
// checkers coming round from top right, the borne-off tray on the right,
// a case's other side compartment on the left; or all of it the other way
// round, home bottom left, for those who play so (`left`, the ⋯ menu). The
// dice land on the right either way. Everything is placed in
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
// point n: their 1 bottom right, 12 bottom left, 13 top left, 24 top right,
// or the other way round with their home on the `left`
function spot({ viewer, left }, seat, n) {
  const v = seat === viewer ? n : 25 - n;
  const col = v <= 12 ? 12 - v : v - 13;
  return { col: left ? 11 - col : col, top: v > 12 };
}
// where the borne-off checkers go, and the other side's compartment
const trayX = ({ left }) => (left ? FRAME : TRAY_X);
const spareX = ({ left }) => (left ? TRAY_X : FRAME);
const colX = (col) => FIELD_X + col + (col >= 6 ? BAR_W : 0);
const MIDDLE = BAR_X + BAR_W / 2;

// a compartment of the case, `w` wide, inside its frame
const inside = (w) => ({ "--y": FRAME, "--w": w, "--h": H - FRAME * 2 });

// a stack of more than five closes up to fit the point
const gap = (count) => (count > 5 ? (POINT_H - C) / (count - 1) : STEP);

// the top left of the i-th checker of `count` on a seat's `pos`
function place(view, seat, pos, i, count) {
  const near = seat === view.viewer;
  if (pos === OFF) {
    const x = trayX(view) + (TRAY_W - 1) / 2;
    return { x, y: near ? H - FRAME - FLAT * (i + 1) : FRAME + FLAT * i };
  }
  const g = gap(count);
  // out from the middle, each on its own side of it
  if (pos === BAR) {
    const x = BAR_X + (BAR_W - C) / 2;
    return { x, y: near ? H / 2 + 0.55 + i * g : H / 2 - 0.55 - C - i * g };
  }
  const { col, top } = spot(view, seat, pos);
  const x = colX(col) + (1 - C) / 2;
  return { x, y: top ? FRAME + i * g : H - FRAME - C - i * g };
}

// Each checker keeps who it is from one state to the next, so it slides
// from where it was to where it's gone (a CSS transition): the ones that
// left a point are matched to the points that gained one, nearest first.
// `moved`: the ones that did, each as `${seat}-${id}`.
function useCheckerStacks(checkers) {
  const ref = useRef(null);
  const prev = ref.current;
  if (prev?.checkers === checkers) return prev;
  const moved = new Set();
  const stacks = checkers.map((counts, seat) => {
    let next = 0;
    if (!prev)
      return counts.map((n) => Array.from({ length: n }, () => next++));
    const s = prev.stacks[seat].map((ids) => [...ids]);
    const loose = [];
    s.forEach((ids, pos) => {
      while (ids.length > counts[pos]) loose.push({ id: ids.pop(), pos });
    });
    for (const { id } of loose) moved.add(`${seat}-${id}`);
    for (let pos = BAR; pos >= OFF; pos--) {
      while (s[pos].length < counts[pos]) {
        loose.sort((a, b) => Math.abs(a.pos - pos) - Math.abs(b.pos - pos));
        s[pos].push(loose.shift().id);
      }
    }
    return s;
  });
  ref.current = { checkers, stacks, moved };
  return ref.current;
}

// as long as a checker takes to slide (backgammon.css); dice put up
// longer ago than that, shown again or already there, aren't tossed
const SLIDE_MS = 400;
// from one point a checker stops on to the next: a slide and a rest
export const STOP_MS = SLIDE_MS + 150;

// A checker moved by more than one die (3-2 to 5) stops on each point on
// its way: the board after each step but the last, STOP_MS apiece, then as
// it is (`checkers`), till `end`, when the last slide is done. Only for a
// move seen happen, from the board shown before it: one that came with
// others at once just slides there, as one put down by hand on this page
// (`dropped`, its n) does. `count`: the stops this move makes.
function useStops(state, live, dropped) {
  const seen = useRef(null);
  const s = seen.current;
  if (!live || !s) {
    seen.current = { n: state.last.n, from: state.checkers, stops: [], at: 0 };
  } else if (s.n !== state.last.n) {
    const stops = [];
    // (a move from an older build has no steps: it slides straight there)
    const steps = state.last.kind === "move" ? (state.last.steps ?? []) : [];
    for (const step of steps) {
      stops.push(apply(stops.at(-1) ?? s.from, state.by, step));
    }
    const end = stops.pop();
    const fits =
      state.last.n !== dropped &&
      JSON.stringify(end) === JSON.stringify(state.checkers);
    seen.current = {
      n: state.last.n,
      from: state.checkers,
      stops: fits ? stops : [],
      at: Date.now(),
    };
  }
  const { stops, at } = seen.current;
  const k = Math.floor((Date.now() - at) / STOP_MS);
  return {
    count: stops.length,
    checkers: k < stops.length ? stops[k] : state.checkers,
    // when the board changes next: the next stop, or the last slide done
    next: k < stops.length ? at + (k + 1) * STOP_MS : Infinity,
    end: at + stops.length * STOP_MS + SLIDE_MS,
  };
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

// A die's throw, from the thrower's side (`from`: 1 the viewer's, -1 the
// other's): it flies in from a height, bounces on the felt as it tumbles
// and comes to rest on `n`, every throw its own way (backgammon.css).
// `lands`: when it first hits the felt, in ms.
function toss(yaw, from) {
  const r = (a, b) => a + Math.random() * (b - a);
  // where it comes from, relative to where it stops: the thrower's side
  const fx = r(-2.4, 2.4);
  const fy = from * r(2.8, 5.2);
  // It tumbles the way it goes, over its leading edge: about the axis
  // across its path, (-fy, fx) turned a quarter, by one to three turns
  // (rotate3d, backgammon.css), twisting a little as it goes
  const go = Math.hypot(fx, fy);
  const dur = r(750, 1350);
  const delay = r(0, 180);
  return {
    // the first fall takes 45% of it (bg-hop)
    lands: delay + 0.45 * dur,
    style: {
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
      "--dur": `${Math.round(dur)}ms`,
      "--delay": `${Math.round(delay)}ms`,
    },
  };
}

// a die at x, y on `n`, turned `yaw`, its shadow under it on the felt:
// thrown in (`toss`), or lying still, up already when the page opened;
// lit when it's `ready` to be picked up and thrown again
function Die({ n, used, toss, x, y, yaw, ready }) {
  return (
    <span
      className={`bg-die${used ? " used" : ""}${toss ? "" : " still"}${ready ? " ready" : ""}`}
      data-n={n}
      style={{
        ...toss?.style,
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

// The roll, the dice played faded: thrown once, heard as the first of them
// hits the felt (`onLand`), then they stay where they came to rest till
// the next roll (keyed by it, Board). The next to roll picks them up
// where they lie, and so does whoever starts the next game: a tap on
// them, `onThrow` (`label`, its key `cap`), lit till then.
function Dice({ state, viewer, still, onLand, onThrow, label, cap }) {
  const { dice, left } = state;
  const all = dice[0] === dice[1] ? [...dice, ...dice] : dice;
  const [spots] = useState(() => landing(all.length));
  // the other's throw lands in their right half: the viewer's left
  const near = state.by === viewer;
  const [throws] = useState(() =>
    still ? null : spots.map(({ yaw }) => toss(yaw, near ? 1 : -1)),
  );
  const land = useRef(onLand);
  land.current = onLand;
  useEffect(() => {
    if (!throws) return;
    const first = Math.min(...throws.map((t) => t.lands));
    const heard = setTimeout(() => land.current(), first);
    return () => clearTimeout(heard);
  }, [throws]);
  const unused = [...left];
  const shown = all.map((n, i) => {
    const at = unused.indexOf(n);
    if (at >= 0) unused.splice(at, 1);
    const { x, y, yaw } = spots[i];
    return {
      n,
      used: at < 0,
      x: near ? x : 2 * MIDDLE - x,
      y: near ? y : H - y,
      yaw,
    };
  });
  // round the dice, room for a finger
  const xs = shown.map((d) => d.x);
  const ys = shown.map((d) => d.y);
  const [x0, y0] = [Math.min(...xs) - 0.7, Math.min(...ys) - 0.7];
  return (
    <>
      {shown.map((d, i) => (
        <Die key={i} {...d} toss={throws?.[i]} ready={!!onThrow} />
      ))}
      {onThrow && (
        <button
          className="bg-throw"
          style={{
            "--x": x0,
            "--y": y0,
            "--w": Math.max(...xs) + 0.7 - x0,
            "--h": Math.max(...ys) + 0.7 - y0,
          }}
          aria-label={label}
          title={label}
          onClick={onThrow}
        >
          <kbd>{cap}</kbd>
        </button>
      )}
    </>
  );
}

// ten throws of two dice on a board (OpenGameArt, CC0), each from its first
// hit: where each starts in dice.mp3, and how long it lasts, in ms
const THROWS = {
  0: [0, 1033],
  1: [1500, 1062],
  2: [3000, 732],
  3: [4500, 967],
  4: [6000, 1116],
  5: [7500, 971],
  6: [9000, 850],
  7: [10500, 1098],
  8: [12000, 1091],
  9: [13500, 959],
};

// how a dragged checker follows the pointer before it counts as a drag
const SLOP = 6;
// two taps on a checker this close together move it
const TWICE_MS = 400;
// a forced move waits for the dice to land (they tumble for up to 1.5 s)
const FORCED_MS = 1800;

// `mine`: the seats this page plays, both on one device, the one to move
// playing. `across`: the two playing on it sit face to face, the board
// between them: what's one's to read is turned to them (`over`). `deal`:
// the next game, once one's won, for those seated.
export default function Board({
  state,
  live,
  mine,
  viewer,
  across,
  left,
  names,
  note,
  act,
  deal,
}) {
  const me = mine.includes(state.turn) ? state.turn : mine[0];
  const view = { viewer, left };
  const away = (seat) => across && seat !== viewer;
  const over = (seat) => (away(seat) ? " over" : "");
  const tell = (why) => told(why, away(me));
  // one of the throws, at this device's sound level, as the dice land
  const { volume } = useVolume();
  const [rattle] = useSound(diceSound, {
    volume: 0.5 * volume,
    sprite: THROWS,
  });
  const thrown = () => rattle({ id: String(Math.floor(Math.random() * 10)) });
  const [picked, setPicked] = useState(null);
  const [drag, setDrag] = useState(null);
  const dragged = useRef(false);
  const tapped = useRef({});
  const scene = useRef();
  // the move this page put down by hand: it goes where it's dropped
  const dropped = useRef(null);
  const stops = useStops(state, live, dropped.current);
  // Everyone hears a checker land: a wooden tok as it comes down (the
  // slide, backgammon.css), on each point it stops on, each a little
  // different. The dice are heard as they land (Dice). The table's sound
  // level is tried out by the page (index.jsx).
  const tak = useTok();
  useHeard(
    state.last,
    ({ kind }) => {
      if (kind !== "move" && kind !== "undo") return;
      const lands = kind === "move" ? stops.count + 1 : 1;
      for (let i = 0; i < lands; i++) setTimeout(tak, 330 + i * STOP_MS);
    },
    () => {},
  );
  const { stacks, moved } = useCheckerStacks(stops.checkers);
  const movedAt = useChangedAt(state.checkers, live);
  const still = Math.max(movedAt + SLIDE_MS, stops.end);
  const sliding = Date.now() < still;
  // drawn again at each stop, and once it's slid, without the transition
  const wake = sliding ? Math.min(stops.next, still) : null;
  const [, woke] = useState(0);
  useEffect(() => {
    if (!wake) return;
    const timer = setTimeout(() => woke(wake), wake - Date.now());
    return () => clearTimeout(timer);
  }, [wake]);
  const rolledAt = useChangedAt(state.rolled, live);
  const playing = me !== undefined && state.turn === me && state.left.length;
  const from = playing ? sources(state) : [];
  // the only checker that can move (from the bar, often) is picked already
  const sel = playing
    ? ((picked !== null && from.includes(picked) ? picked : null) ??
      (from.length === 1 ? from[0] : null))
    : null;
  const to = sel === null ? new Map() : targets(state, sel);
  // nothing to choose from the roll on: the dice play themselves, a step
  // at a time, once they've landed. Not what's left after a move the
  // player chose (the turn would pass, and Undo with it, before they'd
  // looked), nor after an undo, which leaves it to the player
  const [first] = state.undo;
  const atRoll = useMemo(
    () => (first ? { ...state, ...first } : state),
    // as rolled: the state itself till a move's made, then its first undo
    [first ?? state], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const step =
    playing && state.last.kind !== "undo" && forced(atRoll) && forced(state);
  useEffect(() => {
    if (!step) return;
    const timer = setTimeout(
      () => act(move(state, me, step.from, step.to)),
      state.last.kind === "roll" ? FORCED_MS : STOP_MS + SLIDE_MS,
    );
    return () => clearTimeout(timer);
  }, [state.last.n, !!step]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (pos) => {
    if (!playing) return;
    // two quick taps on a checker: the game moves it (`best`)
    const twice =
      tapped.current.pos === pos && Date.now() < tapped.current.till;
    tapped.current = { pos, till: Date.now() + TWICE_MS };
    if (twice && from.includes(pos)) {
      tapped.current = {};
      act(move(state, me, pos, best(state, pos)));
      setPicked(null);
    } else if (sel !== null && to.has(pos)) {
      // not the first of two taps on the checker it just put there
      tapped.current = {};
      act(move(state, me, sel, pos));
      setPicked(null);
    } else if (pos !== sel && from.includes(pos)) {
      setPicked(pos);
    } else {
      const why =
        (sel !== null && pos !== sel && whyNot(state, sel, pos)) ||
        (state.checkers[me][pos] && whyNot(state, pos));
      if (why) tell(why);
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
      if (steps) {
        dropped.current = state.last.n + 1;
        act(move(state, me, pos, dest));
      } else if (at && dest !== pos) {
        const why = whyNot(state, pos, dest);
        if (why) tell(why);
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
    const { col, top } = spot(view, viewer, n);
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

  // the other's turn, as it's played and till the next roll: the checkers
  // that came lit, a ring where they left from (from where the turn began,
  // the first `undo`, to the checkers shown)
  const began = !mine.includes(state.by) && state.undo[0]?.checkers[state.by];
  const shown = stops.checkers[state.by];
  const was = began
    ? shown.flatMap((n, pos) => {
        if (n >= began[pos]) return [];
        const { x, y } = place(view, state.by, pos, n, began[pos]);
        return [
          <span
            key={`was-${pos}`}
            className="bg-was"
            style={{ "--x": x, "--y": y }}
          />,
        ];
      })
    : [];

  const pieces = [];
  stacks.forEach((seatStacks, seat) =>
    seatStacks.forEach((ids, pos) =>
      ids.forEach((id, i) => {
        const { x, y } = place(view, seat, pos, i, ids.length);
        const top = i === ids.length - 1;
        const mine = seat === me;
        const came = began && seat === state.by ? shown[pos] - began[pos] : 0;
        const cls = [
          "bg-checker",
          seat ? "black" : "white",
          pos === OFF && "off",
          mine && top && pos === sel && "picked",
          mine && top && sel === null && from.includes(pos) && "movable",
          drag && mine && top && pos === drag.pos && "lifted",
          i >= ids.length - came && "came",
        ];
        pieces.push(
          <div
            key={`${seat}-${id}`}
            className={cls.filter(Boolean).join(" ")}
            style={{
              "--x": x,
              "--y": y,
              // over the ones standing while it slides
              zIndex: sliding && moved.has(`${seat}-${id}`) ? 20 : i + 1,
            }}
          />,
        );
      }),
    ),
  );
  // In the same order every time, so none is moved in the page: a moved
  // element doesn't slide (its transition never starts), it jumps. The
  // stack's own order, which lies on which, is the z-index, the board's
  // own (backgammon.css).
  pieces.sort((a, b) => a.key.localeCompare(b.key));

  // where the picked checker can go, each with what it takes: 2, 3 or 5
  const marks = [...to].map(([pos, steps]) => {
    const pips = steps.reduce((sum, s) => sum + s.die, 0);
    if (pos === OFF) {
      return (
        <span
          key="off"
          className={`bg-mark off${over(me)}`}
          style={{ "--x": trayX(view), "--y": H / 2 + MID / 2 }}
        >
          {pips}
        </span>
      );
    }
    const count = state.checkers[me][pos];
    // on top of the stack, closed up as it will be (over a blot it hits)
    const { x, y } = place(view, me, pos, count, count + 1);
    return (
      <span
        key={pos}
        className={`bg-mark${over(me)}`}
        style={{ "--x": x, "--y": y }}
      >
        {pips}
      </span>
    );
  });

  // the dice in the thrower's right half, a word and Undo in the other:
  // the right one when the far player threw
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
  const won = state.winner;
  // the dice: Space throws them, N, once it's won, starts the next game
  const onThrow =
    rolled && (canRoll ? () => act(rollFor(state, me)) : won ? deal : null);
  useKey(" ", !won && onThrow);
  useKey("n", won && onThrow);
  // who won: the half's width, to be read at a glance
  const statusW = won || across ? 5.6 : 3.3;

  // a word in the middle of the board: `note` before a game, then who won,
  // who starts, who couldn't move, whose roll it is
  const status =
    note ??
    (won ? (
      <>
        {t(`${name(won.seat)} wins!`)}
        {won.points === 2 && (
          // one line each, face to face: the score says it's 2
          <span className="mars">{t(across ? "Mars!" : "Mars! 2 points")}</span>
        )}
      </>
    ) : state.opening && !state.undo.length ? (
      t(`${name(state.turn)} starts`)
    ) : passed ? (
      t(`${name(state.by)}: no moves`)
    ) : !state.winner && state.turn !== me && !state.left.length ? (
      t(`Waiting for ${name(state.turn)}`)
    ) : null);

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
        <div
          className="bg-tray"
          style={{ "--x": spareX(view), ...inside(TRAY_W) }}
        />
        <div className="bg-field" style={{ "--x": FIELD_X, ...inside(6) }} />
        <div className="bg-field" style={{ "--x": colX(6), ...inside(6) }} />
        <div
          className="bg-bar"
          style={{ "--x": BAR_X, "--y": 0, "--w": BAR_W, "--h": H }}
          {...hit(BAR)}
        />
        <div
          className={`bg-tray${to.has(OFF) ? " target" : ""}`}
          style={{ "--x": trayX(view), ...inside(TRAY_W) }}
          {...hit(OFF)}
        />
        {points}
        {was}
        {pieces}
        {marks}
        {status && (
          <span
            className={`bg-status${won ? " won" : ""}${across ? " pair" : ""}`}
            style={{
              "--x": freeRight ? colX(6) + 6 - 0.2 - statusW : FIELD_X + 0.2,
              "--y": FRAME + POINT_H,
              "--w": statusW,
            }}
          >
            {/* face to face: a copy turned to each */}
            {across && <span className="over">{status}</span>}
            <span>{status}</span>
          </span>
        )}
        {canUndo && (
          <Undo
            className={`bg-undo${over(state.by)}`}
            style={{ "--x": MIDDLE + (freeRight ? 2.6 : -2.6), "--y": H / 2 }}
            onClick={() => {
              act(undo(state, state.by));
              setPicked(null);
            }}
          />
        )}
      </div>
      <div className="bg-air">
        {rolled && (
          <Dice
            key={state.rolled}
            state={state}
            viewer={viewer}
            still={Date.now() - rolledAt > SLIDE_MS}
            onLand={thrown}
            onThrow={onThrow}
            label={t(won ? "Next game" : "Roll")}
            cap={won ? "N" : t("Space")}
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
