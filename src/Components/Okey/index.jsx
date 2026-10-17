import { DndProvider, useDragLayer } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import Board from "./Board";
import { OkeyProvider } from "./OkeyContext";
import Tile from "./Tile";
import "./rack.css";

// HTML5 drag and drop only follows a mouse; touch screens get the touch
// backend, which also takes the mouse on touch laptops
const touch = navigator.maxTouchPoints > 0;

// the touch backend draws no ghost, so a tile follows the finger
function TouchPreview() {
  const { item, offset } = useDragLayer((monitor) => ({
    item: monitor.isDragging() && monitor.getItem(),
    offset: monitor.getClientOffset(),
  }));
  if (!item || !offset) return null;
  return (
    <Tile
      tile={item.tile}
      className="dragPreview"
      style={{ left: offset.x, top: offset.y }}
      disabled
    />
  );
}

function Okey(props) {
  return (
    <OkeyProvider {...props}>
      <DndProvider
        backend={touch ? TouchBackend : HTML5Backend}
        options={
          touch
            ? { enableMouseEvents: true, ignoreContextMenu: true }
            : undefined
        }
      >
        <Board />
        {touch && <TouchPreview />}
      </DndProvider>
    </OkeyProvider>
  );
}

export default Okey;
