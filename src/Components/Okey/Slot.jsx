import { useDrag, useDrop } from "react-dnd";
import "./slot.css";
import Tile from "./Tile";

function Slot({ tile, onDrop, index }) {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: "TILE",
      drop: (e) => onDrop(e.tile, index),
      // canDrop: () => canMoveKnight(x, y),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
        canDrop: !!monitor.canDrop(),
      }),
    }),
    [index]
  );
  return (
    <div ref={drop} className="slot">
      {tile && <Tile tile={tile} />}
    </div>
  );
}

export default Slot;
