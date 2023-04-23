import { useContext } from "react";
import { OkeyContext } from "./OkeyContext";
import Rack from "./Rack";
import Slot from "./Slot";
import "./rack.css";

const playerPositions = [
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
    bottom: "0px",
    marginLeft: "-358px",
    position: "absolute",
  },
];

function Board() {
  const { okeyState, nextDrawTile } = useContext(OkeyContext);

  return (
    <div className="board">
      <Slot className="drawPile" showBorder tile={nextDrawTile} />
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
