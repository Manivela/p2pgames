import { useDrag } from "react-dnd";
import "./tile.css";
import { useContext, useState } from "react";
import { OkeyContext } from "./OkeyContext";

function Tile({ tile, disabled, className, style }) {
  const { me } = useContext(OkeyContext);
  const [hidden, setHidden] = useState(tile.hidden);
  const myTile = me && tile.source === `hand-${me}`;
  const canSee = tile.source.includes("hand-") ? myTile : true;
  function handleClick(e) {
    e.preventDefault();
    if (!myTile) return;
    setHidden(!hidden);
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
    [tile]
  );
  return (
    <div
      ref={dragRef}
      className={`${className} tile`}
      style={{ ...style, color: tile.color, opacity }}
      onContextMenu={handleClick}
    >
      {canSee && !hidden && (
        <>
          <div className="rank">{tile.rank}</div>
          <div className="heart">♥</div>
        </>
      )}
    </div>
  );
}

export default Tile;
