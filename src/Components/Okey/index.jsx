import _ from "lodash";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Rack from "./Rack";
import { colors, ranks } from "./constants";
import "./rack.css";

const drawPile = [];

// create the tiles
for (let i = 0; i < 2; i++) {
  colors.forEach((color) =>
    ranks.forEach((rank) =>
      drawPile.push({
        color,
        rank,
        id: `${color + rank}`,
      })
    )
  );
}

const maxHandSize = 26;
function dealHand() {
  // Create a new array with 3 randomly selected elements
  const sampledArray = _.sampleSize(drawPile, 14);

  // Remove the selected elements from the original array
  _.pullAll(drawPile, sampledArray);
  return sampledArray.concat(
    Array(maxHandSize - sampledArray.length).fill(null)
  );
}
function Okey() {
  return (
    <DndProvider backend={HTML5Backend}>
      <div>
        <Rack initialHand={() => dealHand()} />
        <Rack initialHand={() => dealHand()} />
        <Rack initialHand={() => dealHand()} />
        <Rack initialHand={() => dealHand()} />
      </div>
    </DndProvider>
  );
}

export default Okey;
