import React from "react";
import { BOARD_SIZE } from ".";

function Board({ player, boardState, handleIntersectionClick }) {
  const bigPoints =
    BOARD_SIZE === 19
      ? [
          [3, 3],
          [3, 9],
          [3, 15],
          [9, 3],
          [9, 9],
          [9, 15],
          [15, 3],
          [15, 9],
          [15, 15],
        ]
      : [];
  const baseBoardWidth = BOARD_SIZE === 19 ? 1000 : 500; // Change this value to adjust the board width
  const cellSize = baseBoardWidth / (BOARD_SIZE - 1);
  const padding = cellSize * 1.5;
  const boardWidth = baseBoardWidth + 2 * padding; // Change this value to adjust the board width

  const renderVerticalLines = () => {
    const lines = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      lines.push(
        <line
          key={`vertical-${i}`}
          x1={padding + cellSize * i}
          x2={padding + cellSize * i}
          y1={padding}
          y2={padding + baseBoardWidth}
          stroke="black"
          strokeWidth="1"
          index={i}
        />
      );
    }
    return lines;
  };

  const renderHorizontalLines = () => {
    const lines = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      lines.push(
        <line
          key={`horizontal-${i}`}
          x1={padding}
          x2={padding + baseBoardWidth}
          y1={padding + cellSize * i}
          y2={padding + cellSize * i}
          stroke="black"
          strokeWidth="1"
          index={i}
        />
      );
    }
    return lines;
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      for (let j = 0; j < BOARD_SIZE; j++) {
        const intersectionState = boardState[i][j];
        const intersectionColor =
          intersectionState === 1
            ? "black"
            : intersectionState === 2
            ? "white"
            : "empty";
        // empty space
        if (intersectionState === 0) {
          if (bigPoints.some(([a, b]) => a === i && b === j)) {
            dots.push(
              <circle
                key={`dot-big-${i}-${j}`}
                cx={padding + cellSize * j}
                cy={padding + cellSize * i}
                fill={intersectionColor}
                r={5}
              />
            );
          }
          // interactive circle
          dots.push(
            <circle
              key={`dot-empty-handle-${i}-${j}`}
              cx={padding + cellSize * j}
              cy={padding + cellSize * i}
              fill={player === 1 ? "black" : "white"}
              r={25}
              opacity={0}
              onClick={() => {
                handleIntersectionClick(i, j);
              }}
              onMouseMove={(event) => {
                // Set the radius to 10 when the mouse is over the circle
                event.target.setAttribute("opacity", 0.5);
              }}
              onMouseLeave={(event) => {
                // Set the radius back to 1 when the mouse leaves the circle
                event.target.setAttribute("opacity", 0);
              }}
            />
          );
        } else {
          // filled space
          dots.push(
            <circle
              key={`dot-filled-${i}-${j}`}
              cx={padding + cellSize * j}
              cy={padding + cellSize * i}
              fill={intersectionColor}
              r={25}
            />
          );
        }
      }
    }
    return dots;
  };

  return (
    <svg width={boardWidth} height={boardWidth}>
      <defs>
        <pattern
          id="wood"
          x="0"
          y="0"
          width="50"
          height="50"
          patternUnits="userSpaceOnUse"
        >
          <image
            href="https://st.depositphotos.com/2464895/3334/i/600/depositphotos_33347685-stock-photo-light-wood-texture-for-background.jpg"
            x="0"
            y="0"
            width="50"
            height="50"
            preserveAspectRatio="xMinYMin slice"
          />
        </pattern>
      </defs>
      <rect
        x="0"
        y="0"
        width={boardWidth}
        height={boardWidth}
        fill="url(#wood)"
      />
      {renderVerticalLines()}
      {renderHorizontalLines()}
      {renderDots()}
    </svg>
  );
}

export default Board;
