import { useLocation, useMatch } from "react-router-dom";

function Credits() {
  const isTicTacToe = useMatch("/:roomId/tictactoe");
  const isMinecraft = useMatch("/:roomId/minecraft");
  const isBackgammon = useMatch("/:roomId/backgammon");
  if (isBackgammon) {
    return (
      <div style={{ flexDirection: "column" }}>
        <div>Credits for this example:</div>
        <a
          href="https://github.com/bnunesc/react-backgammon"
          target="_blank"
          rel="noreferrer"
        >
          Bruno Nunes
        </a>
      </div>
    );
  }
  if (isTicTacToe) {
    return (
      <div style={{ flexDirection: "column" }}>
        <div>Credits for this example:</div>
        <a
          href="https://react.dev/learn/tutorial-tic-tac-toe"
          target="_blank"
          rel="noreferrer"
        >
          React Tutorial
        </a>
      </div>
    );
  }
  if (isMinecraft) {
    return (
      <div style={{ flexDirection: "column" }}>
        <div>Credits for this example:</div>
        <a
          href="https://www.youtube.com/watch?v=ZnXKmODEFHA&t=1s"
          target="_blank"
          rel="noreferrer"
        >
          Youtube: @CodingTech
        </a>
        <a
          href="https://github.com/danba340/minecraft-react"
          target="_blank"
          rel="noreferrer"
        >
          GitHub: danba340
        </a>
      </div>
    );
  }
  return null;
}

export default Credits;
