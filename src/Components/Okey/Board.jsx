import _ from "lodash";
import { useContext, useLayoutEffect, useRef, useState } from "react";
import { OkeyContext } from "./OkeyContext";
import Rack from "./Rack";
import Slot from "./Slot";
import Tile from "./Tile";
import {
  AmericanoActions,
  AmericanoInfo,
  AmericanoTable,
  Scores,
  place,
} from "./AmericanoTable";
import "./rack.css";
import { t } from "../../i18n";
import TableMenu from "./TableMenu";

const playerPositions = [
  {
    left: "50%",
    bottom: "0px",
    marginLeft: "-358px",
    position: "absolute",
    discardTransform: "translateY(-30px)",
    discardCountTransform: "translate(-300%, -150%)",
  },
  {
    top: "50%",
    right: "0px",
    position: "absolute",
    marginRight: "-258px",
    marginTop: "-100px",
    transform: "rotate(-90deg)",
    discardTransform: "translateY(-30px) rotate(90deg)",
    discardCountTransform: "translate(200%,-150%)",
  },
  {
    left: "50%",
    marginLeft: "-358px",
    position: "absolute",
    transform: "rotate(180deg)",
    nameTransform: "rotate(180deg)",
    discardTransform: "translateY(-15px) rotate(180deg)",
    discardCountTransform: "translate(300%,-330%)",
  },
  {
    top: "50%",
    marginLeft: "-258px",
    marginTop: "-100px",
    position: "absolute",
    transform: "rotate(90deg)",
    discardTransform: "translate(-30px, -30px) rotate(-90deg)",
    discardCountTransform: "translate(-200%,-400%)",
  },
];

const playerPositionsFor2 = [
  {
    left: "50%",
    bottom: "0px",
    marginLeft: "-358px",
    position: "absolute",
    discardTransform: "translateY(-30px)",
  },
  {
    left: "50%",
    marginLeft: "-358px",
    position: "absolute",
    transform: "rotate(180deg)",
    nameTransform: "rotate(180deg)",
    discardTransform: "translateY(-15px) rotate(180deg)",
  },
];

function rotateArray(array, x) {
  // Normalize the rotation count
  const rotations = x % array.length;

  // Handle negative rotations
  const normalizedRotations =
    rotations >= 0 ? rotations : array.length + rotations;

  // Handle rotation count of 1 separately
  if (normalizedRotations === 1) {
    return _.concat(_.tail(array), _.head(array));
  }

  // Split the array into two parts based on the rotation count
  const [head, tail] = _.chunk(array, normalizedRotations);

  // If either head or tail is undefined, return the original array
  if (head === undefined || tail === undefined) {
    return array;
  }

  // Rearrange the array by concatenating the tail with the head
  return _.concat(tail, head);
}

// Size of the box the table has to fit in.
function useBoxSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: Infinity, height: Infinity });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize(entry.contentRect),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

function GameButtons({ phone }) {
  const { okeyState, startGame, newGame } = useContext(OkeyContext);
  // Reset, and New Game mid-game, live in the table menu; once a game is
  // over, New Game is the obvious next step
  if (!["start", "finish"].includes(okeyState.gameState)) return null;
  return okeyState.gameState === "start" ? (
    <>
      <button
        {...place(phone, { marginLeft: 150 })}
        onClick={() => startGame()}
      >
        {t("Start Okey")}
      </button>
      <button
        {...place(phone, { marginLeft: 150, marginTop: 50 })}
        onClick={() => startGame("americano")}
      >
        {t("Start Americano")}
      </button>
    </>
  ) : (
    <button
      {...place(phone, { marginLeft: 150, marginTop: 0 })}
      onClick={newGame}
    >
      {t("New Game")}
    </button>
  );
}

// Short landscape screens (phones): your rack runs along the bottom and the
// other players shrink to their name and discard pile, left to right in
// seat order from the one before you.
function PhoneBoard({ players, style }) {
  const { okeyState, nextDrawTile, finishGame } = useContext(OkeyContext);
  const americano = okeyState.mode === "americano";
  const [mine, ...others] = players;
  return (
    <div className="board phone" style={style}>
      <div className="opponents">
        {[...others].reverse().map((player) => (
          <Rack
            key={player.id}
            player={player.id}
            className="mini"
            style={{}}
          />
        ))}
      </div>
      <div className="pile">
        <Slot showBorder tile={nextDrawTile} type="DRAW" onDrop={finishGame} />
        {okeyState.okeyTile && <Tile tile={okeyState.okeyTile} disabled />}
        <h4>{okeyState.drawPile.length}</h4>
      </div>
      <div className="table">
        {americano ? (
          <AmericanoInfo phone />
        ) : (
          okeyState.message && <h3 className="round">{t(okeyState.message)}</h3>
        )}
      </div>
      <div className="actions">
        <TableMenu />
        {americano && <AmericanoActions phone />}
        {americano ? (
          <Scores>
            <GameButtons phone />
          </Scores>
        ) : (
          <GameButtons phone />
        )}
      </div>
      <Rack player={mine.id} style={{}} />
    </div>
  );
}

function Board() {
  const { okeyState, nextDrawTile, finishGame, myIndex } =
    useContext(OkeyContext);
  const rotatedPlayers =
    myIndex !== -1
      ? rotateArray(okeyState.players, myIndex)
      : okeyState.players;
  const americano = okeyState.mode === "americano";
  const two = rotatedPlayers.length === 2;
  const [fitRef, box] = useBoxSize();
  // same test as the CSS that moves the corner buttons (index.css)
  const phone = window.innerHeight <= 500;
  // smallest sizes where no racks, names or discard piles overlap;
  // Americano needs extra height for the melds above the draw pile
  const width = phone ? 890 : two ? 760 : 1340;
  const height = phone
    ? americano
      ? 400
      : 330
    : (two ? 700 : 820) + (americano ? (two ? 360 : 320) : 0);
  // shrink the fixed-size table to fit, never grow it
  const zoom = Math.min(1, box.width / width, box.height / height);
  return (
    <div
      className="fit"
      ref={fitRef}
      data-rotate={t("Turn your phone sideways to play")}
    >
      {!phone && <TableMenu />}
      {americano && !phone && <Scores />}
      {phone ? (
        <PhoneBoard players={rotatedPlayers} style={{ width, height, zoom }} />
      ) : (
        <div className="board" style={{ width, height, zoom }}>
          {americano && <AmericanoTable />}
          <Slot
            className="drawPile"
            showBorder
            tile={nextDrawTile}
            type="DRAW"
            onDrop={finishGame}
          />
          <h4 className="drawPile" style={{ marginTop: -60, marginLeft: -10 }}>
            {okeyState.drawPile.length}
          </h4>
          {okeyState.message && !americano && (
            // left of the draw pile: above it, 2 players' names leave no room
            <h1
              className="drawPile"
              style={{
                marginTop: -20,
                marginLeft: -40,
                transform: "translateX(-100%)",
                width: "max-content",
                maxWidth: 320,
                textAlign: "right",
              }}
            >
              {t(okeyState.message)}
            </h1>
          )}
          {okeyState.okeyTile && (
            <Tile
              className="drawPile"
              style={{ marginLeft: 40 }}
              tile={okeyState.okeyTile}
              disabled
            />
          )}
          <GameButtons />
          {rotatedPlayers.map((player, index) => (
            <Rack
              key={player.id}
              player={player.id}
              initialHand={player.hand}
              style={
                rotatedPlayers.length === 2
                  ? playerPositionsFor2[index]
                  : playerPositions[index]
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Board;
