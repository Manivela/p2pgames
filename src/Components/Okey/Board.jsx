import _ from "lodash";
import { useContext } from "react";
import { OkeyContext } from "./OkeyContext";
import Rack from "./Rack";
import Slot from "./Slot";
import Tile from "./Tile";
import "./rack.css";

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
  },
  {
    left: "50%",
    marginLeft: "-358px",
    position: "absolute",
    transform: "rotate(180deg)",
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

function Board() {
  const {
    okeyState,
    nextDrawTile,
    finishGame,
    startGame,
    myIndex,
    resetGame,
    newGame,
  } = useContext(OkeyContext);
  const rotatedPlayers =
    myIndex !== -1
      ? rotateArray(okeyState.players, myIndex)
      : okeyState.players;
  return (
    <div className="board">
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
      {okeyState.message && (
        <h1
          className="drawPile"
          style={{ marginTop: -100, transform: "translateX(-45%)" }}
        >
          {okeyState.message}
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
      {okeyState.gameState === "start" && (
        <button
          className="drawPile"
          style={{ marginLeft: 150 }}
          onClick={startGame}
        >
          Start Game
        </button>
      )}
      {okeyState.gameState !== "start" && (
        <button
          className="drawPile"
          style={{ marginLeft: 150, marginTop: 50 }}
          onClick={resetGame}
        >
          Reset Game
        </button>
      )}
      {okeyState.gameState !== "start" && (
        <button
          className="drawPile"
          style={{ marginLeft: 150, marginTop: 0 }}
          onClick={newGame}
        >
          New Game
        </button>
      )}
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
  );
}

export default Board;
