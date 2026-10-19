import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import "./tile.css";
import { useContext, useEffect, useRef } from "react";
import { OkeyContext } from "./OkeyContext";
import { isOkey } from "./melds";
import { symbols } from "./constants";

// HTML5 drag and drop only follows a mouse; touch screens get the touch
// backend (index.jsx), which also takes the mouse on touch laptops
export const touch = navigator.maxTouchPoints > 0;

function Tile({ tile, disabled, className, style }) {
  const { me, toggleHidden, okeyState, selected, toggleSelected } =
    useContext(OkeyContext);
  const myTile = me && tile.source === `hand-${me}`;
  const canSee = tile.source.includes("hand-") ? myTile : true;
  // a thrown okey lies face down
  const thrownOkey =
    /^(discard|claim)-/.test(tile.source) &&
    okeyState.okeyTile &&
    isOkey(tile, okeyState.okeyTile);
  // a face-down tile keeps its colour out of the page too, or inspecting the
  // draw pile would show the next tile's
  const faceUp =
    (canSee || ["finish", "roundEnd"].includes(okeyState.gameState)) &&
    !tile.hidden &&
    !thrownOkey;
  function handleClick(e) {
    e.preventDefault();
    // Android long-presses fire contextmenu too; touch has its own hold below
    const { pointerType } = e.nativeEvent;
    const touch = pointerType
      ? pointerType === "touch"
      : navigator.maxTouchPoints > 0;
    if (!myTile || touch) return;
    toggleHidden(tile);
  }
  // phones have no right click: hold your tile to flip it
  const hold = useRef();
  const held = useRef(false);
  function startHold() {
    if (!myTile) return;
    held.current = false;
    hold.current = setTimeout(() => {
      held.current = true;
      toggleHidden(tile);
    }, 500);
  }
  function endHold() {
    clearTimeout(hold.current);
  }
  const [{ opacity }, dragRef, preview] = useDrag(
    () => ({
      type: "TILE",
      item: { tile },
      canDrag: !disabled,
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.5 : 1,
      }),
    }),
    [tile],
  );
  // the mouse drags our own lifted tile (index.jsx) instead of the
  // browser's picture of it
  useEffect(() => {
    if (!touch) preview(getEmptyImage());
  }, [preview]);
  // the colour comes from the id (red7-0), as a class: the hex in the tile
  // is part of the game state and stays as it is
  const color = tile.id.match(/^[a-z]+/)[0];
  const classes = [
    "tile",
    faceUp ? `c-${color}` : "back",
    className,
    myTile && selected.includes(tile.id) && "selected",
  ];
  return (
    <div
      ref={dragRef}
      className={classes.filter(Boolean).join(" ")}
      style={{ ...style, opacity }}
      onClick={() => {
        // a hold already flipped the tile; don't also select it
        if (held.current) held.current = false;
        else if (myTile) toggleSelected(tile);
      }}
      onContextMenu={handleClick}
      onTouchStart={startHold}
      onTouchMove={() => clearTimeout(hold.current)}
      onTouchEnd={endHold}
      onTouchCancel={endHold}
    >
      {faceUp && (
        <>
          <div className="rank">{tile.rank}</div>
          {tile.rank !== "👌" && <div className="sym">{symbols[color]}</div>}
        </>
      )}
    </div>
  );
}

export default Tile;
