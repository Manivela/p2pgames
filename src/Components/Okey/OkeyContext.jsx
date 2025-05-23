import React, { createContext, useMemo, useCallback } from "react";
import _, { cloneDeep } from "lodash";
import { useAwareness, useMap, useWebRtc } from "@joebobmiles/y-react";
import { toast } from "react-hot-toast";
import useSound from "use-sound";
import { useParams } from "react-router-dom";
import { colors, ranks } from "./constants";
import { checkFinished } from "./checkFinish";
import { useAuthStore } from "../../hooks/useStore";
import { createTile, maxHandSize } from "./utils";
import bell from "./assets/bell.mp3";
import tile1 from "./assets/tile-1.mp3";
import { signalingServers, iceServers } from "../../constants";
// TODO:
// oyun bitince taşları oynatmaya izin verme
// bitirme algoritması seri başladıysa seri kontrol etmeli renk başladıysa renk aralarında geçemez (resim var)
// biterken attığı taş ortada kalsın gerçekten bittiyse
// 3 kişi olunca yazılar yamuk kalıyor
// diğer milletin attığı taşı alabilioz
// süre koyunca çektiyse çektiğini çekmediysede çekip atsın
// taşlar bitince seçenek sun oyunu bitir yada karıştır devam et diye

export const OkeyContext = createContext({});

function removeItem(array, tile) {
  const newArray = [...array];
  const fromIndex = newArray.findIndex((h) => h?.id === tile.id);
  newArray[fromIndex] = null;

  return newArray;
}

function swapItems(array, fromIndex, toIndex) {
  const newArray = [...array];
  [newArray[fromIndex], newArray[toIndex]] = [
    newArray[toIndex],
    newArray[fromIndex],
  ];

  return newArray;
}

function insertItem(array, toIndex, item) {
  const newArray = [...array];
  if (newArray[toIndex] === null) {
    // if the target is null just insert
    newArray[toIndex] = item;
    return newArray;
  }

  // Find the first null index after target
  const rightNull = newArray.indexOf(null, toIndex);
  const leftNull = newArray.lastIndexOf(null, toIndex);
  const firstNull = newArray.indexOf(null);

  // If no null is found on the right or left insert at the first available place
  if (rightNull === -1 && leftNull === -1) {
    newArray[firstNull] = item;
    return newArray;
  }

  if (rightNull !== -1) {
    // Shift the objects to the right
    for (let i = rightNull; i > toIndex; i--) {
      newArray[i] = newArray[i - 1];
    }

    // Insert the new object
    newArray[toIndex] = item;

    return newArray;
  }

  if (leftNull !== -1) {
    // Shift the objects to the left
    for (let i = leftNull; i < toIndex; i++) {
      newArray[i] = newArray[i + 1];
    }

    // Insert the new object
    newArray[toIndex] = item;

    return newArray;
  }

  return newArray;
}

const DEBUG = false;
const debugHand = [
  "black2",
  "black3",
  "black4",
  "black5",
  "black6",
  "black7",
  "black10",
  "black11",
  "black12",
  "black13",
  "black1",
  "red1",
  "red2",
  "red3",
  "red4",
];

function dealHand(drawPile, player, index) {
  if (DEBUG && index === 0) {
    const debugArray = drawPile.reduce((acc, curr) => {
      if (
        acc.length < 15 &&
        !acc.some((a) => a.name === curr.name) &&
        debugHand.includes(curr.name)
      ) {
        acc.push({ ...curr, hidden: false, source: `hand-${player}` });
      }
      return acc;
    }, []);
    return debugArray.concat(Array(maxHandSize - debugArray.length).fill(null));
  }
  const sampledArray = _.sampleSize(drawPile, index === 0 ? 15 : 14).map(
    (tile) => ({ ...tile, hidden: false, source: `hand-${player}` }),
  );

  return sampledArray.concat(
    Array(maxHandSize - sampledArray.length).fill(null),
  );
}
function pickOkeyTile(drawPile) {
  const okeyTile = _.sample(drawPile);
  return { ...okeyTile, hidden: false };
}
const tiles = [];
// create the tiles
for (let i = 0; i < 2; i++) {
  colors.forEach((color) =>
    ranks.forEach((rank) => tiles.push(createTile(color, rank, i))),
  );
  tiles.push(createTile("yellow", "👌", i));
}

const initialState = {
  gameState: "start",
  drawPile: _.shuffle(tiles).map((t) => ({ ...t, hidden: true })),
  okeyTile: null,
  currentPlayer: null,
  players: [
    {
      id: 1,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 2,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 3,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 4,
      user: null,
      userKey: null,
      hand: [],
      discardPile: [],
    },
  ],
  message: "",
};

function getNextPlayer(players, currentPlayer) {
  const previousIndex = players.findIndex((p) => p.id === currentPlayer);
  const nextIndex = (previousIndex + 1) % players.length;

  // Find the next element greater than 5 after the previous element
  return players[nextIndex];
}

function getPreviousPlayer(players, currentPlayer) {
  const previousIndex = players.findIndex((p) => p.id === currentPlayer);
  const numPlayers = players.length;
  let previousPlayerIndex;

  if (previousIndex === 0) {
    previousPlayerIndex = numPlayers - 1; // Wrap around to the last player
  } else {
    previousPlayerIndex = (previousIndex - 1) % numPlayers;
  }

  return players[previousPlayerIndex];
}

export function OkeyProvider({ children }) {
  const { roomId } = useParams();
  const provider = useWebRtc(roomId, {
    signaling: signalingServers,
    webrtcOptions: { iceServers },
  });
  const { states, localID } = useAwareness(provider.awareness);
  const currentUser = useAuthStore((state) => state.currentUser);
  const [playBellSound] = useSound(bell, { volume: 0.1 });
  const [playTile1Sound] = useSound(tile1, { volume: 0.5 });
  const ymap = useMap("okey-state");
  let okeyState = ymap.get("game-state");

  const setOkeyState = useCallback(
    (value) => {
      ymap.set("game-state", value);
    },
    [ymap],
  );

  if (okeyState === undefined) {
    okeyState = initialState;
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
    toast.error("Duplicate tile detected");
    console.warn("duplicates:", duplicates);
  }

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

  const canDrawTile = useCallback(
    (player) => myHand(player).filter((t) => t !== null).length < 15,
    [myHand],
  );

  const canDiscardTile = useCallback(
    (player) => myHand(player).filter((t) => t !== null).length === 15,
    [myHand],
  );

  const myDiscardPile = useCallback(
    (player) =>
      okeyState.players.find((p) => p.id === player)?.discardPile || [],
    [okeyState.players],
  );

  const drawTile = useCallback(
    (player, tile, toIndex) => {
      if (!isMyTurn()) {
        toast("Not your turn");
        return;
      }
      if (!canDrawTile(player)) {
        toast("Can't draw more tiles");
        return;
      }
      if (
        tile.source.includes("discard") &&
        tile.source !==
          `discard-${getPreviousPlayer(okeyState.players, player).id}`
      ) {
        toast("Can't draw this tile");
        return;
      }
      const newState = cloneDeep(okeyState);
      const myPlayer = newState.players.find((p) => p.id === player);
      if (!myPlayer) return;

      myPlayer.hand = insertItem(myPlayer.hand, toIndex, {
        ...tile,
        source: `hand-${player}`,
        hidden: false,
      });

      if (tile.source === "draw-pile") {
        newState.drawPile = newState.drawPile.filter((t) => t.id !== tile.id);
      } else {
        const sourcePlayer = newState.players.find(
          (p) => p.id === Number(tile.source.split("-")[1]),
        );
        if (sourcePlayer) {
          sourcePlayer.discardPile = sourcePlayer.discardPile.filter(
            (t) => t.id !== tile.id,
          );
        }
      }
      setOkeyState(newState);
    },
    [okeyState, isMyTurn, canDrawTile, setOkeyState],
  );

  const swapTile = useCallback(
    (player, tile, toIndex) => {
      if (!me || tile.source !== `hand-${me}`) {
        toast("Can't move other players tiles");
        return;
      }
      const newState = cloneDeep(okeyState);
      const myPlayer = newState.players.find((p) => p.id === player);
      if (!myPlayer) return;

      const oldIndex = myPlayer.hand.findIndex((t) => t?.id === tile.id);
      myPlayer.hand = swapItems(myPlayer.hand, oldIndex, toIndex);
      setOkeyState(newState);
    },
    [okeyState, me, setOkeyState],
  );

  const discardTile = useCallback(
    (player, tile) => {
      if (!isMyTurn()) {
        toast("Not your turn");
        return;
      }
      if (!canDiscardTile(player)) {
        toast("Can't discard before drawing");
        return;
      }
      if (!tile.source.includes("hand")) {
        toast("Invalid discard source");
        return;
      }
      const newState = cloneDeep(okeyState);
      const myPlayer = newState.players.find((p) => p.id === player);
      if (!myPlayer) return;

      myPlayer.hand = removeItem(myPlayer.hand, tile);
      myPlayer.discardPile = [
        ...myPlayer.discardPile,
        { ...tile, source: `discard-${player}`, hidden: false },
      ];
      newState.currentPlayer = getNextPlayer(
        newState.players,
        newState.currentPlayer,
      ).id;
      setOkeyState(newState);
    },
    [okeyState, isMyTurn, canDiscardTile, setOkeyState],
  );

  const finishGame = useCallback(
    (tile) => {
      if (!me || !isMyTurn()) {
        toast("Not your turn");
        return;
      }
      if (!canDiscardTile(me)) {
        toast("Can't discard before drawing");
        return;
      }
      if (tile.source !== `hand-${me}`) {
        toast("Can't move other players tiles");
        return;
      }
      const discardIndex = myHand(me).findIndex((h) => h?.id === tile.id);
      const hand = cloneDeep(myHand(me));
      if (discardIndex === -1) return;

      hand[discardIndex] = null;

      const finished = checkFinished(hand, okeyState.okeyTile);
      if (finished) {
        const newState = cloneDeep(okeyState);
        for (const player of newState.players) {
          if (player.hand) {
            player.hand = player.hand.map((h) =>
              h ? { ...h, hidden: false } : null,
            );
          }
        }

        const winner = newState.players.find(
          (p) => p.id === newState.currentPlayer,
        );
        const winnerName = winner?.user?.name || "Player";

        setOkeyState({
          ...newState,
          message: `${winnerName} wins!`,
          gameState: "finish",
        });
      }
    },
    [okeyState, me, isMyTurn, canDiscardTile, myHand, setOkeyState],
  );

  const startGame = useCallback(() => {
    const newState = cloneDeep(okeyState);
    const drawPile = newState.drawPile;
    const filteredPlayers = newState.players.filter((p) => p.user !== null);
    if (filteredPlayers.length < 2) {
      setOkeyState({
        ...newState,
        message: "not enough players to start the game",
      });
      return;
    }

    const okeyTile = pickOkeyTile(drawPile);
    const toBeRemoved = [okeyTile];
    const iteratee = (t) => !toBeRemoved.some((r) => t.id === r.id);

    for (let i = 0; i < filteredPlayers.length; i++) {
      filteredPlayers[i].hand = dealHand(
        drawPile.filter(iteratee),
        filteredPlayers[i].id,
        i,
      );
      toBeRemoved.push(...filteredPlayers[i].hand.filter((h) => h !== null));
    }

    const startingDrawPile = drawPile.filter(iteratee);

    setOkeyState({
      ...newState,
      gameState: "play",
      players: filteredPlayers,
      okeyTile,
      currentPlayer: filteredPlayers[0].id,
      message: "",
      drawPile: startingDrawPile,
    });
  }, [okeyState, setOkeyState]);

  const resetGame = useCallback(() => {
    setOkeyState(initialState);
  }, [setOkeyState]);

  const newGame = useCallback(() => {
    setOkeyState({
      ...initialState,
      players: okeyState.players.map((p) => ({
        ...p,
        discardPile: [],
        hand: [],
      })),
    });
  }, [okeyState.players, setOkeyState]);

  const sit = useCallback(
    (player) => {
      if (!currentUser) return;

      const newState = cloneDeep(okeyState);
      const seat = newState.players.find((p) => p.id === player);
      if (!seat) return;

      seat.user = currentUser;
      seat.userKey = localID;

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
      me,
      currentUser,
      toggleHidden,
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
      me,
      currentUser,
      toggleHidden,
    ],
  );

  return (
    <OkeyContext.Provider value={contextValue}>{children}</OkeyContext.Provider>
  );
}
