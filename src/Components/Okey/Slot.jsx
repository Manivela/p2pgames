import { useEffect } from "react";
import { useDrop } from "react-dnd";
import "./slot.css";
import Tile from "./Tile";

function Slot({
  type = "HAND",
  tile,
  onDrop,
  onOver,
  index,
  showBorder,
  className,
  canDiscard,
  disabled,
  onDragOff,
  ...props
}) {
  const [{ isOver, held }, drop] = useDrop(
    () => ({
      // a pending draw's ghost goes only around the rack (Tile.jsx)
      accept: type === "HAND" ? ["TILE", "GHOST"] : "TILE",
      drop: (e) => {
        onDrop(e.tile, index); // react-dnd only takes an object or nothing back
      },
      // canDrop: (e) =>
      //   (type === "DRAW" ? e.tile.source.includes("hand") : false) &&
      //   (type === "DISCARD" ? canDiscard : true),
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
        held: monitor.isOver() ? monitor.getItem()?.tile : null,
      }),
    }),
    [index, canDiscard, onDrop, type],
  );
  // your rack shows what the tile held over one of its slots would do
  useEffect(() => onOver?.(index, held), [onOver, index, held]);
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
      {/* a tile of its own per tile: one that moves to another slot doesn't
          carry over the slide shown before it was dropped (rack.css) */}
      {tile && (
        <Tile
          key={tile.id}
          tile={tile}
          disabled={disabled}
          onDragOff={onDragOff}
        />
      )}
    </div>
  );
}

export default Slot;
