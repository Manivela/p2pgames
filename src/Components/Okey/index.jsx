import {
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { DndProvider, useDragDropManager } from "react-dnd";
import { TouchBackend } from "react-dnd-touch-backend";
import { toast } from "react-hot-toast";
import { okeyKind, usePlaying } from "../HowToPlay";
import { t } from "../../i18n";
import Board from "./Board";
import { OkeyContext, OkeyProvider } from "./OkeyContext";
import { PRESETS } from "./rulesets";
import Tile, { SLOP } from "./Tile";
import "./rack.css";

// The table to the site's menu (Menu.jsx, Table's useTable does the same):
// the kind of game it plays, and whether the room can go to another game:
// at its players' word in the lobby or once a game's over, or anyone's
// while no one's playing in it (a player gone keeps their seat for their
// return). A preset picked there sets the lobby up, as its rules picker
// does, anyone's (GameSettings.jsx), or once a game's over, or with bots
// only at the table, the next game.
function MenuPicks() {
  const { okeyState, setSetup, newGame, me } = useContext(OkeyContext);
  const { gameState, players } = okeyState;
  const mode = okeyKind(
    gameState === "start" ? okeyState.setup : okeyState.rules,
  );
  const playersHere = players.some((p) => p.user && !p.user.bot);
  const between = gameState === "start" || gameState === "finish";
  const why =
    !playersHere || (between && me)
      ? null
      : me
        ? "A game is in play: finish it, or start a new one in ⋯"
        : "Only the players can change the game";
  useEffect(() => usePlaying.setState({ mode, why }), [mode, why]);
  const pick = usePlaying((s) => s.pick);
  useEffect(() => {
    if (pick?.game !== "okey") return;
    usePlaying.setState({ pick: null });
    if (pick.mode === mode) return;
    const preset = PRESETS.find((p) => p.id === pick.mode);
    if (gameState === "start") setSetup(preset);
    // bots only: no one's game is lost
    else if (between || !players.some((p) => p.away || (p.user && !p.user.bot)))
      newGame(preset);
    else toast(t("A game is in play: finish it, or start a new one in ⋯"));
  }, [pick]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// the dragged tile, lifted, under the finger or the mouse (the backend
// draws none), with how many picked tiles come along
function DragPreview() {
  const { selected } = useContext(OkeyContext);
  // read from react-dnd's monitor as it is now, not through useDragLayer:
  // its listener, made again after each render with that render's values,
  // misses a drag that ends between a render and its effects (a quick flick
  // on a slow phone) and leaves the tile in the air
  const manager = useDragDropManager();
  const monitor = manager.getMonitor();
  const subscribe = useCallback(
    (changed) => {
      const off = [
        monitor.subscribeToStateChange(changed),
        monitor.subscribeToOffsetChange(changed),
      ];
      return () => off.forEach((f) => f());
    },
    [monitor],
  );
  const item = useSyncExternalStore(subscribe, () =>
    monitor.isDragging() ? monitor.getItem() : null,
  );
  const offset = useSyncExternalStore(subscribe, () =>
    monitor.getClientOffset(),
  );
  // the touch backend ends a drag on touchend only: a touch the phone
  // cancels (its own long press, a system gesture) would leave the tile in
  // the air
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
        // the mouse too, on every screen: the browser's own drag and drop
        // goes through the OS's (OLE on Windows), the one way the page
        // reaches it, and players on Windows 11 lost copy and paste in every
        // app while at the table
        backend={TouchBackend}
        options={{
          enableMouseEvents: true,
          ignoreContextMenu: true,
          touchSlop: SLOP,
        }}
      >
        <Board />
        <DragPreview />
        <MenuPicks />
      </DndProvider>
    </OkeyProvider>
  );
}

export default Okey;
