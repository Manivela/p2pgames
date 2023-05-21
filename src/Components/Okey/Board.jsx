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
  },
  {
    top: "50%",
    right: "0px",
    position: "absolute",
    marginRight: "-258px",
    marginTop: "-100px",
    transform: "rotate(-90deg)",
  },
  {
    left: "50%",
    marginLeft: "-358px",
    position: "absolute",
    transform: "rotate(180deg)",
  },
  {
    top: "50%",
    marginLeft: "-258px",
    marginTop: "-100px",
    position: "absolute",
    transform: "rotate(90deg)",
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
  const { okeyState, nextDrawTile, finishGame, startGame, myIndex, resetGame } =
    useContext(OkeyContext);
  const rotatedPlayers =
    myIndex !== -1
      ? rotateArray(okeyState.players, myIndex)
      : okeyState.players;
  console.log("okeyState: ", okeyState);
  return (
    <div className="board">
      <Slot
        className="drawPile"
        showBorder
        tile={nextDrawTile}
        type="DRAW"
        onDrop={finishGame}
      />
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
      {okeyState.gameState === "play" && (
        <button
          className="drawPile"
          style={{ marginLeft: 150 }}
          onClick={resetGame}
        >
          Reset Game
        </button>
      )}
      {rotatedPlayers.map((player, index) => (
        <Rack
          key={player.id}
          player={player.id}
          initialHand={player.hand}
          style={playerPositions[player.id - 1]}
        />
      ))}
    </div>
  );
}

export default Board;
