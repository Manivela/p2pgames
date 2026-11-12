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
import { signalingServers, peerOpts } from "../constants";
import Awareness from "../Components/Awareness";
import HowToPlay, { RULES, usePlaying } from "../Components/HowToPlay";
import Menu, { useRoomGame } from "../Components/Menu";
import Okey from "../Components/Okey";
import { t } from "../i18n";

// the games a room plays, by the room's `game` (Menu.jsx's useRoomGame),
// Okey till another's picked; the rest loaded once one's played
const GAMES = {
  okey: Okey,
  tictactoe: lazy(() => import("../Components/TicTacToe")),
  backgammon: lazy(() => import("../Components/Backgammon")),
  go: lazy(() => import("../Components/Go")),
};

// Whether the room's game is known: it's come over the network, or this
// page has synced with everyone who answered (none picked: Okey), or no
// one has within a second of reaching the signaling server (an empty
// room: Okey). A slow network gets 6 s, then Okey till the room's comes.
// The room's first page doesn't wait: the login writes a new room's game,
// and the e2e's say so, once (sessionStorage alone: the room's id).
function useKnown() {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, { signaling: signalingServers, peerOpts });
  const has = useDoc().getMap("room").has("game");
  const [heard, setHeard] = useState(() => {
    try {
      if (sessionStorage.getItem("alone") !== roomId) return false;
      sessionStorage.removeItem("alone");
      return true;
    } catch {
      return false; // blocked: it waits
    }
  });
  useEffect(() => {
    if (heard || has) return;
    const done = () => setHeard(true);
    const answered = () => provider.room?.webrtcConns.size > 0;
    let alone;
    const reached = () => {
      clearTimeout(alone);
      alone = setTimeout(() => answered() || done(), 1000);
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
  }, [provider, heard, has]);
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

export default function Root() {
  // the menu, from the button in the corner: opened afresh each time
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // the game's How to play, from ? in the corner (the Okey table's is in
  // its ⋯: its corner has room for two)
  const [game] = useRoomGame();
  const Game = GAMES[game];
  const [help, setHelp] = useState(false);
  const playing = usePlaying((s) => s.mode);
  const helps = game in RULES && game !== "okey";
  // nothing to pick, nor a game shown, till the room's is known: someone
  // joining would see Okey first, or take the room there
  if (!useKnown()) return <Awareness />;
  return (
    <>
      {/* you to the others, and their pointers: open or not, the menu */}
      <Awareness />
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
