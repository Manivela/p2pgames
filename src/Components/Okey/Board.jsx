import { Fragment, useContext, useLayoutEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { OkeyContext } from "./OkeyContext";
import Rack, { DiscardPile, Seat } from "./Rack";
import Slot from "./Slot";
import Tile, { SLOP } from "./Tile";
import { LastTurn, Melds, RoundInfo, Scores } from "./AmericanoTable";
import "./rack.css";
import { t } from "../../i18n";
import TableMenu from "./TableMenu";
import { Lobby } from "./GameSettings";
import { useMoves } from "./moves";
import * as okey from "./okey";
import { ended, freeSlot, isElden, pileOut, rowOf, tableSeats } from "./okey";
import { useKeyHints } from "../../hooks/useStore";
import { useEscape, useKey } from "../../hooks/useKey";
import { useKnockTaps } from "../knock";
import { GlassDefs } from "./TeaGlass";
import ReadyCheck from "../ReadyCheck";

// The table is laid out in tile widths: --t, the width of a tile in your
// rack, is as big as the box allows for the rack and the piles beside it
// (`across`: a rack row and 3.8 more), for the seats along the top when
// they're wider (four others or more, up to seven, long names) and for
// the whole table (7.4 tiles down), up to 70px.
// It's set on the page, so the tiles that fly or are dragged (outside the
// table) and the site's corner buttons (index.css) match.
function useTileSize(across) {
  const ref = useRef(null);
  // measured every render, like usePileAside: someone sitting down or the
  // score sheet's button widens the top without resizing the box
  useLayoutEffect(() => {
    const fit = ref.current;
    const head = fit.querySelector(".head");
    const page = document.documentElement.style;
    // set from the observer only: sized in the effect itself as well, a
    // lobby button's text sat a hair off in the Docker screenshots
    const observer = new ResizeObserver(() => {
      // the top at its narrowest, in tiles (all of it is sized in --t): the
      // others along it and the board's padding (not the head's box: the
      // board widens to fit it)
      const t = parseFloat(page.getPropertyValue("--t"));
      const { paddingLeft, paddingRight } = getComputedStyle(
        head.parentElement,
      );
      const sides = parseFloat(paddingLeft) + parseFloat(paddingRight);
      const top = (head.firstElementChild.offsetWidth + sides) / t || 0;
      const width = fit.clientWidth / Math.max(across, top);
      // whole pixels, and never one more than now: measured at the size it
      // sets, a crowded top can call for a pixel more and then one less,
      // and the table would settle either way; more room grows it by two
      const size = Math.floor(Math.min(width, fit.clientHeight / 7.4, 70));
      // only when it changes: measured every render, not repainted
      if (size !== t && size !== t + 1) page.setProperty("--t", `${size}px`);
      // the site's menu and fullscreen buttons (index.css) go where the
      // table keeps them a place, at the size just set
      const room = fit.querySelector(".corner-room").getBoundingClientRect();
      page.setProperty("--corner-top", `${room.top}px`);
      page.setProperty("--corner-left", `${room.left}px`);
    });
    observer.observe(fit);
    return () => observer.disconnect();
  });
  useLayoutEffect(
    () => () => {
      const page = document.documentElement.style;
      for (const v of ["--t", "--corner-top", "--corner-left"]) {
        page.removeProperty(v);
      }
    },
    [],
  );
  return ref;
}

// The draw pile sits in the middle of a table with room for it and a
// couple of rows of melds (3.5 tiles tall: desktops and tablets, not
// phones), until what's on the table needs the room: the melds would have
// to shrink, or the invite doesn't fit beside it. Then it moves to the
// left, where phones keep it, until the next deal.
function usePileAside(deal) {
  const ref = useRef(null);
  const [small, setSmall] = useState(false);
  // the deal whose table filled up
  const [fullIn, setFullIn] = useState(null);
  const aside = small || fullIn === deal;
  useLayoutEffect(() => {
    const table = ref.current;
    const check = () => {
      const t = parseFloat(
        document.documentElement.style.getPropertyValue("--t"),
      );
      setSmall(table.clientHeight < 3.5 * t);
      if (aside) return;
      // the melds' scale (AmericanoTable.jsx), 1 while they fit as they are
      const fit = table
        .querySelector(".melds")
        ?.style.getPropertyValue("--fit");
      if (Number(fit || 1) < 1 || table.scrollHeight > table.clientHeight) {
        setFullIn(deal);
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(table);
    return () => observer.disconnect();
  });
  return [ref, aside];
}

// the draw pile as a stack, its count, and the indicator beside it
function DrawPile() {
  const {
    okeyState,
    me,
    nextDrawTile,
    finishGame,
    isMyTurn,
    drawTile,
    heldDraw,
    unhold,
    myHand,
  } = useContext(OkeyContext);
  // D draws, as dragging the top tile to your rack does, to the slot Take
  // uses; while that draw waits out the others' time to call, D takes it
  // back, as T does a take
  const slot = me ? freeSlot(myHand(me), rowOf(okeyState, me)) : -1;
  const draw =
    heldDraw?.tile.source === "draw-pile"
      ? unhold
      : me &&
        !heldDraw &&
        nextDrawTile &&
        slot >= 0 &&
        isMyTurn() &&
        !okeyState.drawn &&
        (() => drawTile(me, nextDrawTile, slot, true));
  useKey("d", draw);
  return (
    <div className="draw">
      <Slot
        className="stack"
        showBorder
        tile={nextDrawTile}
        type="DRAW"
        onDrop={finishGame}
      />
      {draw && <kbd>D</kbd>}
      <span className="count">{okeyState.drawPile.length}</span>
      {okeyState.okeyTile && (
        <Tile className="indicator" tile={okeyState.okeyTile} disabled />
      )}
      {/* the tile someone finished with */}
      {okeyState.finishTile && (
        <Tile className="thrown" tile={okeyState.finishTile} disabled />
      )}
    </div>
  );
}

// the next step: a game to start, a new pile once it runs out (classic),
// the next round, a new game once it's over (Reset, New Game mid-game and
// ending a game whose pile ran out live in the table menu)
function NextStep() {
  const {
    okeyState,
    me,
    together,
    check,
    act,
    selected,
    picking,
    startPicking,
    openHand,
    openAll,
    layMelds,
    unselectAll,
  } = useContext(OkeyContext);
  // Escape lets El aç go, as a tap on the felt does
  useEscape(picking && unselectAll);
  // a ready check (⋯): no next step till it's over, its Ready on the felt
  // (Board); the lobby's settings stay, its Start refused meanwhile
  if (check.open && okeyState.gameState !== "start") return null;
  switch (okeyState.gameState) {
    case "start":
      return <Lobby />;
    case "play": {
      // the pile ran out (reshuffle): before drawing, play on
      if (pileOut(okeyState, me)) {
        return (
          <button onClick={() => act(okey.shuffleDiscards, me)}>
            {t("Shuffle and play on")}
          </button>
        );
      }
      // El aç, all hand long: pressed once, it picks what it would lay down
      // (the opening, then the sets and runs on your rack; pairs only by
      // hand) and a tap on your rack picks a whole group; pressed again, it
      // lays the picked tiles or, none picked, the opening it finds
      const opened = okeyState.opened[me];
      const lay = opened ? layMelds : openHand;
      return (
        me &&
        !isElden(okeyState) && (
          <button
            aria-pressed={picking}
            onClick={
              !picking
                ? startPicking
                : selected.length || opened
                  ? lay
                  : openAll
            }
          >
            {t(
              !picking
                ? opened
                  ? "Lay melds"
                  : "Open your hand"
                : selected.length
                  ? "Open picked"
                  : opened
                    ? "Lay melds"
                    : "Find and open",
            )}
          </button>
        )
      );
    }
    // pressed by every player while the room waits for everyone (together)
    case "roundEnd":
    case "finish":
      return (
        together.press && (
          <button
            aria-pressed={together.waits ? together.pressed : undefined}
            onClick={together.press}
          >
            {t(okeyState.gameState === "finish" ? "New Game" : "Next Round")}
          </button>
        )
      );
    default:
      return null;
  }
}

// what's on the table: the melds (left as they are when the round ends),
// before a game a way to bring the others; and the draw pile, while it's
// in the middle
function OnTheTable({ pile }) {
  const { okeyState } = useContext(OkeyContext);
  if (okeyState.gameState === "start") {
    return (
      <>
        {pile}
        <button
          onClick={() =>
            navigator.clipboard
              ?.writeText(window.location.href)
              .then(() => toast.success(t("Copied!")))
              .catch(() => toast(t("Couldn't copy")))
          }
        >
          {t("Copy invite link")}
        </button>
      </>
    );
  }
  return (
    <>
      {pile}
      {okeyState.gameState !== "start" && <Melds underPile={!!pile} />}
    </>
  );
}

// One layout for every screen, only the size changes. Across the top: the
// site's buttons (index.css) and the game's at the two ends, the other
// players in seat order between them, each pile between the player who
// throws to it and the one who takes from it. The table: the draw pile in
// the middle or, once the table fills, on the left (usePileAside); where
// the round stands (once it's over, how it finished) and the next step on
// the right. Along the bottom: the pile you take from, your rack (every
// hand once the round ends), the pile you throw to.
// what a press on the table works instead of the felt under it
const CONTROLS =
  ".tile, button, input, label, a, details, select, textarea, .dialog-backdrop, .glass";

// Picking your tiles from anywhere on the table off the tiles and
// controls: a tap drops the pick and lets El aç go; a box drawn picks
// the tiles of your rack it touches instead (their slots: a tile lifts
// once picked, its slot stays put). One finger draws it; the browser
// doesn't pan under it (rack.css).
function useTablePick() {
  const { okeyState, me, myHand, select, unselectAll } =
    useContext(OkeyContext);
  const [box, setBox] = useState(null);
  const from = useRef(null);
  // where a tap would have to end: what it pressed, until a box is drawn
  const pressed = useRef(null);
  const hand = me && !ended(okeyState) ? myHand(me) : [];
  function onPointerDown(e) {
    pressed.current = e.target;
    const off = e.isPrimary && e.button === 0 && !e.target.closest(CONTROLS);
    from.current =
      off && hand.some(Boolean) ? { x: e.clientX, y: e.clientY } : null;
  }
  function onPointerMove(e) {
    const { clientX: x, clientY: y } = e;
    const start = from.current;
    if (!start || (!box && Math.hypot(x - start.x, y - start.y) <= SLOP)) {
      return;
    }
    // drawing: no tap, and the click at its end goes to the table, not
    // what's under it
    if (!box) {
      e.currentTarget.setPointerCapture(e.pointerId);
      pressed.current = null;
    }
    const [left, right] = [Math.min(start.x, x), Math.max(start.x, x)];
    const [top, bottom] = [Math.min(start.y, y), Math.max(start.y, y)];
    setBox({ left, top, width: right - left, height: bottom - top });
    const tiles = document.querySelectorAll(".rack .slot > .tile");
    select(
      [...tiles]
        .filter((el) => {
          const r = el.parentElement.getBoundingClientRect();
          return (
            r.left < right && r.right > left && r.top < bottom && r.bottom > top
          );
        })
        .map((el) => el.dataset.tileId)
        .filter((id) => hand.some((t) => t?.id === id)),
    );
  }
  function end() {
    from.current = null;
    pressed.current = null;
    setBox(null);
  }
  // let go where it was pressed, no box drawn: a tap. Not a click: Linux
  // Chrome (the e2e's) sent none after a finger tap on the felt.
  function onPointerUp(e) {
    const tap = e.target === pressed.current && !e.target.closest(CONTROLS);
    end();
    if (tap) unselectAll();
  }
  return [
    box && <div className="lasso" style={box} />,
    { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: end },
  ];
}

function Board() {
  const { okeyState, me, knock, check } = useContext(OkeyContext);
  // you first, then round the table: right, across, left
  const players = tableSeats(okeyState);
  const myIndex = players.findIndex((p) => p.id === me);
  const [mine, ...rest] =
    myIndex !== -1
      ? [...players.slice(myIndex), ...players.slice(0, myIndex)]
      : players;
  // left to right: the one before you first
  const others = rest.reverse();
  // your own rack's rows set the tiles' size (rowOf)
  const fit = useTileSize(rowOf(okeyState, me) + 3.8);
  const [table, pileAside] = usePileAside(okeyState.deal);
  useMoves();
  // on the felt, off anything to pick up or press, and the racks
  const onKnock = useKnockTaps(
    knock,
    (el) => !el.closest(`${CONTROLS}, .rack`),
  );
  const [lasso, pick] = useTablePick();
  const { hints } = useKeyHints();
  return (
    <div
      className="fit"
      ref={fit}
      data-rotate={t("Turn your phone sideways to play")}
      // where the site has a fullscreen button (root.jsx: not iPhone Safari)
      data-rotate-full={
        document.fullscreenEnabled
          ? t(
              "Turn your phone sideways to play, and go full screen for a better experience",
            )
          : undefined
      }
    >
      <div
        // the keys' keycaps hidden from the table menu
        className={hints ? "board" : "board no-keys"}
        {...pick}
        onPointerDown={(e) => {
          onKnock(e);
          pick.onPointerDown(e);
        }}
      >
        {lasso}
        <GlassDefs />
        {/* the others only: the buttons are in the corners beside your
            rack, so many players fit along the top */}
        <div className="head">
          <div className="others">
            {others.map((player, i) => (
              <Fragment key={player.id}>
                <Seat player={player.id} />
                {/* the next one along throws to this one */}
                {others[i + 1] && (
                  <DiscardPile player={others[i + 1].id} small />
                )}
              </Fragment>
            ))}
          </div>
        </div>
        <div className="middle">
          <div className="left">{pileAside && <DrawPile />}</div>
          <div className="center" ref={table} data-middle="">
            <OnTheTable pile={!pileAside && <DrawPile />} />
            {/* a ready check (⋯): on the felt, clear of your rack */}
            <ReadyCheck
              check={check}
              name={(id) => {
                const p = okeyState.players.find((p) => p.id === id);
                return p?.user?.name ?? p?.awayName;
              }}
            />
          </div>
          <div className="side">
            <RoundInfo />
            <LastTurn />
            <NextStep />
          </div>
        </div>
        <div className="foot">
          {others[0] && <DiscardPile player={others[0].id} />}
          {/* the site's menu and fullscreen buttons sit here (index.css),
              in the corner left of your rack */}
          <div className="corner-room" />
          <Rack player={mine.id} hands={[mine, ...others].map((p) => p.id)} />
          <DiscardPile player={mine.id} />
          {/* under your pile, a thumb away on a phone */}
          <div className="controls">
            {okeyState.gameState !== "start" && <Scores />}
            <TableMenu />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Board;
