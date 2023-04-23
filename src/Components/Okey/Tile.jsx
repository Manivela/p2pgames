import { useDrag } from "react-dnd";
import "./tile.css";
import { useState } from "react";

function Tile({ tile }) {
  const [hidden, setHidden] = useState(false);
  function handleClick(e) {
    e.preventDefault();
    setHidden(!hidden);
  }
  const [{ opacity }, dragRef] = useDrag(
    () => ({
      type: "TILE",
      item: { tile },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.5 : 1,
      }),
    }),
    [tile]
  );
  return (
    <div
      ref={dragRef}
      className="tile"
      style={{ color: tile.color, opacity }}
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
