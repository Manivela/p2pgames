import { useEffect, useState } from "react";

// The build this page runs (its time, vite.config.js); in development a
// test can play a newer one (sessionStorage "build")
export const BUILD =
  (import.meta.env.DEV && Number(sessionStorage.getItem("build"))) || __BUILD__;

// The newest build the site serves, asked on load, whenever you come back
// to the tab and every 10 minutes (a table left open all evening)
export function useSiteBuild() {
  const [build, setBuild] = useState(0);
  useEffect(() => {
    const check = () =>
      document.visibilityState === "visible" &&
      fetch("/version.json", { cache: "no-store" })
        .then((r) => r.json())
        .then((v) => setBuild(Number(v.build) || 0))
        .catch(() => {}); // offline, or the dev server (no version.json)
    check();
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      clearInterval(timer);
    };
  }, []);
  return build;
}
