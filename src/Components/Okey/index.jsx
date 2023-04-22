import Tile from "./Tile";
import { ranks, colors } from "./constants";
import "./rack.css";

function Okey() {
  return (
    <div className="rack">
      {Object.values(colors).map((color) =>
        ranks.map((rank) => <Tile color={color} rank={rank} />)
      )}
    </div>
  );
}

export default Okey;
