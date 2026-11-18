# The renderer's long tasks and dropped frames by the phase okey.mjs marked:
# what a discard costs, the recording's own (DevTools starting and stopping
# the profiler) left out.
#   python3 -I perf/tasks.py <out-dir>/trace.json [min-ms, default 5]
import json, sys

d = json.load(open(sys.argv[1]))
least = float(sys.argv[2]) if len(sys.argv) > 2 else 5
ev = d["traceEvents"] if isinstance(d, dict) else d
names = {
    (e["pid"], e["tid"]): e["args"]["name"]
    for e in ev
    if e.get("ph") == "M" and e.get("name") == "thread_name"
}
marks = sorted(
    (e["ts"], e["name"][6:]) for e in ev if e.get("name", "").startswith("phase:")
)
phase = lambda ts: max([m for m in marks if m[0] <= ts], default=(0, "pre"))[1]
devtools = [
    e["ts"]
    for e in ev
    if e.get("name") == "Receive mojo message"
    and "DevToolsSession" in json.dumps(e.get("args", {}))
]
ours = lambda a, b: any(a <= t <= b for t in devtools)
tasks = [
    (phase(e["ts"]), round(e["dur"] / 1000, 1))
    for e in ev
    if e.get("ph") == "X"
    and names.get((e["pid"], e["tid"])) == "CrRendererMain"
    and e["name"] == "ThreadControllerImpl::RunTask"
    and e["dur"] > least * 1000
    and not ours(e["ts"], e["ts"] + e["dur"])
]
print(f"tasks over {least:g} ms:", [t for t in tasks if t[0] not in ("pre", "load")])
frames = sorted(e["ts"] for e in ev if e.get("name") == "FireAnimationFrame")
print(
    "frames over 20 ms apart:",
    [
        (phase(b), round((b - a) / 1000, 1))
        for a, b in zip(frames, frames[1:])
        if b - a > 20000 and not ours(a, b)
    ],
)
