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
// TODO:
// bitirme algoritması seri başladıysa seri kontrol etmeli renk başladıysa renk aralarında geçemez (resim var)
// biterken attığı taş ortada kalsın gerçekten bittiyse
// 3 kişi olunca yazılar yamuk kalıyor
// diğer milletin attığı taşı alabilioz
// süre koyunca çektiyse çektiğini çekmediysede çekip atsın
// taşlar bitince seçenek sun oyunu bitir yada karıştır devam et diye

export const OkeyContext = createContext({});

// a claim's ghost only goes back to the discard pile or around the rack
const ghost = (tile) => tile.source.startsWith("claim-");

export function OkeyProvider({ children }) {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, {
    signaling: signalingServers,
    peerOpts,
  });
  const { states, localID } = useAwareness(provider.awareness);
  const currentUser = useAuthStore((state) => state.currentUser);
  const [playBellSound] = useSound(bell, { volume: 0.1 });
  const [playTile1Sound] = useSound(tile1, { volume: 0.5 });
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
  // a new deal can hand out the same tile ids again
  React.useEffect(() => setSelected([]), [okeyState.deal]);
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
    (tile) =>
      setSelected((ids) =>
        ids.includes(tile.id)
          ? ids.filter((id) => id !== tile.id)
          : [...ids, tile.id],
      ),
    [],
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

  const openHand = useCallback(() => {
    if (act(americano.openHand, me, picked())) setSelected([]);
  }, [act, me, picked]);

  const layMelds = useCallback(() => {
    if (act(americano.layMelds, me, picked())) setSelected([]);
  }, [act, me, picked]);

  const playOnMeld = useCallback(
    (tile, meldIndex) =>
      !ghost(tile) && act(americano.playOnMeld, me, tile.id, meldIndex),
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

    const disconnectedPlayerKeys = playerKeys.filter((key) => !states.has(key));

    if (disconnectedPlayerKeys.length === 0) return;

    const newState = cloneDeep(okeyState);
    let changed = false;
    let lastLeaverName = "Someone";

    disconnectedPlayerKeys.forEach((key) => {
      const playerIndex = newState.players.findIndex((p) => p.userKey === key);
      if (playerIndex >= 0) {
        const player = newState.players[playerIndex];
        lastLeaverName = player.user?.name || "Someone";
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
  }, [states, playerKeys, okeyState, setOkeyState]);

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
      held,
      openHand,
      layMelds,
      playOnMeld,
      claimDiscard,
      catchDiscard,
      returnDiscard,
      nextRound,
      dragged,
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
      held,
      openHand,
      layMelds,
      playOnMeld,
      claimDiscard,
      catchDiscard,
      returnDiscard,
      nextRound,
    ],
  );

  return (
    <OkeyContext.Provider value={contextValue}>{children}</OkeyContext.Provider>
  );
}
