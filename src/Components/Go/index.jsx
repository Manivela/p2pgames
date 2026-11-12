import { Table, useHeard, useTable, useTok } from "../Table";
import { t } from "../../i18n";
import Board from "./Board";
import { SIZES, newGame } from "./rules";
import "./go.css";

// the board's sizes, chosen in ⋯ (Table)
const MODES = {
  label: "Board",
  list: SIZES.map((n) => ({ id: String(n), name: `${n}×${n}` })),
};

// Everyone hears a stone put down, and the ones it takes, each a tok,
// dropped in the lid one after another. A new level is heard as a stone.
function useStoneSounds(game) {
  const tok = useTok();
  useHeard(
    game?.last,
    ({ kind, off }) => {
      if (kind !== "stone") return;
      tok();
      off.slice(0, 4).forEach((_, i) => setTimeout(tok, 250 + i * 110));
    },
    tok,
  );
}

export default function Go() {
  const table = useTable("go", newGame, ["Black", "White"], MODES);
  // the board before a game: empty, the size chosen, no one's turn
  const state = table.game ?? { ...newGame(null, [], table.mode), turn: null };
  useStoneSounds(table.game);
  return (
    <Table
      table={table}
      mark={(seat) => <i className={`go-dot ${seat ? "white" : "black"}`} />}
      info={(seat) => ({ value: state.taken[seat], title: t("Prisoners") })}
    >
      <Board state={state} table={table} />
    </Table>
  );
}
