import React, { createContext, useMemo, useCallback } from "react";
import _, { cloneDeep } from "lodash";
import { useAwareness, useDoc, useMap, useWebRtc } from "../../vendor/y-react";
import { toast } from "react-hot-toast";
import useSound from "use-sound";
import { useParams } from "react-router-dom";
import { useAuthStore } from "../../hooks/useStore";
import * as game from "./game";
import * as americano from "./americano";
import { readState, replaceState, writeState } from "./sync";
import { t } from "../../i18n";
import bell from "./assets/bell.mp3";
import tile1 from "./assets/tile-1.mp3";
import { signalingServers, peerOpts } from "../../constants";
import { BUILD, useSiteBuild } from "../../version";

export const OkeyContext = createContext({});

// a claim's ghost only goes back to the discard pile or around the rack
const ghost = (tile) => tile.source.startsWith("claim-");

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
  // this device's sound level, 0 to 1 (the ⋯ menu), kept for next time
  const [volume, setVolume] = React.useState(() => {
    try {
      const v = Number(localStorage.getItem("okey-volume") ?? 1);
      return Number.isFinite(v) ? v : 1;
    } catch {
      return 1;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem("okey-volume", volume);
    } catch {
      // blocked: back to full next time
    }
  }, [volume]);
  const [playBellSound] = useSound(bell, { volume: 0.1 * volume });
  const [playTile1Sound] = useSound(tile1, { volume: 0.5 * volume });
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
  const okeyState = shared ?? game.initialState;

  // every setOkeyState(next) is computed from this render's okeyState
  const setOkeyState = useCallback(
    (value) => writeState(map, shared, value),
    [map, shared],
  );

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

  const duplicates = useMemo(
    () =>
      _(allTiles)
        .groupBy("name")
        .filter((group) => group.length > 2)
        .value(),
    [allTiles],
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

  const moves = okeyState.rules ? americano : game;

  // the tile you last dragged has already landed: moves.js doesn't fly it
  const dragged = React.useRef(null);

  // Racks only take drops for the local player; game.* enforces the rules.
  // Returns true when the move went through.
  const act = useCallback(
    (fn, player, ...args) => {
      const result =
        player === me ? fn(okeyState, player, ...args) : "Not your turn";
      if (typeof result === "string") toast(t(result));
      else if (result) setOkeyState(result);
      const ok = !!result && typeof result !== "string";
      if (!ok) dragged.current = null;
      return ok;
    },
    [okeyState, me, setOkeyState],
  );
  const drawTile = useCallback(
    (player, tile, toIndex) => {
      dragged.current = tile.id;
      return act(moves.drawTile, player, tile, toIndex);
    },
    [act, moves],
  );

  // Tiles picked on your own rack (local only, not shared): dragging one
  // moves them all, and in Americano the rules split them into melds,
  // wherever they sit on the rack.
  const [selected, setSelected] = React.useState([]);
  // El aç pressed once (local too): a tap picks the tile's whole group on
  // the rack, as the opening reads it, until you open
  const [picking, setPicking] = React.useState(false);
  // a new deal can hand out the same tile ids again
  React.useEffect(() => {
    setSelected([]);
    setPicking(false);
  }, [okeyState.deal]);
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
  // and a picked tile that leaves the rack (discarded, laid) is unpicked
  const inHand = myHand(me)
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

  // A discard made while the others still have time to take the last one
  // (local only, not shared): it waits as a ghost on my pile, out of my
  // rack, and is thrown when the wait ends. Dragging it back cancels it.
  const [held, setHeld] = React.useState(null);

  const swapTile = useCallback(
    (player, tile, toIndex) => {
      dragged.current = tile.id;
      if (tile.id === held) setHeld(null);
      return selected.length > 1 && selected.includes(tile.id)
        ? act(game.moveTiles, player, selected, toIndex)
        : act(game.swapTile, player, tile, toIndex);
    },
    [act, selected, held],
  );

  const discardTile = useCallback(
    (player, tile) => {
      dragged.current = tile.id;
      if (!okeyState.rules || !americano.claimWait(okeyState, player)) {
        return act(moves.discardTile, player, tile);
      }
      // anything else that would stop it is said now, not when it's thrown
      const next =
        player === me
          ? americano.discardTile(okeyState, player, tile, Infinity)
          : "Not your turn";
      if (typeof next === "string") toast(t(next));
      if (!next || typeof next === "string") return false;
      setHeld(tile.id);
      setSelected((ids) => ids.filter((id) => id !== tile.id));
      return true;
    },
    [act, moves, okeyState, me],
  );

  // the held discard is thrown once the rules allow it (asked again when the
  // timer fires, so an early tick just waits on); a new turn or deal drops it
  React.useEffect(() => setHeld(null), [okeyState.deal]);
  React.useEffect(() => {
    if (!held) return;
    const tile = myHand(me).find((t) => t?.id === held);
    if (!tile || !isMyTurn() || okeyState.gameState !== "play") {
      setHeld(null);
      return;
    }
    let timer;
    const throwIt = () => {
      const wait = americano.claimWait(okeyState, me);
      if (wait) {
        timer = setTimeout(throwIt, wait * 1000);
        return;
      }
      setHeld(null);
      dragged.current = tile.id;
      act(americano.discardTile, me, tile);
    };
    throwIt();
    return () => clearTimeout(timer);
  }, [held, okeyState, me, act, myHand, isMyTurn]);

  const finishGame = useCallback(
    (tile) => {
      if (ghost(tile)) return false;
      dragged.current = tile.id;
      return act(moves.finishGame, me, tile);
    },
    [act, moves, me],
  );

  // rules: a ruleset (rulesets.js), or none for the classic game
  const startGame = useCallback(
    (rules) => {
      const next = rules
        ? americano.startGame(okeyState, undefined, rules)
        : game.startGame(okeyState);
      // a failed start would still replace the table, seats and all
      if (next.gameState !== "play") toast(t(next.message));
      else replaceState(map, next);
    },
    [map, okeyState],
  );

  const toggleSelected = useCallback(
    (tile) => {
      const group = picking
        ? americano
            .groupsOf(myHand(me), game.rowOf(okeyState))
            .find((g) => g.some((t) => t.id === tile.id))
            .map((t) => t.id)
        : [tile.id];
      setSelected((ids) =>
        ids.includes(tile.id)
          ? ids.filter((id) => !group.includes(id))
          : [...ids, ...group.filter((id) => !ids.includes(id))],
      );
    },
    [picking, myHand, me, okeyState],
  );
  const unselectAll = useCallback(() => setSelected([]), []);

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
    setSelected((ids) =>
      ids.length ? ids : americano.meldsToLay(okeyState, me),
    );
  }, [okeyState, me]);
  const laid = useCallback((ok) => {
    if (!ok) return;
    setSelected([]);
    setPicking(false);
  }, []);
  const openHand = useCallback(
    () => laid(act(americano.openHand, me, picked())),
    [act, me, picked, laid],
  );
  const openAll = useCallback(
    () => laid(act(americano.openAll, me)),
    [act, me, laid],
  );
  const layMelds = useCallback(
    () => laid(act(americano.layMelds, me, picked())),
    [act, me, picked, laid],
  );

  const showIndicator = useCallback(
    (tile) => okeyState.rules && act(americano.showIndicator, me, tile.id),
    [act, me, okeyState.rules],
  );

  const playOnMeld = useCallback(
    (tile, meldIndex, atEnd) =>
      !ghost(tile) && act(americano.playOnMeld, me, tile.id, meldIndex, atEnd),
    [act, me],
  );

  // slot: where the ghost goes on my rack; null takes the claim back
  const claimDiscard = useCallback(
    (slot = null) => act(americano.claimDiscard, me, slot),
    [act, me],
  );

  const catchDiscard = useCallback(
    () => act(americano.catchDiscard, me),
    [act, me],
  );

  // 101: the discard I took goes back on its pile
  const returnDiscard = useCallback(
    () => act(americano.returnDiscard, me),
    [act, me],
  );

  // tiles won out of turn wait in my inbox; move them onto my rack
  const inboxSize = okeyState.players.find((p) => p.id === me)?.inbox?.length;
  React.useEffect(() => {
    if (inboxSize) act(americano.collectInbox, me);
  }, [inboxSize, act, me]);

  const nextRound = useCallback(() => {
    const next = americano.nextRound(okeyState);
    if (typeof next === "string") toast(t(next));
    else if (next) replaceState(map, next);
  }, [map, okeyState]);
  // someone stands or sits mid-round: the round void, dealt again once the
  // seats are right; the whole table changes, like the next round's deal
  const redealRound = useCallback(() => {
    const next = americano.redealRound(okeyState);
    if (typeof next === "string") toast(t(next));
    else replaceState(map, next);
  }, [map, okeyState]);

  // classic, the pile ran out: a new one from the discards, or the end
  const shuffleDiscards = useCallback(
    () => act(game.shuffleDiscards, me),
    [act, me],
  );
  const endGame = useCallback(() => act(game.endGame, me), [act, me]);

  // a saved or set-up game replaces the table whole
  const loadGame = useCallback((next) => replaceState(map, next), [map]);

  const resetGame = useCallback(() => {
    replaceState(map, game.initialState);
  }, [map]);

  const newGame = useCallback(() => {
    replaceState(map, {
      ...game.initialState,
      players: game.allSeats(okeyState.players).map((p) => ({
        ...p,
        discardPile: [],
        hand: [],
      })),
    });
  }, [map, okeyState.players]);

  const sit = useCallback(
    (player) => {
      if (!currentUser) return;

      const newState = cloneDeep(okeyState);
      const seat = newState.players.find((p) => p.id === player);
      if (!seat) return;

      seat.user = currentUser;
      seat.userKey = localID;
      delete seat.left;
      delete seat.away;

      setOkeyState({
        ...newState,
        players: newState.players,
        message: "",
      });
    },
    [okeyState, currentUser, localID, setOkeyState],
  );

  const isAlreadySitting = useMemo(
    () => okeyState.players.find((p) => p?.user?.id === currentUser?.id),
    [okeyState.players, currentUser?.id],
  );

  // back after a reload (a new version, a phone that slept): sit down again
  // in the seat you dropped out of (away) unless someone took it, or in
  // yours still held by your old page, once it's gone (a tab duplicated
  // with your login leaves the seat to the first)
  React.useEffect(() => {
    if (!currentUser) return;
    const seat = okeyState.players.find((p) =>
      p.user
        ? p.user.id === currentUser.id && !states.has(p.userKey)
        : p.away === currentUser.id,
    );
    if (seat) sit(seat.id);
  }, [currentUser, okeyState.players, states, sit]);

  // everyone at the table says which build they run (awareness): a newer
  // one there, or on the site, is offered (Board.jsx). Between hands the
  // table's is picked up by itself: whoever runs it keeps the game while
  // this page reloads, once a build, so a page the site still serves old
  // can't loop
  React.useEffect(() => {
    setLocalState((s) => (s?.build === BUILD ? s : { ...s, build: BUILD }));
  }, [setLocalState]);
  const tableBuild = Math.max(
    0,
    ...[...states.values()].map((s) => s?.build ?? 0),
  );
  const siteBuild = useSiteBuild();
  const newVersion =
    tableBuild > BUILD ? "table" : siteBuild > BUILD ? "site" : null;
  React.useEffect(() => {
    if (newVersion !== "table" || !shared) return;
    if (okeyState.gameState === "play") return;
    if (stored("reloadedFor") === String(tableBuild)) return;
    store("reloadedFor", tableBuild);
    if (stored("reloadedFor") === String(tableBuild)) location.reload();
  }, [newVersion, shared, okeyState.gameState, tableBuild]);

  const stand = useCallback(
    (player) => {
      const newState = cloneDeep(okeyState);
      const seat = newState.players.find((p) => p.id === player);
      if (!seat) return;

      const userName = seat.user?.name || "Someone";
      seat.user = null;
      seat.userKey = null;
      seat.left = true; // out of the next deal, unlike a phone that slept

      setOkeyState({
        ...newState,
        players: newState.players,
        message: `${userName} left`,
      });
    },
    [okeyState, setOkeyState],
  );

  const playerKeys = useMemo(
    () => okeyState.players.map((p) => p.userKey).filter(Boolean),
    [okeyState.players],
  );

  React.useEffect(() => {
    // Seeing no one else means we're the ones offline: a phone waking up
    // drops everyone it hasn't heard from in 30s, and must not unseat them.
    if (states.size <= 1) return;

    // and never our own seat: it drops out of states only as this page
    // unloads (y-webrtc), where marking it away would have the sit-back
    // effect above take it again, over and over
    const disconnectedPlayerKeys = playerKeys.filter(
      (key) => key !== localID && !states.has(key),
    );

    if (disconnectedPlayerKeys.length === 0) return;

    const newState = cloneDeep(okeyState);
    let changed = false;
    let lastLeaverName = "Someone";

    disconnectedPlayerKeys.forEach((key) => {
      const playerIndex = newState.players.findIndex((p) => p.userKey === key);
      if (playerIndex >= 0) {
        const player = newState.players[playerIndex];
        lastLeaverName = player.user?.name || "Someone";
        player.away = player.user?.id; // theirs to come back to (sit)
        player.user = null;
        player.userKey = null;
        changed = true;
      }
    });

    if (changed) {
      setOkeyState({
        ...newState,
        message: `${lastLeaverName} left`,
      });
    }
  }, [states, playerKeys, localID, okeyState, setOkeyState]);

  const myIndex = useMemo(
    () => okeyState.players.findIndex((p) => p?.user?.id === currentUser?.id),
    [okeyState.players, currentUser?.id],
  );

  const toggleHidden = useCallback(
    (tile) => {
      const newState = cloneDeep(okeyState);
      for (const player of newState.players) {
        if (!player.hand) continue;
        const foundTile = player.hand.find((h) => h?.id === tile.id);
        if (foundTile) foundTile.hidden = !foundTile.hidden;
      }
      setOkeyState({
        ...newState,
      });
    },
    [okeyState, setOkeyState],
  );

  const contextValue = useMemo(
    () => ({
      okeyState,
      nextDrawTile,
      isMyTurn,
      myHand,
      myDiscardPile,
      discardTile,
      swapTile,
      drawTile,
      finishGame,
      startGame,
      sit,
      stand,
      isAlreadySitting,
      myIndex,
      resetGame,
      newGame,
      loadGame,
      me,
      currentUser,
      toggleHidden,
      selected,
      toggleSelected,
      unselectAll,
      picking,
      startPicking,
      held,
      openHand,
      openAll,
      layMelds,
      showIndicator,
      playOnMeld,
      claimDiscard,
      catchDiscard,
      returnDiscard,
      nextRound,
      redealRound,
      shuffleDiscards,
      endGame,
      dragged,
      newVersion,
      volume,
      setVolume,
    }),
    [
      okeyState,
      nextDrawTile,
      isMyTurn,
      myHand,
      myDiscardPile,
      discardTile,
      swapTile,
      drawTile,
      finishGame,
      startGame,
      sit,
      stand,
      isAlreadySitting,
      myIndex,
      resetGame,
      newGame,
      loadGame,
      me,
      currentUser,
      toggleHidden,
      selected,
      toggleSelected,
      unselectAll,
      picking,
      startPicking,
      held,
      openHand,
      openAll,
      layMelds,
      showIndicator,
      playOnMeld,
      claimDiscard,
      catchDiscard,
      returnDiscard,
      nextRound,
      redealRound,
      shuffleDiscards,
      endGame,
      newVersion,
      volume,
    ],
  );

  return (
    <OkeyContext.Provider value={contextValue}>{children}</OkeyContext.Provider>
  );
}
