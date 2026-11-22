import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { useDoc, useWebRtc } from "../vendor/y-react";
import { signalingServers, peerOpts, webrtc } from "../constants";
import Awareness from "../Components/Awareness";
import HowToPlay, { RULES, usePlaying } from "../Components/HowToPlay";
import Menu, { useRoomGame } from "../Components/Menu";
import Okey from "../Components/Okey";
import { useRoomSync } from "../hooks/useRoom";
import { t } from "../i18n";

// the games a room plays, by the room's `game` (Menu.jsx's useRoomGame),
// Okey till another's picked; the rest loaded once one's played
const GAMES = {
  okey: Okey,
  tictactoe: lazy(() => import("../Components/TicTacToe")),
  backgammon: lazy(() => import("../Components/Backgammon")),
  go: lazy(() => import("../Components/Go")),
  batak: lazy(() => import("../Components/Batak")),
};

// Whether the room's game is known: it's come over the network, or this
// page has synced with everyone who answered (none picked: Okey), or no
// one has within a second of reaching the signaling server (an empty
// room: the game this tab was at, a reload alone, else Okey). A slow
// network gets 6 s, then Okey till the room's comes. Without WebRTC there's
// no one to hear: alone at once.
// The room's first page doesn't wait: the login writes a new room's game,
// and the e2e's say so, once (sessionStorage alone: the room's id).
function useKnown() {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, { signaling: signalingServers, peerOpts });
  const room = useDoc().getMap("room");
  const has = room.has("game") || room.has("seed");
  const [heard, setHeard] = useState(() => {
    try {
      if (sessionStorage.getItem("alone") !== roomId) return false;
      sessionStorage.removeItem("alone");
      return true;
    } catch {
      return false; // blocked: it waits
    }
  });
  // whom this page is connected to and whose presence it has, for players
  // in one room who can't see each other (TODO.md): sent with a report
  // (Okey's ⋯ → Report a problem), and read from the console on the live
  // site too (window.room.peers())
  useEffect(() => {
    globalThis.room = {
      me: () => provider.room?.peerId,
      peers: () =>
        Object.fromEntries(
          [...(provider.room?.webrtcConns ?? [])].map(([id, c]) => [
            id,
            c.connected ? "connected" : "connecting",
          ]),
        ),
      tabs: () => [...(provider.room?.bcConns ?? [])],
      presence: () =>
        Object.fromEntries(
          [...provider.awareness.getStates()].map(([id, s]) => [
            id,
            s?.user?.name ?? null,
          ]),
        ),
    };
  }, [provider]);
  useEffect(() => {
    if (heard || has) return;
    const done = () => setHeard(true);
    const answered = () => provider.room?.webrtcConns.size > 0;
    // nobody answered: the game and its way of playing this tab was at
    // (Root), as the room's `seed`, which a game picked since outranks
    // (Menu.jsx's useRoomGame), so a page that only seemed alone never
    // takes the room from its game
    const seed = () => {
      try {
        const was = JSON.parse(sessionStorage.getItem("room-game"));
        if (was?.room !== roomId || room.has("game") || room.has("seed"))
          return;
        room.set("seed", { game: was.game, mode: was.mode });
        if (was.mode != null) usePlaying.setState({ pick: was });
      } catch {
        // blocked or unreadable: Okey
      }
    };
    // no WebRTC (constants.js): no one to hear, so alone at once
    if (!webrtc) {
      seed();
      return done();
    }
    let alone;
    const reached = () => {
      clearTimeout(alone);
      alone = setTimeout(() => answered() || (seed(), done()), 1000);
    };
    const conns = provider.signalingConns;
    if (conns.some((c) => c.connected)) reached();
    conns.forEach((c) => c.on("connect", reached));
    const synced = ({ synced }) => synced && done();
    provider.on("synced", synced);
    const slow = setTimeout(done, 6000);
    return () => {
      clearTimeout(alone);
      clearTimeout(slow);
      conns.forEach((c) => c.off("connect", reached));
      provider.off("synced", synced);
    };
  }, [provider, heard, has, room, roomId]);
  return has || heard;
}

// A game that throws (its shared state, say) shows the error in its place,
// the corner's buttons and the menu still there: the room's game is
// everyone's, so a crash that came with it would come back on a reload.
// Anyone can take the room to another game from it (the menu: no table
// says why not), which starts afresh (its `key`); Sentry hears of it.
class Caught extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error(error);
    window.Sentry?.captureException(error);
    usePlaying.setState({ why: null });
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div id="error-page">
        <h1>Oops!</h1>
        <p>Sorry, an unexpected error has occurred.</p>
        <p>
          <i>{error.message}</i>
        </p>
      </div>
    );
  }
}

// the room's settings and this device's kept agreed, once the room's state
// is known (hooks/useRoom.js)
function RoomSync() {
  useRoomSync();
  return null;
}

export default function Root() {
  // the menu, from the button in the corner: opened afresh each time
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // the game's How to play, from ? (at a table, beside its ⋯: index.css)
  const [game] = useRoomGame();
  const Game = GAMES[game];
  const [help, setHelp] = useState(false);
  const playing = usePlaying((s) => s.mode);
  const helps = game in RULES;
  // nothing to pick, nor a game shown, till the room's is known: someone
  // joining would see Okey first, or take the room there
  const known = useKnown();
  // the game this tab is at, and how it's played, for a reload alone in
  // the room (useKnown): the room's own, never Okey shown while it's on
  // its way
  const { roomId } = useParams();
  const room = useDoc().getMap("room");
  const set = room.has("game") || room.has("seed");
  useEffect(() => {
    if (!known || !set) return;
    try {
      sessionStorage.setItem(
        "room-game",
        JSON.stringify({ room: roomId, game, mode: playing }),
      );
    } catch {
      // blocked: a reload alone comes back to Okey
    }
  }, [known, set, roomId, game, playing]);
  if (!known) return <Awareness />;
  return (
    <>
      {/* you to the others, and their pointers: open or not, the menu */}
      <Awareness />
      <RoomSync />
      {menuOpen && <Menu onClose={closeMenu} />}
      {/* the corner buttons, on every page: where each table keeps them */}
      <div className="corner">
        <button
          className="menu-toggle"
          aria-label={t("Menu")}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        {/* iPhone Safari has no fullscreen for pages, so no button there */}
        {document.fullscreenEnabled && (
          <button
            className="fullscreen-toggle"
            aria-label={t("Fullscreen")}
            title={t("Fullscreen")}
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
            }
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            </svg>
          </button>
        )}
        {helps && (
          <button
            className="help-toggle"
            aria-label={t("How to play")}
            title={t("How to play")}
            onClick={() => setHelp(true)}
          >
            ?
          </button>
        )}
      </div>
      {helps && help && (
        <HowToPlay game={game} mode={playing} onClose={() => setHelp(false)} />
      )}
      <div id="detail">
        <Caught key={game}>
          <Suspense fallback={<>...</>}>
            <Game />
          </Suspense>
        </Caught>
      </div>
    </>
  );
}
