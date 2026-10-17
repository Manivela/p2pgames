import { expect, test } from "vitest";
import lock from "./package-lock.json";

// npm on a Mac can drop other platforms' builds from the lockfile
// (npm/cli#4828). Cloudflare builds on Linux, and without them every
// deploy fails without anyone noticing. Fix: re-resolve the packages
// listed here with no node_modules around.
test("the lockfile lists every platform's build of each package", () => {
  const names = new Set(
    Object.keys(lock.packages).map((path) =>
      path.split("node_modules/").at(-1),
    ),
  );
  const missing = Object.entries(lock.packages).flatMap(([path, pkg]) =>
    Object.keys(pkg.optionalDependencies ?? {})
      .filter((dep) => !names.has(dep))
      .map((dep) => `${path} -> ${dep}`),
  );
  expect(missing).toEqual([]);
});
