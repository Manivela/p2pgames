import { useEffect, useRef, useState } from "react";
import { useDismiss } from "../hooks/useKey";
import { t } from "../i18n";
import "./ScoreSheet.css";

// A game's score sheet, at every table that keeps one (Okey's rounds,
// Batak's deals): an icon (a podium) that opens it, or Tab held; the
// players along the top (`columns`: { key, head }), a row a round (`rows`:
// { key, label, cells, className }, "later" for one still to come,
// "running" for the one being played), the totals at the foot, the
// `lead`ing one marked. Where it sits is the table's.
export function ScoreSheet({ columns, rows, totals, lead }) {
  // Tab held opens the sheet till it's let go, as in many games; Shift+Tab
  // still moves the focus, and Tab does in a field, a dialog or a menu
  const sheet = useRef();
  useEffect(() => {
    let held = false;
    const down = (e) => {
      if (e.key !== "Tab" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)
        return;
      const skip =
        "input, textarea, select, [contenteditable], .dialog, .menu, .site-menu";
      if (e.target.closest?.(skip)) return;
      e.preventDefault();
      if (held || sheet.current.open) return;
      sheet.current.open = held = true;
    };
    const up = (e) => {
      if (e.type === "keyup" && e.key !== "Tab") return;
      if (held) sheet.current.open = held = false;
    };
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("blur", up); // let go in another window
    return () => {
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("blur", up);
    };
  }, []);
  // open, it closes as a menu does: Escape, or a press anywhere else
  const [shown, setShown] = useState(false);
  useDismiss(sheet, shown && (() => (sheet.current.open = false)));
  return (
    // a tap away: a round's end shows its scores with the hands, the end
    // of the game who won, and an open sheet would cover the next step
    <details
      className="scores"
      ref={sheet}
      onToggle={(e) => setShown(e.currentTarget.open)}
    >
      {/* an icon: where it sits, there's room for little */}
      <summary aria-label={t("Scores")} title={t("Scores")}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M1 8h4.4v6H1zM5.8 3h4.4v11H5.8zM10.6 10H15v4h-4.4z" />
        </svg>
        <kbd>Tab</kbd>
      </summary>
      <div className="sheet">
        <table>
          <thead>
            <tr>
              <th />
              {columns.map((c) => (
                <th key={c.key}>{c.head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.className ?? ""}>
                <th>{r.label}</th>
                {r.cells.map((cell, i) => (
                  <td key={columns[i].key}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>{t("Total")}</th>
              {totals.map((value, i) => (
                <td
                  key={columns[i].key}
                  className={value !== null && value === lead ? "lead" : ""}
                >
                  {value}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </details>
  );
}
