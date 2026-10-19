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
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: "TILE",
      drop: (e) => {
        onDrop(e.tile, index); // react-dnd only takes an object or nothing back
      },
      // canDrop: (e) =>
      //   (type === "DRAW" ? e.tile.source.includes("hand") : false) &&
      //   (type === "DISCARD" ? canDiscard : true),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    [index, canDiscard, onDrop],
  );
  return (
    <div
      ref={drop}
      className={[
        "slot",
        showBorder && "border",
        // where a tile dragged over your rack will land
        type === "HAND" && isOver && "over",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {tile && <Tile tile={tile} disabled={disabled} />}
    </div>
  );
}

export default Slot;
