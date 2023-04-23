import { useDrag, useDrop } from "react-dnd";
import "./slot.css";
import Tile from "./Tile";

function Slot({
  type = "HAND",
  tile,
  onDrop,
  index,
  showBorder,
  className,
  canDiscard,
  ...props
}) {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: "TILE",
      drop: (e) => onDrop(e.tile, index),
      canDrop: () => (type === "DISCARD" ? canDiscard : true),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
        canDrop: !!monitor.canDrop(),
      }),
    }),
    [index, canDiscard]
  );
  return (
    <div
      ref={drop}
      className={`slot ${showBorder && "border"} ${className}`}
      {...props}
    >
      {tile && <Tile tile={tile} />}
    </div>
  );
}

export default Slot;
