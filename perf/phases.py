# Each phase okey.mjs marked in its trace: paints, raster tasks, and the
# renderer main and GPU threads busy per second.
#   python3 -I perf/phases.py <out-dir>/trace.json
import json, sys, collections
d = json.load(open(sys.argv[1]))
ev = d['traceEvents'] if isinstance(d, dict) else d
names = {(e['pid'], e['tid']): e['args']['name'] for e in ev if e.get('ph') == 'M' and e.get('name') == 'thread_name'}
marks = sorted((e['ts'], e['name'][6:]) for e in ev if e.get('name', '').startswith('phase:') and e.get('ph') in ('R', 'I', 'n', 'b', 'X'))
marks = list(dict((n, (t, n)) for t, n in marks).values())
marks.sort()
end = max(e['ts'] for e in ev if e.get('ts'))
def phase(ts):
    p = None
    for t, n in marks:
        if ts >= t: p = n
    return p
rows = collections.defaultdict(lambda: collections.Counter())
for e in ev:
    if e.get('ph') != 'X' or not e.get('ts'): continue
    th = names.get((e['pid'], e['tid']), '')
    p = phase(e['ts'])
    if not p: continue
    n = e['name']
    if n == 'Paint': rows[p]['paint'] += 1; rows[p]['docPaint'] += e['args'].get('data', {}).get('nodeName') == '#document'
    elif n == 'RasterTask': rows[p]['raster'] += 1; rows[p]['rasterMs'] += e['dur'] / 1000
    elif n == 'ThreadControllerImpl::RunTask' and th == 'CrGpuMain': rows[p]['gpuMs'] += e['dur'] / 1000; rows[p]['gpuMax'] = max(rows[p]['gpuMax'], e['dur'] / 1000)
    elif n == 'ThreadControllerImpl::RunTask' and th == 'CrRendererMain': rows[p]['mainMs'] += e['dur'] / 1000; rows[p]['mainMax'] = max(rows[p]['mainMax'], e['dur'] / 1000)
spans = {n: ((marks[i + 1][0] if i + 1 < len(marks) else end) - t) / 1e6 for i, (t, n) in enumerate(marks)}
print(f"{'phase':12} {'secs':>5} {'paint/s':>8} {'doc/s':>6} {'raster/s':>9} {'rasterMs/s':>10} {'gpuMs/s':>8} {'gpuMax':>7} {'mainMs/s':>9} {'mainMax':>8}")
for t, n in marks:
    r, s = rows[n], spans[n] or 1
    print(f"{n:12} {s:5.1f} {r['paint']/s:8.0f} {r['docPaint']/s:6.0f} {r['raster']/s:9.0f} {r['rasterMs']/s:10.1f} {r['gpuMs']/s:8.0f} {r['gpuMax']:7.0f} {r['mainMs']/s:9.0f} {r['mainMax']:8.0f}")
