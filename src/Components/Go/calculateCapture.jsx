export function calculateAndRemoveCapturedPieces(board) {
  let blackCaptured = 0;
  let whiteCaptured = 0;

  // Loop through each position on the board
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      // If the position is empty, continue to the next position
      if (board[i][j] === 0) {
        continue;
      }

      // Check if the position is surrounded by the opposite color
      let surrounded = true;
      if (i > 0 && board[i - 1][j] !== board[i][j]) {
        surrounded = false;
      }
      if (i < board.length - 1 && board[i + 1][j] !== board[i][j]) {
        surrounded = false;
      }
      if (j > 0 && board[i][j - 1] !== board[i][j]) {
        surrounded = false;
      }
      if (j < board[i].length - 1 && board[i][j + 1] !== board[i][j]) {
        surrounded = false;
      }

      // If the position is surrounded, add it to the captured count
      if (surrounded) {
        if (board[i][j] === 1) {
          blackCaptured++;
        } else {
          whiteCaptured++;
        }

        // Remove the captured piece from the board
        board[i][j] = 0;
        console.log("captured");
      }
    }
  }
}
