import { useContext } from "react";
import { OkeyContext } from "./OkeyContext";
import Rack from "./Rack";
import Slot from "./Slot";
import "./rack.css";
import Tile from "./Tile";

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

function Board() {
  const { okeyState, nextDrawTile, finishGame } = useContext(OkeyContext);

  return (
    <div className="board">
      <Slot
        className="drawPile"
        showBorder
        tile={nextDrawTile}
        type="DRAW"
        onDrop={finishGame}
      />
      <Tile
        className="drawPile"
        style={{ marginLeft: 40 }}
        tile={okeyState.okeyTile}
        disabled
      />
      <h1 className="drawPile" style={{ marginLeft: 100 }}>
        Current Player: {okeyState.currentPlayer}
      </h1>
      {okeyState.players.map((player, index) => (
        <Rack
          key={player.id}
          player={player.id}
          initialHand={player.hand}
          style={playerPositions[index]}
        />
      ))}
    </div>
  );
}

export default Board;
