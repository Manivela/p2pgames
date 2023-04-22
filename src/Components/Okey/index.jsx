import _ from "lodash";
import { useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Tile from "./Tile";
import { colors, ranks } from "./constants";
import "./rack.css";
import Slot from "./Slot";

const allTiles = [];

colors.forEach((color) =>
  ranks.forEach((rank) => allTiles.push({ color, rank, id: `${color + rank}` }))
);

function Okey() {
  const [hand, setHand] = useState(_.sampleSize(allTiles, 13));
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="rack">
        <div className="top">
          {hand.slice(0, 13).map((tile, index) => (
            <Tile key={tile.id} index={index} tile={tile} />
          ))}
        </div>
        <div className="bottom">
          {Array.from({ length: 13 }).map((tile, index) => (
            <Slot key={index} index={index} />
          ))}
        </div>
      </div>
    </DndProvider>
  );
}

export default Okey;
