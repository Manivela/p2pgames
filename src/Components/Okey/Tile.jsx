import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import "./tile.css";
import { useContext, useEffect, useRef, useState } from "react";
import { OkeyContext } from "./OkeyContext";
import { isOkey } from "./melds";
import { symbols } from "./constants";
import { ended } from "./game";

// HTML5 drag and drop only follows a mouse; touch screens get the touch
// backend (index.jsx), which also takes the mouse on touch laptops
export const touch = navigator.maxTouchPoints > 0;
// how far a finger can wander and still be holding a tile; past it, a drag
export const SLOP = 8;

// the colour comes from the id (red7-0), as a class: the hex in the tile
// is part of the game state and stays as it is
const colorOf = (tile) => tile.id.match(/^[a-z]+/)[0];

// a tile's face: its number, and its colour's symbol under it
function Face({ tile }) {
  return (
    <>
      <span className="rank">{tile.rank}</span>
      {tile.rank !== "👌" && (
        <span className="sym">{symbols[colorOf(tile)]}</span>
      )}
    </>
  );
}

// a picture of a tile, face up, from its id (red7-0): nothing to drag or
// flip, and no data-tile-id for the animations (moves.js) to fly to
export function TileFace({ id }) {
  const tile = { id, rank: id.replace(/^[a-z]+|-\d+$/g, "") };
  return (
    <span className={`tile c-${colorOf(tile)}`}>
      <Face tile={tile} />
    </span>
  );
}

// Once the round is over, how it finished: the finisher's last turn
// (turnMoves, game.js), numbered as the table marks its tiles; a run of the
// same move (adding three tiles) is one
export function lastTurn(state) {
  if (!ended(state)) return [];
  const moves = [];
  for (const m of state.turnMoves ?? []) {
    const last = moves.at(-1);
    if (last?.move === m.move && last.by === m.by) {
      last.tiles = [...last.tiles, ...m.tiles];
    } else moves.push({ ...m });
  }
  return moves;
}

// the number of the move that moved the tile, or null
export const markOf = (moves, id) =>
  (id && moves.findIndex((m) => m.tiles.includes(id)) + 1) || null;

function Tile({ tile, disabled, className, style, numbered = true }) {
  const { me, toggleHidden, okeyState, selected, toggleSelected } =
    useContext(OkeyContext);
  const myTile = me && tile.source === `hand-${me}`;
  const canSee = tile.source.includes("hand-") ? myTile : true;
  // an okey laid on the table lies face down; a thrown one stays face up
  const okeyDown =
    tile.source === "table" &&
    okeyState.okeyTile &&
    isOkey(tile, okeyState.okeyTile);
  // a face-down tile keeps its colour out of the page too, or inspecting the
  // draw pile would show the next tile's
  const faceUp = (canSee || ended(okeyState)) && !tile.hidden && !okeyDown;
  // your tiles flip only while the round is played: once it's over, the
  // hands are shown as they ended
  const canFlip = myTile && okeyState.gameState === "play";
  function handleClick(e) {
    e.preventDefault();
    // Android long-presses fire contextmenu too; touch has its own hold below
    const { pointerType } = e.nativeEvent;
    const touch = pointerType
      ? pointerType === "touch"
      : navigator.maxTouchPoints > 0;
    if (!canFlip || touch) return;
    toggleHidden(tile);
  }
  // phones have no right click: hold your tile still and let go to flip it.
  // Held long enough, it wiggles; a finger that moves drags it instead.
  const hold = useRef();
  const from = useRef(null);
  const held = useRef(false);
  const [armed, setArmed] = useState(false);
  function startHold(e) {
    if (!canFlip) return;
    held.current = false;
    const { clientX, clientY } = e.touches[0];
    from.current = { x: clientX, y: clientY };
    hold.current = setTimeout(() => {
      setArmed(true);
      navigator.vibrate?.(15);
    }, 700);
  }
  function stopHold() {
    clearTimeout(hold.current);
    from.current = null;
    setArmed(false);
  }
  function moveHold(e) {
    const { clientX, clientY } = e.touches[0];
    const { x, y } = from.current ?? {};
    if (Math.hypot(clientX - x, clientY - y) > SLOP) stopHold();
  }
  function endHold() {
    if (armed) {
      held.current = true;
      toggleHidden(tile);
    }
    stopHold();
  }
  const [{ opacity }, dragRef, preview] = useDrag(
    () => ({
      type: "TILE",
      item: { tile },
      canDrag: () => !disabled,
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.5 : 1,
      }),
    }),
    [tile, disabled],
  );
  // the mouse drags our own lifted tile (index.jsx) instead of the
  // browser's picture of it
  useEffect(() => {
    if (!touch) preview(getEmptyImage());
  }, [preview]);
  const mark = markOf(lastTurn(okeyState), tile.id);
  const classes = [
    "tile",
    faceUp ? `c-${colorOf(tile)}` : "back",
    className,
    myTile && selected.includes(tile.id) && "selected",
    armed && "armed",
    mark && "marked",
  ];
  return (
    <div
      ref={dragRef}
      data-tile-id={tile.id}
      data-mark={(numbered && mark) || undefined}
      className={classes.filter(Boolean).join(" ")}
      style={{ ...style, opacity }}
      onClick={() => {
        // a hold already flipped the tile; don't also select it
        if (held.current) held.current = false;
        else if (myTile) toggleSelected(tile);
      }}
      onContextMenu={handleClick}
      onTouchStart={startHold}
      onTouchMove={moveHold}
      onTouchEnd={endHold}
      onTouchCancel={endHold}
    >
      {faceUp && <Face tile={tile} />}
    </div>
  );
}

export default Tile;
