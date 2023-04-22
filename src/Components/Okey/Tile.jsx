import { useDrag } from "react-dnd";
import "./tile.css";

function Tile({ tile, isDragging }) {
  const [{ opacity }, dragRef] = useDrag(
    () => ({
      type: "TILE",
      item: { tile },
      collect: (monitor) => ({
        opacity: monitor.isDragging() ? 0.5 : 1,
      }),
    }),
    []
  );
  return (
    <div ref={dragRef} className="tile" style={{ color: tile.color, opacity }}>
      <div className="rank">{tile.rank}</div>
      <div className="heart">♥</div>
    </div>
  );
}

export default Tile;
