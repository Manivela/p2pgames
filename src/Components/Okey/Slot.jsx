import { useDrag, useDrop } from "react-dnd";
import "./slot.css";

function Slot() {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: "TILE",
    drop: () => console.log("drop"),
    // canDrop: () => canMoveKnight(x, y),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }));
  return <div ref={drop} className="slot" />;
}

export default Slot;
