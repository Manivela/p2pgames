import "./tile.css";

function Tile({ rank = 1, color }) {
  return (
    <div className="tile" style={{ color }}>
      <div className="rank">{rank}</div>
      <div className="heart">♥</div>
    </div>
  );
}

export default Tile;
