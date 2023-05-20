import { useDrop } from "react-dnd";
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
  disabled,
  ...props
}) {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: "TILE",
      drop: (e) => onDrop(e.tile, index),
      // canDrop: (e) =>
      //   (type === "DRAW" ? e.tile.source.includes("hand") : false) &&
      //   (type === "DISCARD" ? canDiscard : true),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
        canDrop: !!monitor.canDrop(),
      }),
    }),
    [index, canDiscard, onDrop]
  );
  return (
    <div
      ref={drop}
      className={`slot ${showBorder && "border"} ${className}`}
      {...props}
    >
      {tile && <Tile tile={tile} disabled={disabled} />}
    </div>
  );
}

export default Slot;
