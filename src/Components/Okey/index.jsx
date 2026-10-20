import { useContext, useEffect } from "react";
import { DndProvider, useDragDropManager, useDragLayer } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import Board from "./Board";
import { OkeyContext, OkeyProvider } from "./OkeyContext";
import Tile, { touch } from "./Tile";
import "./rack.css";

// the dragged tile, lifted, under the finger or the mouse (neither backend
// draws one here), with how many picked tiles come along
function DragPreview() {
  const { selected } = useContext(OkeyContext);
  const { item, offset } = useDragLayer((monitor) => ({
    item: monitor.isDragging() && monitor.getItem(),
    offset: monitor.getClientOffset(),
  }));
  // the touch backend ends a drag on touchend only: a touch the phone
  // cancels (its own long press, a system gesture) would leave the tile in
  // the air
  const manager = useDragDropManager();
  useEffect(() => {
    const cancel = () =>
      manager.getMonitor().isDragging() && manager.getActions().endDrag();
    addEventListener("touchcancel", cancel, true);
    return () => removeEventListener("touchcancel", cancel, true);
  }, [manager]);
  if (!item || !offset) return null;
  const group = selected.includes(item.tile.id) ? selected.length : 1;
  return (
    <div className="dragPreview" style={{ left: offset.x, top: offset.y }}>
      <Tile tile={item.tile} disabled />
      {group > 1 && <span className="badge">×{group}</span>}
    </div>
  );
}

// keep the screen on while at the table; browsers only allow it over HTTPS
// and drop the lock whenever the page is hidden, so take it again on return
function useWakeLock() {
  useEffect(() => {
    let lock;
    const request = () =>
      document.visibilityState === "visible" &&
      navigator.wakeLock
        ?.request("screen")
        .then((l) => (lock = l))
        .catch(() => {});
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      lock?.release();
    };
  }, []);
}

function Okey(props) {
  useWakeLock();
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
        <DragPreview />
      </DndProvider>
    </OkeyProvider>
  );
}

export default Okey;
