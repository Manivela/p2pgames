import { useRef, useState } from "react";
import { t } from "../i18n";

// a destructive or replacing action takes a second tap within 3s
export function Confirm({ label, onConfirm, children }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef();
  return (
    <button
      className={armed ? "armed" : ""}
      onClick={() => {
        clearTimeout(timer.current);
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {armed ? t("Sure? Tap again") : label}
      {children}
    </button>
  );
}
