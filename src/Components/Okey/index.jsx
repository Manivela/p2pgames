import _ from "lodash";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Rack from "./Rack";
import { colors, ranks } from "./constants";
import "./rack.css";
import Slot from "./Slot";

const drawPile = [];

// create the tiles
for (let i = 0; i < 2; i++) {
  colors.forEach((color) =>
    ranks.forEach((rank) =>
      drawPile.push({
        color,
        rank,
        id: `${color + rank}-${i}`,
        // hidden: false,
      })
    )
  );
}

const maxHandSize = 26;
const startingPlayer = 4;
function dealHand(player) {
  // Create a new array with 3 randomly selected elements
  const sampledArray = _.sampleSize(
    drawPile,
    player === startingPlayer ? 15 : 14
  );

  // Remove the selected elements from the original array
  _.pullAll(drawPile, sampledArray);
  return sampledArray.concat(
    Array(maxHandSize - sampledArray.length).fill(null)
  );
}
function Okey() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="board">
        <Slot
          className="drawPile"
          showBorder
          tile={drawPile[drawPile.length - 1]}
        />
        <Rack
          player={1}
          initialHand={() => dealHand(1)}
          style={{
            left: "50%",
            marginLeft: "-358px",
            position: "absolute",
            transform: "rotate(180deg)",
          }}
        />
        <Rack
          player={2}
          initialHand={() => dealHand(2)}
          style={{
            top: "50%",
            marginLeft: "-258px",
            marginTop: "-100px",
            position: "absolute",
            transform: "rotate(90deg)",
          }}
        />
        <Rack
          player={3}
          initialHand={() => dealHand(3)}
          style={{
            top: "50%",
            right: "0px",
            position: "absolute",
            marginRight: "-258px",
            marginTop: "-100px",
            transform: "rotate(-90deg)",
          }}
        />
        <Rack
          player={4}
          initialHand={() => dealHand(4)}
          style={{
            left: "50%",
            bottom: "0px",
            marginLeft: "-358px",
            position: "absolute",
          }}
        />
      </div>
    </DndProvider>
  );
}

export default Okey;
