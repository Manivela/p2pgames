import { useDrag } from "react-dnd";
import "./tile.css";
import { useContext } from "react";
import { OkeyContext } from "./OkeyContext";

function Tile({ tile, disabled, className, style }) {
  const { me, toggleHidden, okeyState, selected, toggleSelected } =
    useContext(OkeyContext);
  const myTile = me && tile.source === `hand-${me}`;
  const canSee = tile.source.includes("hand-") ? myTile : true;
  function handleClick(e) {
    e.preventDefault();
    if (!myTile) return;
    toggleHidden(tile);
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
      className={`${className} tile ${selected.includes(tile.id) ? "selected" : ""}`}
      style={{ ...style, color: tile.color, opacity }}
      onClick={() => myTile && toggleSelected(tile)}
      onContextMenu={handleClick}
    >
      {(canSee || ["finish", "roundEnd"].includes(okeyState.gameState)) &&
        !tile.hidden && (
          <>
            <div className="rank">{tile.rank}</div>
            <div className="heart">♥</div>
          </>
        )}
    </div>
  );
}

export default Tile;
