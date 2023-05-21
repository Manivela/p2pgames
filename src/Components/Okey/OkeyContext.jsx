import React, { createContext } from "react";
import _, { clone, cloneDeep, indexOf } from "lodash";
import { useMap } from "@joebobmiles/y-react";
import { toast } from "react-hot-toast";
import useSound from "use-sound";
import { colors, ranks } from "./constants";
import { checkFinished } from "./checkFinish";
import { useAuthStore } from "../../hooks/useStore";
import { createTile, maxHandSize } from "./utils";
import bell from "./assets/bell.mp3";
import tile1 from "./assets/tile-1.mp3";
// TODO:
// tuttuğun taşı atsın ilk bulduğunu değil (removeitem yanlış taşı bulup siliyor)
// 2 tane aynı taş varsa yan yana oynatırken satıyor
// oyun bitince herkesin elini göster
// okey taşına bakarken +1 mod 13 yapmak lazım ortada 13 varsa okeyin 1 olması için
// gizlenen taşı oynatınca geri açılıyor
// taş çekerken başka taşın üstüne çekince öncekinin üzerine yazıyor ya izin vermemesi lazım çekiyorsada yanına koyması lazım
// player 1 wins yerine adamın adını yaz
// oyun bitince taşları oynatmaya izin verme
// milletin isimleri ve attıkları taşlar oyuncuya düzgün görünsün tepetakla gözükmesin
// aynı taştan 4 tane oldu birşekilde
// okey ekranında mouse takibi kapat
// oyunculardan biri çıkınca oyun pause state ine geçip çıkan kişinin koltuktan kalkması lazım yeni birinin oturmasını beklemesi lazım.

export const OkeyContext = createContext({});

function removeItem(array, tile) {
  const fromIndex = array.findIndex((h) => h?.id === tile.id);
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
  newArray[fromIndex] = null;

  return newArray;
}

function swapItems(array, fromIndex, toIndex) {
  const newArray = [...array]; // Create a new array using the spread operator

  // Swap the items in the new array
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
    (tile) => ({ ...tile, hidden: false, source: `hand-${player}` })
  );

  return sampledArray.concat(
    Array(maxHandSize - sampledArray.length).fill(null)
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
    ranks.forEach((rank) => tiles.push(createTile(color, rank, i)))
  );
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
      hand: [],
      discardPile: [],
    },
    {
      id: 2,
      user: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 3,
      user: null,
      hand: [],
      discardPile: [],
    },
    {
      id: 4,
      user: null,
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

export function OkeyProvider({ children }) {
  const [currentUser] = useAuthStore((state) => [state.currentUser]);
  const [playBellSound] = useSound(bell, { volume: 0.2 });
  const [playTile1Sound] = useSound(tile1, { volume: 0.5 });

  const ymap = useMap("okey-state");
  let okeyState = ymap.get("game-state");
  const setOkeyState = (value) =>
    ymap.set("game-state", { message: "", ...value });
  if (okeyState === undefined) {
    setOkeyState(initialState);
    okeyState = initialState;
  }
  const nextDrawTile = okeyState.drawPile[okeyState.drawPile.length - 1];

  const me = okeyState.players.find((p) => p.user?.id === currentUser.id)?.id;

  React.useEffect(() => {
    if (okeyState.gameState === "play") {
      if (okeyState.currentPlayer === me) {
        playBellSound();
      } else {
        playTile1Sound();
      }
    }
  }, [okeyState.currentPlayer]);

  const isMyTurn = () => okeyState.currentPlayer === me;

  const myHand = (player) =>
    okeyState.players.find((p) => p.id === player).hand;

  const canDrawTile = (player) =>
    myHand(player).filter((t) => t !== null).length < 15;

  const canDiscardTile = (player) =>
    myHand(player).filter((t) => t !== null).length === 15;

  const myDiscardPile = (player) =>
    okeyState.players.find((p) => p.id === player).discardPile;

  const drawTile = (player, tile, toIndex) => {
    if (!isMyTurn()) {
      toast("Not your turn");
      return;
    }
    if (!canDrawTile(player)) {
      toast("Can't draw more tiles");
      return;
    }
    const newState = cloneDeep(okeyState);
    const myPlayer = newState.players.find((p) => p.id === player);
    myPlayer.hand = insertItem(myPlayer.hand, toIndex, {
      ...tile,
      source: `hand-${player}`,
      hidden: false,
    });
    if (tile.source === "draw-pile") {
      newState.drawPile = newState.drawPile.filter((t) => t.id !== tile.id);
    } else {
      const sourcePlayer = newState.players.find(
        (p) => p.id === Number(tile.source.split("-")[1])
      );
      sourcePlayer.discardPile = sourcePlayer.discardPile.filter(
        (t) => t.id !== tile.id
      );
    }
    setOkeyState(newState);
  };
  const swapTile = (player, tile, toIndex) => {
    if (tile.source !== `hand-${me}`) {
      toast("Can't move other players tiles");
      return;
    }
    const newState = cloneDeep(okeyState);
    const myPlayer = newState.players.find((p) => p.id === player);
    const oldIndex = myPlayer.hand.findIndex((t) => t?.id === tile.id);
    myPlayer.hand = swapItems(myPlayer.hand, oldIndex, toIndex);
    setOkeyState(newState);
  };
  const discardTile = (player, tile) => {
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
    myPlayer.hand = removeItem(myPlayer.hand, tile);
    myPlayer.discardPile = [
      ...myPlayer.discardPile,
      { ...tile, source: `discard-${player}` },
    ];
    newState.currentPlayer = getNextPlayer(
      newState.players,
      newState.currentPlayer
    ).id;
    setOkeyState(newState);
  };
  const finishGame = (tile) => {
    if (!isMyTurn()) {
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
    hand[discardIndex] = null;

    const finished = checkFinished(hand, okeyState.okeyTile);
    if (finished) {
      setOkeyState({
        ...okeyState,
        message: `${
          okeyState.players.find((p) => p.id === okeyState.currentPlayer).user
            .name
        } wins!`,
        gameState: "finish",
      });
    }
  };

  const startGame = () => {
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
    for (let i = 0; i < filteredPlayers.length; i++) {
      filteredPlayers[i].hand = dealHand(drawPile, filteredPlayers[i].id, i);
      toBeRemoved.push(...filteredPlayers[i].hand.filter((h) => h !== null));
    }
    const startingDrawPile = drawPile.filter(
      (t) => !toBeRemoved.some((r) => t.id === r.id)
    );

    setOkeyState({
      ...newState,
      gameState: "play",
      players: filteredPlayers,
      okeyTile,
      currentPlayer: filteredPlayers[0].id,
      message: "",
      drawPile: startingDrawPile,
    });
  };

  const resetGame = () => {
    setOkeyState(initialState);
  };

  const sit = (player) => {
    const newState = cloneDeep(okeyState);
    const newPlayers = newState.players;
    const seat = newPlayers.find((p) => p.id === player);
    seat.user = currentUser;
    setOkeyState({
      ...newState,
      players: newPlayers,
    });
  };

  const isAlreadySitting = okeyState.players.find(
    (p) => p.user?.id === currentUser.id
  );

  const stand = (player) => {
    const newState = cloneDeep(okeyState);
    const newPlayers = newState.players;
    const seat = newPlayers.find((p) => p.id === player);
    seat.user = null;
    setOkeyState({
      ...newState,
      players: newPlayers,
      message: `${currentUser.name} left`,
    });
  };

  const myIndex = okeyState.players.findIndex(
    (p) => p.user?.id === currentUser.id
  );

  return (
    <OkeyContext.Provider
      value={{
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
        me,
        currentUser,
      }}
    >
      {children}
    </OkeyContext.Provider>
  );
}
