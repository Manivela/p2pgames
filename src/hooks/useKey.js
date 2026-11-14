import { useEffect, useRef } from "react";

// A key that does what a button does, from anywhere but a text field: " "
// Space, else a letter, "mod+" before it with ⌘ or Ctrl held (`MOD` names
// it on the keycap); `press` null while there's nothing to press. Its
// keycap shows on the button (rack.css, table.css) while the table menu's
// Key hints are on (useKeyHints).
export function useKey(key, press) {
  const latest = useRef();
  latest.current = press;
  useEffect(() => {
    const mod = key.startsWith("mod+");
    const k = mod ? key.slice(4) : key;
    const onKey = (e) => {
      const go = latest.current;
      const hit = k === " " ? e.code === "Space" : e.key?.toLowerCase() === k;
      const held = e.ctrlKey || e.metaKey;
      // ⇧ with ⌘Z is redo, never undo
      if (!go || !hit || e.repeat || e.altKey || held !== mod) return;
      if (mod && e.shiftKey) return;
      if (e.target.closest?.("input, textarea, select, [contenteditable]")) {
        return;
      }
      e.preventDefault(); // nor scrolls, nor presses a focused button
      go();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [key]);
}

export const MOD = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform)
  ? "⌘"
  : "Ctrl ";

// Escape closes what opened last, a dialog before the menu it opened
// from: `close`, null while it's shut
const open = [];
globalThis.addEventListener?.("keydown", (e) => {
  if (e.key === "Escape") open.at(-1)?.current();
});
export function useEscape(close) {
  const latest = useRef(close);
  latest.current = close;
  const on = !!close;
  useEffect(() => {
    if (!on) return;
    open.push(latest);
    return () => open.splice(open.indexOf(latest), 1);
  }, [on]);
}
