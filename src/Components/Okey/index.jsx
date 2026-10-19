import { useContext, useEffect } from "react";
import { DndProvider, useDragLayer } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TouchBackend } from "react-dnd-touch-backend";
import Board from "./Board";
import { OkeyContext, OkeyProvider } from "./OkeyContext";
import Tile from "./Tile";
import "./rack.css";

// HTML5 drag and drop only follows a mouse; touch screens get the touch
// backend, which also takes the mouse on touch laptops
const touch = navigator.maxTouchPoints > 0;

// the touch backend draws no ghost, so a tile follows the finger, with
// how many picked tiles come along
function TouchPreview() {
  const { selected } = useContext(OkeyContext);
  const { item, offset } = useDragLayer((monitor) => ({
    item: monitor.isDragging() && monitor.getItem(),
    offset: monitor.getClientOffset(),
  }));
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
        {touch && <TouchPreview />}
      </DndProvider>
    </OkeyProvider>
  );
}

export default Okey;
