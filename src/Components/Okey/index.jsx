import Tile from "./Tile";
import { ranks, colors } from "./constants";
import "./rack.css";

function Okey() {
  return (
    <>
      <div className="rack">
        {Object.values(colors.slice(0, 2)).map((color) =>
          ranks.map((rank) => <Tile color={color} rank={rank} />)
        )}
      </div>
      <div className="rack">
        {Object.values(colors.slice(2, 4)).map((color) =>
          ranks.map((rank) => <Tile color={color} rank={rank} />)
        )}
      </div>
    </>
  );
}

export default Okey;
