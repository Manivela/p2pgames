import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import useSound from "use-sound";
import { useAwareness, useDoc, useMap, useWebRtc } from "../../vendor/y-react";
import { useAuthStore, useVolume } from "../../hooks/useStore";
import { signalingServers, peerOpts } from "../../constants";
import { Confirm } from "../Confirm";
import { t } from "../../i18n";
import Board from "./Board";
import { newGame, pips } from "./rules";
import tile from "../Okey/assets/tile-1.mp3";
import "./backgammon.css";

// The room's game lives in its own Yjs map: `seat-0` and `seat-1`, who
// plays white and black, each written by whoever sits or stands, and
// `game`, the rules' state (rules.js), written by the player whose turn it
// is, or by anyone seated for a new game. Only one player moves at a time,
// so one key holds the whole game.

const NO_SEATS = [null, null];

// the board before a game: set up, no dice, no one's turn, no roll yet
// (the first game's opening dice are tossed, Board.jsx)
const SET_UP = {
  ...newGame(null, NO_SEATS, [2, 1]),
  turn: -1,
  by: -1,
  dice: [],
  left: [],
  opening: null,
  rolled: 0,
};

// Everyone hears a checker land: one soft tak as it comes down (the slide
// in backgammon.css), however many dice took it there. A roll is quiet. A
// new level taks at itself, to be heard as it's set.
function useTableSounds(last, volume) {
  const [tak] = useSound(tile, { volume: 0.3 * volume });
  const heard = useRef(last?.n);
  useEffect(() => {
    if (!last || last.n === heard.current) return;
    heard.current = last.n;
    if (last.kind === "move" || last.kind === "undo") setTimeout(tak, 330);
  }, [last, tak]);
  const level = useRef(volume);
  useEffect(() => {
    if (level.current === volume) return;
    level.current = volume;
    tak();
  }, [volume, tak]);
}

function Plate({ seat, user, turn, here, pips, sit }) {
  return (
    <div className={`bg-plate${turn ? " turn" : ""}`}>
      <i className={`bg-dot ${seat ? "black" : "white"}`} />
      {user ? (
        <span className="name">{user.name}</span>
      ) : sit ? (
        <button className="bg-sit" onClick={sit}>
          {t("Sit")}
        </button>
      ) : (
        <span className="name empty">{t(seat ? "Black" : "White")}</span>
      )}
      {user && !here && <small className="away">{t("away")}</small>}
      <small className="pips" title={t("Pips to go")}>
        {pips}
      </small>
    </div>
  );
}

// in groups, a line between them, as at the Okey table (TableMenu.jsx):
// this device, your seat, the others', and in red the moves that end or
// replace the game
function Menu({
  volume,
  setVolume,
  stand,
  playBoth,
  free,
  newGame,
  resetScore,
}) {
  const [open, setOpen] = useState(false);
  // the menu folds away once an item has done its job
  const then = (action) => () => {
    setOpen(false);
    action();
  };
  return (
    <div className="bg-menu">
      <button
        className="dots"
        aria-label={t("Table menu")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="backdrop" onClick={() => setOpen(false)} />
          <div className="menu">
            <div className="group">
              <label className="volume">
                {t("Sound")}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="group">
              {/* the empty seat too, taking turns on this device */}
              {playBoth && (
                <button onClick={then(playBoth)}>{t("Play both sides")}</button>
              )}
              {stand && <button onClick={then(stand)}>{t("Stand")}</button>}
            </div>
            {/* anyone frees a seat someone left without standing (a closed
                tab, another browser): the game waits in it */}
            <div className="group">
              {free.map(({ seat, name, go }) => (
                <Confirm
                  key={seat}
                  label={t(`Free seat: ${name}`)}
                  onConfirm={then(go)}
                />
              ))}
            </div>
            <div className="group ends">
              {newGame && (
                <Confirm label={t("New Game")} onConfirm={then(newGame)} />
              )}
              {resetScore && (
                <Confirm
                  label={t("Reset score")}
                  onConfirm={then(resetScore)}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Backgammon() {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, { signaling: signalingServers, peerOpts });
  const { states } = useAwareness(provider.awareness);
  const currentUser = useAuthStore((s) => s.currentUser);
  useMap("backgammon"); // re-render on every change
  const map = useDoc().getMap("backgammon");
  // each seat its own key, so two sitting down at once both stay
  const seats = [map.get("seat-0") ?? null, map.get("seat-1") ?? null];
  const game = map.get("game") ?? null;
  const state = game ?? SET_UP;
  // this device's sound level, the same at every game (useStore.js)
  const { volume, setVolume } = useVolume();
  useTableSounds(game?.last, volume);

  // the seats this page plays: one, or both on one device, taking turns
  const mine = [0, 1].filter((i) => seats[i]?.id === currentUser.id);
  const seated = mine.length > 0;
  const both = mine.length === 2;
  // the board as your seat sees it, white's for someone watching or
  // playing both
  const near = both ? 0 : (mine[0] ?? 0);
  const far = 1 - near;
  const full = seats.every(Boolean);
  const ids = seats.map((u) => u?.id ?? null);
  const here = new Set([...states.values()].map((s) => s?.user?.id));

  const act = (next) => next && map.set("game", next);
  const sit = (i) => map.set(`seat-${i}`, currentUser);
  const stand = () => mine.forEach((i) => map.set(`seat-${i}`, null));
  const deal = () => map.set("game", newGame(game, ids));

  // the first game starts once both seats are taken, from whichever seated
  // page sees it first (two at once: one game wins, the same for everyone)
  useEffect(() => {
    if (!game && full && seated) deal();
  });

  // a new name (the sidebar) goes on your seats
  useEffect(() => {
    for (const i of mine) {
      if (seats[i].name !== currentUser.name) {
        map.set(`seat-${i}`, { ...seats[i], name: currentUser.name });
      }
    }
  });

  // development: read and write the game, set the next roll
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.backgammon = {
      ...window.backgammon,
      get: () => map.get("game"),
      set: (g) => map.set("game", g),
    };
  }, [map]);

  // one name on both seats says nothing: the colours, then
  const name = (s) => (!both && seats[s]?.name) || t(s ? "Black" : "White");
  const plate = (s) => (
    <Plate
      seat={s}
      user={seats[s]}
      turn={game && !game.winner && game.turn === s}
      here={here.has(seats[s]?.id)}
      pips={pips(state.checkers[s])}
      sit={!seated && !seats[s] ? () => sit(s) : null}
    />
  );
  const won = game?.winner;
  return (
    <div className="bg-fit">
      <div className="bg-head">
        {plate(far)}
        <div className="bg-score" title={t("Score")}>
          <b>{state.score[far]}</b>–<b>{state.score[near]}</b>
        </div>
        {plate(near)}
        <Menu
          volume={volume}
          setVolume={setVolume}
          stand={seated && stand}
          playBoth={seated && !full && (() => sit(1 - mine[0]))}
          free={[0, 1]
            .filter((i) => seats[i] && !mine.includes(i))
            .map((i) => ({
              seat: i,
              name: seats[i].name,
              go: () => map.set(`seat-${i}`, null),
            }))}
          newGame={seated && full && deal}
          resetScore={
            seated &&
            game?.score.some(Boolean) &&
            (() => act({ ...game, score: [0, 0] }))
          }
        />
      </div>
      <div className="bg-wrap">
        <Board
          state={state}
          // the room's here: a game, or a seat taken waiting for one
          live={!!game || seats.some(Boolean)}
          mine={mine}
          viewer={near}
          names={[0, 1].map(name)}
          note={
            game
              ? null
              : seats.some(Boolean)
                ? t("Waiting for a second player")
                : t("Sit down to play")
          }
          act={act}
        />
        {won && (
          <div className="bg-won">
            <p className="who">{t(`${name(won.seat)} wins!`)}</p>
            {won.points === 2 && <p className="mars">{t("Mars! 2 points")}</p>}
            <p className="score">
              {name(far)} <b>{game.score[far]}</b> – <b>{game.score[near]}</b>{" "}
              {name(near)}
            </p>
            {seated && full && <button onClick={deal}>{t("Next game")}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
