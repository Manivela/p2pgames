import React, { createContext, useMemo, useCallback } from "react";
import _ from "lodash";
import { useAwareness, useDoc, useMap, useWebRtc } from "../../vendor/y-react";
import { toast } from "react-hot-toast";
import useSound from "use-sound";
import { useParams } from "react-router-dom";
import { useAuthStore, useRackRow, useVolume } from "../../hooks/useStore";
import { useReadyCheck, useTogether, WAIT_READY } from "../../hooks/useRoom";
import * as okey from "./okey";
import { rowFits } from "./rulesets";
import * as bots from "./bot";
import { readState, replaceState, wentBack, writeState } from "./sync";
import { t } from "../../i18n";
import bell from "./assets/bell.mp3";
import tile1 from "./assets/tile-1.mp3";
import finished from "./assets/finish.mp3";
import won from "./assets/won.mp3";
import { signalingServers, peerOpts } from "../../constants";
import { BUILD, useSiteBuild } from "../../version";
import { useKnock } from "../knock";
import { useRecord } from "../Stats/store";

// what's still yours to do on your rack while a ready check holds the
// table: arrange it, flip a tile, take in tiles won before it
const OWN = [okey.moveTiles, okey.flipTile, okey.collectInbox];

export const OkeyContext = createContext({});
const NONE_SPUN = {};

// to Sentry on the deployed site (main.jsx loads it), the console here
function reportWentBack(why, tags, data) {
  const title = `okey: the turn went back (${why})`;
  console.warn(title, tags, data);
  const { Sentry } = window;
  if (!Sentry) return;
  Sentry.onLoad(() =>
    Sentry.withScope((scope) => {
      scope.setTags(tags);
      scope.addAttachment({
        filename: "turns.json",
        data: JSON.stringify(data),
      });
      Sentry.captureMessage(title, "warning");
    }),
  );
  Sentry.forceLoad?.();
}

// this tab's own notes (sessionStorage), which a blocked storage just loses
const stored = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // blocked: nothing kept
  }
};

export function OkeyProvider({ children }) {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, {
    signaling: signalingServers,
    peerOpts,
  });
  const { states, localID, setLocalState } = useAwareness(provider.awareness);
  const currentUser = useAuthStore((state) => state.currentUser);
  // this device's sound level, the same at every game (useStore.js)
  const { volume, setVolume } = useVolume();
  const [playBellSound] = useSound(bell, { volume: 0.1 * volume });
  const [playTile1Sound] = useSound(tile1, { volume: 0.5 * volume });
  const [playFinished] = useSound(finished, { volume: 0.5 * volume });
  const [playWon] = useSound(won, { volume: 0.5 * volume });
  // a new level clicks at itself, to be heard as it's set (not on load)
  const level = React.useRef(volume);
  React.useEffect(() => {
    if (level.current === volume) return;
    level.current = volume;
    playTile1Sound();
  }, [volume, playTile1Sound]);
  useMap("okey-state"); // re-render on every change
  const map = useDoc().getMap("okey-state");
  const shared = readState(map);
  // as this build plays it, whichever build wrote it
  const okeyState = shared ?? okey.initialState;
  // an easter egg: anyone's right click turns a fake okey upside down, or
  // back, for the whole room and every game in it (apart from the game state)
  const spun = map.get("spun") ?? NONE_SPUN;
  const spin = useCallback(
    (tile) => {
      const now = map.get("spun") ?? {};
      map.set("spun", { ...now, [tile.id]: !now[tile.id] });
    },
    [map],
  );

  // every setOkeyState(next) is computed from this render's okeyState
  const setOkeyState = useCallback(
    (value) => writeState(map, shared, value),
    [map, shared],
  );

  // A turn written from an older state than the one it replaced (sync.js
  // wentBack: a penalty lost from the score sheet) is reported once a deal,
  // with who wrote it and the last turns this page saw before it
  const seenTurns = React.useRef([]);
  React.useEffect(() => {
    const reported = new Set();
    const observer = (event, txn) => {
      const deal = map.get("deal");
      for (const [key, change] of event.changes.keys) {
        if (key !== "deal" && !key.endsWith("/turn")) continue;
        const after = map.get(key);
        // the client that wrote it, by Yjs's own record (its internals)
        const writer = map._map.get(key)?.id.client;
        const seen = seenTurns.current;
        seen.push({
          key,
          writer,
          local: txn.local,
          at: Date.now(),
          ...(key !== "deal" &&
            _.pick(after, ["discards", "currentPlayer", "drawn", "penalties"])),
        });
        if (seen.length > 10) seen.shift();
        if (change.action !== "update" || !key.startsWith(`${deal}/`)) continue;
        const why = wentBack(change.oldValue, after);
        if (!why || reported.has(deal)) continue;
        reported.add(deal);
        const state = readState(map);
        const seatOf = (id) => state.players.find((p) => p.userKey === id);
        const peers = [...provider.awareness.getStates()];
        reportWentBack(
          why,
          {
            room: roomId,
            local: txn.local,
            writer: seatOf(writer)?.user?.name ?? String(writer),
            me: seatOf(provider.awareness.clientID)?.user?.name,
            build: BUILD,
            writerBuild: peers.find(([id]) => id === writer)?.[1]?.build,
          },
          { before: change.oldValue, after, seen: [...seen], state, peers },
        );
      }
    };
    map.observe(observer);
    return () => map.unobserve(observer);
  }, [map, roomId, provider]);

  if (import.meta.env.DEV) {
    window.okey = {
      get: () => readState(map),
      set: (value) => writeState(map, readState(map), value),
    };
  }

  const allTiles = useMemo(
    () => [
      ...okeyState.drawPile.filter((tile) => tile !== null),
      ...(okeyState.okeyTile ? [okeyState.okeyTile] : []),
      ...okeyState.players.flatMap((player) =>
        player.hand.filter((tile) => tile !== null),
      ),
      ...okeyState.players.flatMap((player) =>
        player.discardPile.filter((tile) => tile !== null),
      ),
    ],
    [okeyState.drawPile, okeyState.okeyTile, okeyState.players],
  );

  // the lobby's pile is already its settings' sets (setSetup)
  const sets = okey.setsOf(
    okeyState.gameState === "start" ? { rules: okeyState.setup } : okeyState,
  );
  const duplicates = useMemo(
    () =>
      _(allTiles)
        .groupBy("name")
        .filter((group) => group.length > sets)
        .value(),
    [allTiles, sets],
  );

  if (duplicates.length > 0) {
    toast.error(t("Duplicate tile detected"));
    console.warn("duplicates:", duplicates);
  }
  // a sync bug: Sentry (main.jsx) hears where each copy is, and again only
  // when that changes
  const dupes = duplicates.length
    ? `${okeyState.rules?.id ?? "classic"}, deal ${okeyState.deal}, round ` +
      `${okeyState.round}: ${duplicates
        .flat()
        .map((x) => `${x.id} in ${x.source}`)
        .sort()
        .join(", ")}`
    : "";
  React.useEffect(() => {
    if (!dupes) return;
    window.Sentry?.captureException(new Error("Duplicate tile detected"), {
      level: "warning",
      extra: { tiles: dupes },
    });
  }, [dupes]);

  const nextDrawTile = okeyState.drawPile[okeyState.drawPile.length - 1];

  const me = useMemo(
    () => okeyState.players.find((p) => p?.user?.id === currentUser?.id)?.id,
    [okeyState.players, currentUser?.id],
  );

  React.useEffect(() => {
    if (okeyState.gameState === "play") {
      if (okeyState.currentPlayer === me) {
        playBellSound();
      } else {
        playTile1Sound();
      }
    }
  }, [
    okeyState.gameState,
    okeyState.currentPlayer,
    me,
    playBellSound,
    playTile1Sound,
  ]);

  // someone finishing the round, their last tile in the middle: a few at
  // the table clapping (finish.mp3: Pixabay's "Small group applause", its
  // first 2 s faded out); the game over, finished or not, the same
  // applause for longer instead (won.mp3: its first 6 s). Heard by everyone
  // who saw the round played, not by a page come to it over. Dev-only
  // window.okeyApplause lists them ("round", "game").
  const finishTile = okeyState.finishTile?.id;
  const over = okeyState.gameState === "finish";
  const sawPlay = React.useRef(false);
  React.useEffect(() => {
    if (okeyState.gameState === "play" && !finishTile) sawPlay.current = true;
    else if ((finishTile || over) && sawPlay.current) {
      sawPlay.current = false;
      (over ? playWon : playFinished)();
      if (import.meta.env.DEV)
        window.okeyApplause = [
          ...(window.okeyApplause ?? []),
          over ? "game" : "round",
        ];
    }
  }, [okeyState.gameState, finishTile, over, playFinished, playWon]);

  // every game played at this seat recorded on the device, for the stats
  // and the titles on the score sheet once it's over (Stats/store.js)
  useRecord(
    okeyState.gameState === "start" ? null : okeyState.gameId,
    okeyState,
    {
      kind: "okey",
      mode: okeyState.rules?.id ?? okeyState.rules?.name,
      me: currentUser?.id,
      seated: me !== undefined,
      over: okeyState.gameState === "finish",
    },
  );

  const isMyTurn = useCallback(
    () => okeyState.currentPlayer === me,
    [okeyState.currentPlayer, me],
  );

  const myHand = useCallback(
    (player) => okeyState.players.find((p) => p.id === player)?.hand || [],
    [okeyState.players],
  );

  const myDiscardPile = useCallback(
    (player) =>
      okeyState.players.find((p) => p.id === player)?.discardPile || [],
    [okeyState.players],
  );

  // the tile you last dragged has already landed: moves.js doesn't fly it
  const dragged = React.useRef(null);

  // The players waited for, by the next round and a ready check: those in
  // the game, never a bot, someone away holding it up; the next deal, and a
  // check's end, written by the first player's page.
  const need = okeyState.players
    .filter((p) => (p.user && !p.user.bot) || p.away)
    .map((p) => ({ key: p.id, here: !!p.user }));
  const startsHere =
    okeyState.players.find((p) => p.user && !p.user.bot)?.userKey === localID;
  // a ready check after a break (⋯, hooks/useRoom.js): no move is made, a
  // bot's or a held one either, till everyone's pressed Ready
  const check = useReadyCheck({
    map,
    need,
    mine: me ? [me] : [],
    starts: startsHere,
    live: okeyState.gameState !== "start",
  });
  const paused = check.open;

  // Racks only take drops for the local player; game.* enforces the rules.
  // Returns true when the move went through.
  const act = useCallback(
    (fn, player, ...args) => {
      const result =
        player !== me
          ? "Not your turn"
          : paused && !OWN.includes(fn)
            ? WAIT_READY
            : fn(okeyState, player, ...args);
      if (typeof result === "string") toast(t(result));
      else if (result) setOkeyState(result);
      const ok = !!result && typeof result !== "string";
      if (!ok) dragged.current = null;
      return ok;
    },
    [okeyState, me, setOkeyState, paused],
  );
  // when the turn last reached this device: the others' time to take the
  // discard runs from then (okey.drawTile), as the turn timer does
  // my own wrong call (okey.catchDiscard), told where it leads; not one
  // found on sitting down
  const wrong = okeyState.players.find((p) => p.id === me)?.calls?.wrong ?? 0;
  const wrongSeen = React.useRef([me, wrong]);
  React.useEffect(() => {
    const [seenMe, seen] = wrongSeen.current;
    if (me === seenMe && wrong > seen) {
      toast(t(okey.wrongCallNote(wrong)), { duration: 6000 });
    }
    wrongSeen.current = [me, wrong];
  }, [me, wrong]);
  const turnStart = React.useRef(Infinity);
  React.useEffect(() => {
    if (okeyState.currentPlayer === me) turnStart.current = Date.now();
  }, [okeyState.currentPlayer, okeyState.deal, me]);
  // A move made while the rules say wait (okey.waitBefore: the
  // others' time to take or catch the discard), local only, not shared: a
  // draw waits as a ghost in the slot it was dropped on, a discard on my
  // pile, out of my rack, and is made when the wait is up. Dragging a held
  // discard back, or a held draw's ghost off my rack, cancels it.
  const [hold, setHold] = React.useState(null); // { tile, toIndex, flies }
  const held = hold?.tile.source === `hand-${me}` ? hold.tile.id : null;
  const heldDraw = hold && !held ? hold : null;
  const unhold = useCallback(() => setHold(null), []);
  // The tile waiting on my rack, not in my hand yet: my claim on the
  // discard on offer (till the current player discards), or my draw held
  // above. The rack shows it in its slot, and the others make room for it
  // as for any tile (okey.placeAround); `claim`: it's my claim.
  const waiting = React.useMemo(() => {
    const offer = okey.upForClaim(okeyState);
    const offered =
      offer &&
      !okey.isCaught(okeyState, offer.tileId) &&
      okeyState.players.find((p) => p.id === offer.from)?.discardPile.at(-1);
    const claim = okeyState.players.find((p) => p.id === me)?.claim;
    if (offered && offered.id === offer.tileId && claim?.id === offer.id) {
      return {
        tile: { ...offered, source: `claim-${me}` },
        slot: claim.slot,
        claim: true,
      };
    }
    return heldDraw && { tile: heldDraw.tile, slot: heldDraw.toIndex };
  }, [okeyState, me, heldDraw]);
  // `flies`: drawn by a key or a button (Take, D), not dragged: it flies to
  // the rack (moves.js) instead of only landing
  const drawTile = useCallback(
    (player, tile, toIndex, flies = false) => {
      if (paused) return act(okey.drawTile, player);
      dragged.current = flies ? null : tile.id;
      const [now, at] = [Date.now(), turnStart.current];
      const wait =
        player === me && okey.waitBefore(okeyState, player, tile, now, at);
      const args = [tile, toIndex, now, at];
      if (!wait) return act(okey.drawTile, player, ...args);
      // anything else that would stop it is said now, not when it's drawn
      const next = okey.drawTile(okeyState, player, ...args);
      if (typeof next === "string") toast(t(next));
      if (!next || typeof next === "string") return false;
      // the others make room for it now, as they will once it's drawn
      const w = { tile, slot: -1 };
      const row = okey.rowOf(okeyState, me);
      const { slot } = okey.placeAround(
        myHand(me),
        row,
        [tile],
        toIndex,
        tile.id,
        w,
      );
      act(okey.moveTiles, me, [tile.id], toIndex, tile.id, w);
      setHold({ tile, toIndex: slot, flies });
      return true;
    },
    [act, okeyState, me, myHand, paused],
  );

  // Tiles picked on your own rack (local only, not shared): dragging one
  // moves them all, and in Americano the rules split them into melds,
  // wherever they sit on the rack.
  const [selected, setSelected] = React.useState([]);
  // El aç pressed once (local too): a tap picks the tile's whole group on
  // the rack, as the opening reads it, until you open or tap the felt
  const [picking, setPicking] = React.useState(false);
  // a new deal can hand out the same tile ids again, and a round that's over
  // has nothing left to pick: its end shows the hands unpicked
  const playing = okeyState.gameState === "play";
  React.useEffect(() => {
    setSelected([]);
    setPicking(false);
  }, [okeyState.deal, playing]);
  // El aç left pressed, nothing picked or unpicked for a while: back to
  // normal, the pick dropped
  React.useEffect(() => {
    if (!picking) return;
    const timer = setTimeout(() => {
      setSelected([]);
      setPicking(false);
    }, 20000);
    return () => clearTimeout(timer);
  }, [picking, selected]);
  // and a picked tile that leaves the rack (discarded, laid, a claim
  // lost) is unpicked
  const inHand = [...myHand(me), waiting?.tile]
    .filter(Boolean)
    .map((t) => t.id)
    .join();
  React.useEffect(
    () =>
      setSelected((ids) => {
        const kept = ids.filter((id) => inHand.split(",").includes(id));
        return kept.length === ids.length ? ids : kept;
      }),
    [inHand],
  );

  // the tiles a drag along my rack moves: the picked ones, or just it
  const movedWith = useCallback(
    (tile) =>
      selected.length > 1 && selected.includes(tile.id) ? selected : [tile.id],
    [selected],
  );
  // round the tile waiting on my rack, or that tile itself: a claim's slot
  // moves in the rule, a held draw's here, as the rule moves it
  const moveTile = useCallback(
    (player, tile, toIndex) => {
      dragged.current = tile.id;
      if (tile.id === held) setHold(null);
      const ids = movedWith(tile);
      const ok = act(okey.moveTiles, player, ids, toIndex, tile.id, waiting);
      if (ok && heldDraw) {
        const hand = myHand(me);
        const tiles = [...hand, waiting.tile].filter(
          (t) => t && ids.includes(t.id),
        );
        const row = okey.rowOf(okeyState, me);
        const { slot } = okey.placeAround(
          hand,
          row,
          tiles,
          toIndex,
          tile.id,
          waiting,
        );
        if (slot >= 0) setHold((h) => h && { ...h, toIndex: slot });
      }
      return ok;
    },
    [act, movedWith, held, waiting, heldDraw, myHand, me, okeyState],
  );

  const discardTile = useCallback(
    (player, tile) => {
      if (paused) return act(okey.discardTile, player, tile);
      dragged.current = tile.id;
      if (player !== me || !okey.waitBefore(okeyState, player, tile)) {
        return act(okey.discardTile, player, tile);
      }
      // anything else that would stop it is said now, not when it's thrown
      const next = okey.discardTile(okeyState, player, tile, Infinity);
      if (typeof next === "string") toast(t(next));
      if (!next || typeof next === "string") return false;
      setHold({ tile });
      setSelected((ids) => ids.filter((id) => id !== tile.id));
      return true;
    },
    [act, okeyState, me, paused],
  );

  // the held move is made once the rules allow it (asked again when the
  // timer fires, so an early tick just waits on); a new turn or deal, or a
  // held discard gone from my rack, drops it
  React.useEffect(() => setHold(null), [okeyState.deal]);
  React.useEffect(() => {
    if (!hold) return;
    const { tile, toIndex, flies } = hold;
    const discard = tile.source === `hand-${me}`;
    const still = discard
      ? myHand(me).some((t) => t?.id === tile.id)
      : !okeyState.drawn;
    if (!still || !isMyTurn() || okeyState.gameState !== "play") {
      setHold(null);
      return;
    }
    // made once a ready check's over
    if (paused) return;
    let timer;
    const move = () => {
      const now = Date.now();
      const at = turnStart.current;
      const wait = okey.waitBefore(okeyState, me, tile, now, at);
      if (wait) {
        timer = setTimeout(move, wait * 1000);
        return;
      }
      setHold(null);
      dragged.current = flies ? null : tile.id;
      if (discard) act(okey.discardTile, me, tile);
      else act(okey.drawTile, me, tile, toIndex, now, at);
    };
    move();
    return () => clearTimeout(timer);
  }, [hold, okeyState, me, act, myHand, isMyTurn, paused]);

  const finishGame = useCallback(
    (tile) => {
      dragged.current = tile.id;
      return act(okey.finishGame, me, tile);
    },
    [act, me],
  );

  // rules: a ruleset (rulesets.js)
  const startGame = useCallback(
    (rules) => {
      const next = okey.startGame(okeyState, undefined, rules);
      // a failed start would still replace the table, seats and all
      if (next.gameState !== "play") toast(t(next.message));
      else replaceState(map, next);
    },
    [map, okeyState],
  );

  const toggleSelected = useCallback(
    (tile) => {
      // the rack as it shows: the tile waiting on it in its slot
      const rack = [...myHand(me)];
      if (waiting?.slot >= 0 && !rack[waiting.slot]) {
        rack[waiting.slot] = waiting.tile;
      }
      const group = picking
        ? (okey
            .groupsOf(rack, okey.rowOf(okeyState, me))
            .find((g) => g.some((t) => t.id === tile.id))
            ?.map((t) => t.id) ?? [tile.id])
        : [tile.id];
      setSelected((ids) =>
        ids.includes(tile.id)
          ? ids.filter((id) => !group.includes(id))
          : [...ids, ...group.filter((id) => !ids.includes(id))],
      );
    },
    [picking, myHand, me, okeyState, waiting],
  );
  // a tap on the felt: nothing picked, and El aç let go
  const unselectAll = useCallback(() => {
    setSelected([]);
    setPicking(false);
  }, []);
  // exactly these picked (a box drawn on the rack)
  const select = useCallback(
    (ids) => setSelected((old) => (old.join() === ids.join() ? old : ids)),
    [],
  );

  const picked = useCallback(
    () => [
      myHand(me)
        .filter((t) => t && selected.includes(t.id))
        .map((t) => t.id),
    ],
    [myHand, me, selected],
  );

  // El aç's first press: picking, with what it would lay down picked
  // (meldsToLay) unless you've picked tiles yourself
  const startPicking = useCallback(() => {
    setPicking(true);
    setSelected((ids) => (ids.length ? ids : okey.meldsToLay(okeyState, me)));
  }, [okeyState, me]);
  // laying the pick, which ends picking; nothing at all while my draw
  // waits out the others' time to take it: it's on my rack, not yet drawn
  const lay = useCallback(
    (...move) => {
      if (heldDraw || !act(...move)) return;
      setSelected([]);
      setPicking(false);
    },
    [act, heldDraw],
  );
  const openHand = useCallback(
    () => lay(okey.openHand, me, picked()),
    [lay, me, picked],
  );
  const openAll = useCallback(() => lay(okey.openAll, me), [lay, me]);
  const layMelds = useCallback(
    () => lay(okey.layMelds, me, picked()),
    [lay, me, picked],
  );
  // the pick dropped on a meld: added to it, or laid down
  const addPick = useCallback(
    (meldIndex, atEnd) => lay(okey.addPick, me, picked(), meldIndex, atEnd),
    [lay, me, picked],
  );

  // a knock on the table (knock.js), heard from where it was as each sits
  const knock = useKnock(
    provider.awareness,
    okey.tableSeats(okeyState),
    me,
    volume,
  );

  const playOnMeld = useCallback(
    (tile, meldIndex, atEnd) =>
      act(okey.playOnMeld, me, tile.id, meldIndex, atEnd),
    [act, me],
  );

  // a tile I added to a meld this turn, back on my rack
  const takeBack = useCallback(
    (tile, toIndex) => {
      dragged.current = tile.id;
      return act(okey.takeBack, me, tile.id, toIndex);
    },
    [act, me],
  );

  // tiles won out of turn wait in my inbox; move them onto my rack
  const inboxSize = okeyState.players.find((p) => p.id === me)?.inbox?.length;
  React.useEffect(() => {
    if (inboxSize) act(okey.collectInbox, me);
  }, [inboxSize, act, me]);

  const nextRound = useCallback(() => {
    const next = okey.nextRound(okeyState);
    if (typeof next === "string") toast(t(next));
    else if (next) replaceState(map, next);
  }, [map, okeyState]);
  // someone stands or sits mid-round: the round void, dealt again once the
  // seats are right; the whole table changes, like the next round's deal
  const redealRound = useCallback(() => {
    const next = okey.redealRound(okeyState);
    if (typeof next === "string") toast(t(next));
    else replaceState(map, next);
  }, [map, okeyState]);

  // a saved or set-up game replaces the table whole
  const loadGame = useCallback((next) => replaceState(map, next), [map]);

  const resetGame = useCallback(() => {
    replaceState(map, okey.initialState);
  }, [map]);

  // the next game set up as this one was played, or as `setup` (a preset
  // picked in the site's menu)
  const newGame = useCallback(
    (setup = okeyState.rules ?? okeyState.setup) => {
      replaceState(map, {
        ...okey.initialState,
        players: okey.allSeats(okeyState.players).map((p) => ({
          ...p,
          discardPile: [],
          hand: [],
        })),
        setup,
      });
    },
    [map, okeyState.players, okeyState.rules, okeyState.setup],
  );

  // Next Round, and New Game once the game's over, pressed by every player
  // in it while the room waits for everyone (hooks/useRoom.js), a bot
  // never waited for, someone away holding it up; dealt by the first
  // player's page. The presses are keys of the map's own (`ready-<seat>`),
  // gone with the next deal (replaceState). Start in the lobby stays one
  // player's tap.
  const ended =
    okeyState.gameState === "roundEnd" || okeyState.gameState === "finish";
  // the same rules again, not a tap's event for them
  const nextGame = useCallback(() => newGame(), [newGame]);
  const together = useTogether({
    map,
    round: ended ? `${okeyState.deal}/${okeyState.gameState}` : null,
    need,
    mine: me ? [me] : [],
    starts: startsHere,
    hold: paused,
    go: okeyState.gameState === "finish" ? nextGame : nextRound,
  });

  // your rack's rows, this device's (⋯ → Settings), on your seat at every
  // game, where its rules take them (rowFits); the table's where they don't
  const { row } = useRackRow();
  React.useEffect(() => {
    if (!me || !okeyState.rules) return;
    const want = row !== null && rowFits(okeyState.rules, row) ? row : null;
    const next = okey.setRow(okeyState, me, want);
    if (next && typeof next !== "string") setOkeyState(next);
  }, [me, row, okeyState, setOkeyState]);

  // the lobby's settings, anyone's to change (GameSettings.jsx), and a pile
  // of as many sets as they play
  const setSetup = useCallback(
    (setup) => {
      const sets = okey.setsOf({ rules: setup });
      const pile = okeyState.drawPile.length !== okey.tileSet(sets).length && {
        drawPile: okey.shuffledPile(sets),
      };
      setOkeyState({ ...okeyState, setup, ...pile });
    },
    [okeyState, setOkeyState],
  );

  // mid-game, the settings the rules read as they're played, anyone's to
  // change (TableSettings), said on the table so nobody's caught out; not
  // over how a round or the game ended, which the message holds till the deal
  const setRules = useCallback(
    (rules) =>
      setOkeyState({
        ...okeyState,
        rules,
        ...(okeyState.gameState === "play" && {
          message: `${currentUser?.name ?? "Someone"} changed the rules`,
        }),
      }),
    [okeyState, setOkeyState, currentUser?.name],
  );

  // A change of who's in the round mid-round (a seat freed, or sat down in
  // and dealt in) replaces the whole table, as a deal does, so a move racing
  // it can't pass the turn to a seat that's gone or skip one that's come
  const write = useCallback(
    (next) => {
      if (typeof next === "string") toast(t(next));
      else if (!next) return;
      else if (
        next.gameState === "play" &&
        next.players.length !== okeyState.players.length
      ) {
        replaceState(map, next);
      } else setOkeyState(next);
    },
    [map, okeyState.players.length, setOkeyState],
  );

  const sit = useCallback(
    (player) =>
      currentUser && write(okey.sit(okeyState, player, currentUser, localID)),
    [okeyState, currentUser, localID, write],
  );

  // back after a reload (a new version, a phone that slept): sit down again
  // in the seat you dropped out of (away) unless someone took it (a bot
  // playing it meanwhile makes way), or in yours still held by your old
  // page, once it's gone (a tab duplicated with your login leaves the seat
  // to the first)
  React.useEffect(() => {
    if (!currentUser) return;
    const seat = okey.seatToSitBack(okeyState, currentUser, states);
    if (seat) sit(seat);
  }, [currentUser, okeyState, states, sit]);

  // Joining a table, sit down in its first empty seat, and again if another
  // page took it first or a reset emptied them all; not once you've stood
  // up or someone's freed your seat (your seat empty or gone, the same
  // game). Only once the table has reached this page: an empty one of its
  // own, written before, would go over everyone's (so the first one in a
  // new room taps Sit). sessionStorage watch: only watch (the e2e's).
  const seen = React.useRef(null);
  const out = React.useRef(false);
  const table = `${okeyState.gameId}/${okeyState.round}/${okeyState.gameState}`;
  React.useEffect(() => {
    const was = seen.current;
    seen.current = me ? { table, seat: me } : null;
    if (was && !me && was.table === table) {
      const seat = okeyState.players.find((p) => p.id === was.seat);
      if (!seat?.user && seat?.away !== currentUser?.id) out.current = true;
    }
    if (me || out.current || !currentUser || stored("watch")) return;
    if (!shared) return;
    const empty = okey.seatToJoin(okeyState, currentUser);
    if (empty) sit(empty);
  }, [me, table, okeyState, currentUser, shared, sit]);

  // a new name (the sidebar) goes on your seat, and nothing else changes
  React.useEffect(() => {
    const next = currentUser && okey.rename(okeyState, currentUser);
    if (next) setOkeyState(next);
  }, [currentUser, okeyState, setOkeyState]);

  // everyone at the table says which build they run, and which deal of the
  // game they have (awareness): a newer build there, or on the site, is
  // offered (Board.jsx). Between hands the table's is picked up by itself,
  // once one of its pages has our deal (not just come in, the game still on
  // its way): it keeps the game while this page reloads, once a build, so a
  // page the site still serves old can't loop. Never on the site's build
  // alone: the whole table would reload at once, and the game with it.
  const deal = shared?.deal;
  React.useEffect(() => {
    setLocalState((s) =>
      s?.build === BUILD && s?.deal === deal ? s : { ...s, build: BUILD, deal },
    );
  }, [setLocalState, deal]);
  const tableBuild = Math.max(
    0,
    ...[...states.values()].map((s) => s?.build ?? 0),
  );
  const keeper = [...states.values()].some(
    (s) => s?.build > BUILD && s.deal === deal,
  );
  const siteBuild = useSiteBuild();
  const newVersion =
    tableBuild > BUILD ? "table" : siteBuild > BUILD ? "site" : null;
  React.useEffect(() => {
    if (!keeper || !shared) return;
    if (okeyState.gameState === "play") return;
    if (stored("reloadedFor") === String(tableBuild)) return;
    store("reloadedFor", tableBuild);
    if (stored("reloadedFor") === String(tableBuild)) location.reload();
  }, [keeper, shared, okeyState.gameState, tableBuild]);

  // the seat emptied, its hand left for a friend to sit down to; out of the
  // next deal unless someone does, unlike a phone that slept
  const stand = useCallback(
    (player) => {
      const next = okey.standUp(okeyState, player);
      if (next) setOkeyState(next);
    },
    [okeyState, setOkeyState],
  );
  // the seat out of the game (okey.freeSeat); mid-round the whole table
  // changes, as at a deal, so a move racing it can't pass the turn to the
  // seat that's gone
  const freeSeat = useCallback(
    (player) => write(okey.freeSeat(okeyState, player)),
    [okeyState, write],
  );

  // seats whose page has gone: away, or a bot played on (okey.markGone)
  React.useEffect(() => {
    const next = okey.markGone(okeyState, states, localID, currentUser?.id);
    if (next) setOkeyState(next);
  }, [states, localID, okeyState, currentUser?.id, setOkeyState]);

  // a bot in an empty seat, or in place of one who's gone, played by this
  // page (bot.js)
  const seatBot = useCallback(
    (player) => write(bots.seatBot(okeyState, player, localID)),
    [okeyState, localID, write],
  );
  // the bots this page plays, out of turn: a claim on the discard up for
  // it or a catch of the tile just thrown, and tiles won into the inbox
  // onto the rack, one write a render
  React.useEffect(() => {
    if (okeyState.gameState !== "play" || paused) return;
    for (const p of okeyState.players) {
      if (!p.user?.bot || p.userKey !== localID) continue;
      const next = p.inbox?.length
        ? okey.collectInbox(okeyState, p.id)
        : bots.claim(okeyState, p.id) || bots.catchTile(okeyState, p.id);
      if (next) {
        setOkeyState(next);
        return;
      }
    }
  }, [okeyState, localID, setOkeyState, paused]);
  // its turn, on the page that plays it: a move at a pace the table can
  // follow, and a discard the rules hold back (the others' time to take
  // the one before) the moment they let it go. A little slower where that
  // time is kept (outOfTurnTakes, Americano's), the turn as long anyway;
  // sessionStorage botPace in ms
  const pace = Number(
    stored("botPace") ?? (okeyState.rules?.outOfTurnTakes ? 1200 : 900),
  );
  const botTurn = React.useRef({});
  React.useEffect(() => {
    const p = okeyState.players.find((x) => x.id === okeyState.currentPlayer);
    if (okeyState.gameState !== "play" || !p?.user?.bot || paused) return;
    if (p.userKey !== localID) return;
    // its turn's first move waits out the others' time to catch the
    // discard, from when the turn reached this page (one key a turn)
    const turn = `${okeyState.deal}.${okeyState.discards ?? 0}`;
    if (botTurn.current.turn !== turn) {
      botTurn.current = { turn, at: Date.now() };
    }
    const wait = okey.catchWait(
      okeyState,
      p.id,
      false,
      Date.now(),
      botTurn.current.at,
    );
    let timer;
    const move = () => {
      const at = botTurn.current.at;
      const next = bots.step(okeyState, p.id, Date.now(), undefined, at);
      if (next && typeof next !== "string") return setOkeyState(next);
      const left = okey.claimWait(okeyState, p.id);
      timer = setTimeout(move, left > 0 ? Math.ceil(left * 1000) : 1000);
    };
    timer = setTimeout(move, Math.max(pace, wait * 1000));
    return () => clearTimeout(timer);
  }, [okeyState, localID, pace, setOkeyState, paused]);
  // a ready check over: the others' time to take or catch the discard runs
  // again from now, not from before the break
  const pausedWas = React.useRef(paused);
  React.useEffect(() => {
    if (pausedWas.current && !paused) {
      if (okeyState.currentPlayer === me) turnStart.current = Date.now();
      botTurn.current = {};
    }
    pausedWas.current = paused;
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const contextValue = useMemo(
    () => ({
      act,
      okeyState,
      nextDrawTile,
      isMyTurn,
      myHand,
      myDiscardPile,
      discardTile,
      moveTile,
      movedWith,
      drawTile,
      finishGame,
      startGame,
      setSetup,
      setRules,
      sit,
      stand,
      freeSeat,
      seatBot,
      resetGame,
      newGame,
      loadGame,
      me,
      currentUser,
      spun,
      spin,
      knock,
      selected,
      toggleSelected,
      unselectAll,
      select,
      picking,
      startPicking,
      held,
      heldDraw,
      unhold,
      waiting,
      openHand,
      openAll,
      layMelds,
      addPick,
      playOnMeld,
      takeBack,
      together,
      check,
      nextRound,
      redealRound,
      dragged,
      newVersion,
      volume,
      setVolume,
    }),
    [
      act,
      okeyState,
      nextDrawTile,
      isMyTurn,
      myHand,
      myDiscardPile,
      discardTile,
      moveTile,
      movedWith,
      drawTile,
      finishGame,
      startGame,
      setSetup,
      setRules,
      sit,
      stand,
      freeSeat,
      seatBot,
      resetGame,
      newGame,
      loadGame,
      me,
      currentUser,
      spun,
      spin,
      knock,
      selected,
      toggleSelected,
      unselectAll,
      select,
      picking,
      startPicking,
      held,
      heldDraw,
      unhold,
      waiting,
      openHand,
      openAll,
      layMelds,
      addPick,
      playOnMeld,
      takeBack,
      together,
      check,
      nextRound,
      redealRound,
      newVersion,
      volume,
      setVolume,
    ],
  );

  return (
    <OkeyContext.Provider value={contextValue}>{children}</OkeyContext.Provider>
  );
}
