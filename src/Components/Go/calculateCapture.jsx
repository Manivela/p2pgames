export function calculateAndRemoveCapturedPieces(board, lastMove) {
  let blackCaptured = 0;
  let whiteCaptured = 0;

  function exploreGroup(x, y, color, skipLastMove = false) {
    const stack = [[x, y]];
    const visited = new Set(`${x},${y}`);
    let liberties = 0;
    const group = [];
    let containsLastMove = false;

    while (stack.length > 0) {
      const [currentX, currentY] = stack.pop();
      if (
        skipLastMove &&
        currentX === lastMove.row &&
        currentY === lastMove.col
      ) {
        containsLastMove = true;
        continue;
      }
      group.push([currentX, currentY]);

      [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ].forEach(([dx, dy]) => {
        const newX = currentX + dx;
        const newY = currentY + dy;

        if (
          newX >= 0 &&
          newX < board.length &&
          newY >= 0 &&
          newY < board[0].length
        ) {
          if (!visited.has(`${newX},${newY}`)) {
            visited.add(`${newX},${newY}`);
            if (board[newX][newY] === 0) {
              liberties += 1;
            } else if (board[newX][newY] === color) {
              stack.push([newX, newY]);
            }
          }
        }
      });
    }

    return { group, liberties, containsLastMove };
  }

  let skipLastMove = true;
  let lastMoveCaptured = false;

  while (true) {
    let anyCaptures = false;

    for (let i = 0; i < board.length; i++) {
      for (let j = 0; j < board[i].length; j++) {
        if (
          board[i][j] !== 0 &&
          !(skipLastMove && i === lastMove.row && j === lastMove.col)
        ) {
          const color = board[i][j];
          // Prevent capturing own pieces by comparing the color of the group with the last move
          if (color !== board[lastMove.row][lastMove.col]) {
            const { group, liberties, containsLastMove } = exploreGroup(
              i,
              j,
              color,
              skipLastMove
            );

            if (liberties === 0) {
              anyCaptures = true;
              group.forEach(([x, y]) => {
                board[x][y] = 0;
                if (color === 1) {
                  whiteCaptured++; // Note: Flipped the capture count to correctly increment based on the captured pieces' color
                } else {
                  blackCaptured++;
                }
              });

              if (containsLastMove) {
                lastMoveCaptured = true;
              }
            }
          }
        }
      }
    }

    if (!anyCaptures || !skipLastMove) {
      break;
    }

    if (skipLastMove && lastMoveCaptured) {
      skipLastMove = false;
    } else {
      break;
    }
  }

  return { blackCaptured, whiteCaptured, board };
}

export function checkDirectLiberties(row, col, boardState, playerPiece) {
  const directions = [
    [-1, 0], // Up
    [1, 0], // Down
    [0, -1], // Left
    [0, 1], // Right
  ];
  let hasLiberty = false;
  let enemySurroundCount = 0;
  const totalPossibleDirections = directions.length;

  for (const [dx, dy] of directions) {
    const newRow = row + dx;
    const newCol = col + dy;
    // Check if the new position is within the board boundaries
    if (
      newRow >= 0 &&
      newRow < boardState.length &&
      newCol >= 0 &&
      newCol < boardState[0].length
    ) {
      const neighbor = boardState[newRow][newCol];
      if (neighbor === 0) {
        hasLiberty = true; // Direct liberty found
        break; // No need to check further if a liberty is found
      } else if (neighbor !== playerPiece) {
        enemySurroundCount++; // Counting enemy pieces surrounding the position
      }
    } else {
      // Reducing the count of total directions to check for corners and edges
      // This effectively treats out-of-bound directions as 'not enemy', helping to manage edge and corner cases
      enemySurroundCount++; // Treat out-of-bounds as 'enemy' for the purpose of simplifying logic
    }
  }

  // A move is considered legal if it has a direct liberty or is not completely surrounded by enemy pieces
  const isLegalMove =
    hasLiberty || enemySurroundCount < totalPossibleDirections;

  return isLegalMove;
}

export function areBoardStatesEqual(board1, board2) {
  // Iterate through each row
  for (let i = 0; i < board1.length; i++) {
    // Iterate through each column in the current row
    for (let j = 0; j < board1[i].length; j++) {
      // Compare the value in the current cell of both boards
      if (board1[i][j] !== board2[i][j]) {
        return false; // Found a mismatch
      }
    }
  }

  // If all checks passed, the boards are equal
  return true;
}
