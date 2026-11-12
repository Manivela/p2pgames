import { Table, useHeard, useTable, useTok } from "../Table";
import { t } from "../../i18n";
import Board from "./Board";
import bot from "./bot";
import { SIZE, SIZES, newGame } from "./rules";
import "./go.css";

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
  const table = useTable(
    "go",
    newGame,
    ["Black", "White"],
    // the board's size
    String(SIZE),
    bot,
  );
  // the board before a game: empty, the size chosen, no one's turn
  const state = table.game ?? { ...newGame(null, [], table.mode), turn: null };
  useStoneSounds(table.game);
  return (
    <Table
      table={table}
      mark={(seat) => <i className={`go-dot ${seat ? "white" : "black"}`} />}
      info={(seat) => ({ value: state.taken[seat], title: t("Prisoners") })}
      // the size, the rules the same on each: a setting, not a game of
      // its own in the site's menu
      options={
        table.setMode && (
          <label className="facing">
            {t("Board")}
            <select
              value={table.mode}
              onChange={(e) => table.setMode(e.target.value)}
            >
              {SIZES.map((n) => (
                <option key={n} value={n}>{`${n}×${n}`}</option>
              ))}
            </select>
          </label>
        )
      }
    >
      <Board state={state} table={table} />
    </Table>
  );
}
