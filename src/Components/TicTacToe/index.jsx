import useSound from "use-sound";
import { useVolume } from "../../hooks/useStore";
import { Table, useHeard, useTable } from "../Table";
import Sheet, { Glyph } from "./Sheet";
import bot from "./bot";
import { newGame } from "./rules";
import pen from "./assets/pen.mp3";
import "./tictactoe.css";

// the ways to play, chosen on the sheet (Table's Modes)
const MODES = {
  label: "Game",
  list: [
    { id: "classic", name: "Classic" },
    { id: "super", name: "Super" },
  ],
};

// a felt-tip on paper (made with ffmpeg, from noise): an X's two strokes,
// an O's round one, three of each, and the long one through a win; where
// each starts in pen.mp3, and how long it lasts, in ms
const PEN = {
  x0: [0, 330],
  x1: [600, 340],
  x2: [1200, 350],
  o0: [1800, 260],
  o1: [2400, 280],
  o2: [3000, 210],
  line: [3600, 420],
};

// Everyone hears a mark drawn as it's drawn (Sheet.jsx), then the big one
// over a board it takes (Super), then a win's line. A new level is heard
// as an O.
function usePen(game) {
  const { volume } = useVolume();
  const [play] = useSound(pen, { volume: 0.6 * volume, sprite: PEN });
  const scratch = (seat) =>
    play({ id: `${seat ? "o" : "x"}${Math.floor(Math.random() * 3)}` });
  useHeard(
    game?.last,
    ({ kind, cell, took }) => {
      if (kind !== "mark") return;
      const seat = game.cells[cell];
      scratch(seat);
      if (took) setTimeout(() => scratch(seat), 380);
      if (game.winner) setTimeout(() => play({ id: "line" }), took ? 800 : 380);
    },
    () => scratch(1),
  );
}

export default function TicTacToe() {
  const table = useTable("tictactoe", newGame, ["X", "O"], MODES, bot);
  usePen(table.game);
  // the sheet before a game: empty, the game chosen, no one's turn
  const blank = { ...newGame(null, [], table.mode), turn: null };
  return (
    <Table table={table} mark={(seat) => <Glyph seat={seat} />}>
      <Sheet state={table.game ?? blank} table={table} />
    </Table>
  );
}
