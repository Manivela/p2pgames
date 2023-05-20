import { useDrag } from "react-dnd";
import "./tile.css";
import { useState } from "react";

function Tile({ tile, disabled, className, style }) {
  const [hidden, setHidden] = useState(tile.hidden);
  function handleClick(e) {
    e.preventDefault();
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
      {!hidden && (
        <>
          <div className="rank">{tile.rank}</div>
          <div className="heart">♥</div>
        </>
      )}
    </div>
  );
}

export default Tile;
