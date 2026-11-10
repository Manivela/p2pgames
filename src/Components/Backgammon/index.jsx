import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import useSound from "use-sound";
import { useAwareness, useDoc, useMap, useWebRtc } from "../../vendor/y-react";
import { useAuthStore } from "../../hooks/useStore";
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

// the board before a game: set up, no dice, no one's turn
const SET_UP = {
  ...newGame(null, NO_SEATS, [2, 1]),
  turn: -1,
  by: -1,
  dice: [],
  left: [],
  opening: null,
};

// this device's sound, on or off (the ⋯ menu), kept for next time
function useSoundSetting() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem("backgammon-sound") !== "off";
    } catch {
      return true;
    }
  });
  const set = (value) => {
    setOn(value);
    try {
      localStorage.setItem("backgammon-sound", value ? "on" : "off");
    } catch {
      // blocked: on again next time
    }
  };
  return [on, set];
}

// Everyone hears what happens as it reaches them: a checker's tak as it
// lands (one for each die a combined move takes), dice rattling on a roll.
function useTableSounds(last, on) {
  const [tak] = useSound(tile, { volume: 0.5, soundEnabled: on });
  const heard = useRef(last?.n);
  useEffect(() => {
    if (!last || last.n === heard.current) return;
    heard.current = last.n;
    const at = (ms, rate = 1) =>
      setTimeout(() => tak({ playbackRate: rate }), ms);
    if (last.kind === "roll" || last.kind === "new") {
      for (const ms of [0, 60, 140, 190]) at(ms, 1.7 + Math.random() * 0.6);
    } else {
      // as the sliding checker lands (backgammon.css)
      const steps = last.steps ?? 1;
      for (let i = 0; i < steps; i++) at(330 - (steps - 1 - i) * 120);
    }
  }, [last, tak]);
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

function Menu({ sound, setSound, stand, free, newGame, resetScore }) {
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
            <label>
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => setSound(e.target.checked)}
              />
              {t("Sound")}
            </label>
            {stand && <button onClick={then(stand)}>{t("Stand")}</button>}
            {/* anyone frees a seat someone left without standing (a closed
                tab, another browser): the game waits in it */}
            {free.map(({ seat, name, go }) => (
              <Confirm
                key={seat}
                label={t(`Free seat: ${name}`)}
                onConfirm={then(go)}
              />
            ))}
            {newGame && (
              <Confirm label={t("New Game")} onConfirm={then(newGame)} />
            )}
            {resetScore && (
              <Confirm label={t("Reset score")} onConfirm={then(resetScore)} />
            )}
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
  const [sound, setSound] = useSoundSetting();
  useTableSounds(game?.last, sound);

  const seat = seats.findIndex((u) => u?.id === currentUser.id);
  const me = seat < 0 ? undefined : seat;
  // someone watching sees the board as white does
  const near = me ?? 0;
  const far = 1 - near;
  const full = seats.every(Boolean);
  const ids = seats.map((u) => u?.id ?? null);
  const here = new Set([...states.values()].map((s) => s?.user?.id));

  const act = (next) => next && map.set("game", next);
  const sit = (i) => map.set(`seat-${i}`, currentUser);
  const stand = () => map.set(`seat-${me}`, null);
  const deal = () => map.set("game", newGame(game, ids));

  // the first game starts once both seats are taken, from whichever seated
  // page sees it first (two at once: one game wins, the same for everyone)
  useEffect(() => {
    if (!game && full && me !== undefined) deal();
  });

  // a new name (the sidebar) goes on your seat
  useEffect(() => {
    const mine = seats[me];
    if (mine && mine.name !== currentUser.name) {
      map.set(`seat-${me}`, { ...mine, name: currentUser.name });
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

  const name = (s) => seats[s]?.name ?? t(s ? "Black" : "White");
  const plate = (s) => (
    <Plate
      seat={s}
      user={seats[s]}
      turn={game && !game.winner && game.turn === s}
      here={here.has(seats[s]?.id)}
      pips={pips(state.checkers[s])}
      sit={me === undefined && !seats[s] ? () => sit(s) : null}
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
          sound={sound}
          setSound={setSound}
          stand={me !== undefined && stand}
          free={[0, 1]
            .filter((i) => seats[i] && i !== me)
            .map((i) => ({
              seat: i,
              name: seats[i].name,
              go: () => map.set(`seat-${i}`, null),
            }))}
          newGame={me !== undefined && full && deal}
          resetScore={
            me !== undefined &&
            game?.score.some(Boolean) &&
            (() => act({ ...game, score: [0, 0] }))
          }
        />
      </div>
      <div className="bg-wrap">
        <Board
          state={state}
          me={me}
          viewer={near}
          names={seats.map((u) => u?.name)}
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
            {me !== undefined && full && (
              <button onClick={deal}>{t("Next game")}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
