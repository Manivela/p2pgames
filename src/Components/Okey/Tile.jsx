import { useDrag } from "react-dnd";
import "./tile.css";
import { useContext, useRef } from "react";
import { OkeyContext } from "./OkeyContext";
import { isOkey } from "./melds";

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
  const [{ opacity }, dragRef] = useDrag(
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
  return (
    <div
      ref={dragRef}
      className={`${className} tile ${myTile && selected.includes(tile.id) ? "selected" : ""}`}
      style={{ ...style, color: faceUp ? tile.color : undefined, opacity }}
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
          <div className="heart">♥</div>
        </>
      )}
    </div>
  );
}

export default Tile;
