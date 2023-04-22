import "./tile.css";

function Tile({ rank = 1, color }) {
  return (
    <div className="tile" style={{ color }}>
      <span className="rank">{rank}</span>
      <span className="heart">♥</span>
    </div>
  );
}

export default Tile;
