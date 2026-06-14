#!/usr/bin/env python3
"""
dashboard.py — generate a self-contained, auto-refreshing HTML dashboard from run_log.jsonl.

Usage:
  python scripts/dashboard.py              # writes state/dashboard.html, open it in a browser
  python scripts/dashboard.py --serve 8800 # also serves it on localhost:8800 (re-reads the log)

The page reloads the log every few seconds, so you can watch a live run. It shows: phase
timeline, agents per phase (running/done/looping), token spend + rough cost, and the gate state.
No secrets are read; only state/run_log.jsonl.
"""
from __future__ import annotations
import sys
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOG = ROOT / "state" / "run_log.jsonl"
OUT = ROOT / "state" / "dashboard.html"

# rough per-MTok prices for cost estimate only (edit to taste; not authoritative)
PRICE = {"claude-opus-4-8": (15.0, 75.0), "claude-sonnet-4-6": (3.0, 15.0)}

HTML = r"""<!doctype html><html><head><meta charset="utf-8">
<title>RoarPass Build — Live</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--line:#30363d;--fg:#e6edf3;--mut:#8b949e;
--ok:#3fb950;--run:#d29922;--err:#f85149;--acc:#58a6ff}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);
font:14px/1.5 ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;padding:24px}
h1{font-size:20px;margin:0 0 4px} .sub{color:var(--mut);margin-bottom:20px}
.phases{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.phase{flex:1;min-width:150px;background:var(--card);border:1px solid var(--line);
border-radius:10px;padding:12px}
.phase.active{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}
.phase.done{border-color:var(--ok)} .phase.gate{border-color:var(--run)}
.pname{font-weight:600} .pstat{font-size:12px;color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.agent{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px}
.agent .role{font-weight:600} .agent .meta{font-size:12px;color:var(--mut)}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.s-ok{background:var(--ok)} .s-running{background:var(--run);animation:p 1s infinite}
.s-error{background:var(--err)}
@keyframes p{50%{opacity:.3}}
.stats{display:flex;gap:24px;margin:8px 0 24px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 16px}
.stat b{font-size:20px;display:block} .gatebar{background:#21262d;border:1px solid var(--run);
border-radius:8px;padding:12px;margin-bottom:20px;display:none} h2{font-size:15px;margin:18px 0 8px}
</style></head><body>
<h1>RoarPass Build — Live Orchestration</h1>
<div class="sub" id="updated">waiting for run_log.jsonl…</div>
<div class="gatebar" id="gatebar"></div>
<div class="stats" id="stats"></div>
<h2>Phases</h2><div class="phases" id="phases"></div>
<h2>Agents</h2><div class="grid" id="agents"></div>
<script>
const PRICE=__PRICE__;
const PHASES=[["0","Bootstrap"],["1","Requirements"],["2","Design"],
["3","Implementation"],["4","Data · Test · Demo"],["5","Build Animation"]];
async function tick(){
  let text=""; try{text=await (await fetch("run_log.jsonl?"+Date.now())).text();}catch(e){}
  const lines=text.trim().split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l)}catch(e){return null}}).filter(Boolean);
  const phaseState={}, agents={}; let tin=0,tout=0,cost=0,gate=null;
  for(const e of lines){
    if(e.kind==="phase"){phaseState[e.phase]=e.status;}
    if(e.kind==="gate"){gate=e.status;}
    if(e.kind==="agent"){
      const k=e.phase+":"+e.role+":"+e.agent_id;
      agents[k]=e; tin+=e.tokens_in||0; tout+=e.tokens_out||0;
      const p=PRICE[e.model]; if(p){cost+=(e.tokens_in/1e6)*p[0]+(e.tokens_out/1e6)*p[1];}
    }
  }
  // phases
  document.getElementById("phases").innerHTML=PHASES.map(([id,name])=>{
    const st=phaseState[id]||(gate&&id==="2"?"awaiting_approval":"pending");
    let cls="phase"; if(st==="complete")cls+=" done";
    else if(st==="awaiting_approval"){cls+=" gate";}
    else if(st&&st!=="pending")cls+=" active";
    return `<div class="${cls}"><div class="pname">Phase ${id}</div>
      <div>${name}</div><div class="pstat">${st}</div></div>`;
  }).join("");
  // gate
  const gb=document.getElementById("gatebar");
  if(gate==="awaiting_approval"){gb.style.display="block";
    gb.innerHTML="⏸ <b>Awaiting your approval</b> — review the design, then resume with --approve or --revise.";}
  else if(gate==="approved"){gb.style.display="block";gb.style.borderColor="var(--ok)";
    gb.innerHTML="✔ Design approved — implementation proceeding.";}
  else gb.style.display="none";
  // stats
  document.getElementById("stats").innerHTML=
    `<div class="stat"><b>${Object.keys(agents).length}</b>agents run</div>
     <div class="stat"><b>${(tin/1000|0)}k</b>tokens in</div>
     <div class="stat"><b>${(tout/1000|0)}k</b>tokens out</div>
     <div class="stat"><b>$${cost.toFixed(2)}</b>est. cost</div>`;
  // agents (most recent first)
  const list=Object.values(agents).sort((a,b)=>(b.ts||"").localeCompare(a.ts||""));
  document.getElementById("agents").innerHTML=list.map(a=>
    `<div class="agent"><div class="role"><span class="dot s-${a.status==='ok'?'ok':a.status}"></span>${a.role}</div>
     <div class="meta">${a.agent_id} · phase ${a.phase} · r${a.round}</div>
     <div class="meta">${a.model.replace('claude-','')} · ${a.duration_s}s · ${a.tokens_out} out</div></div>`).join("");
  document.getElementById("updated").textContent="updated "+new Date().toLocaleTimeString()+
    " · "+lines.length+" log events";
}
tick(); setInterval(tick,3000);
</script></body></html>"""


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(HTML.replace("__PRICE__", json.dumps(PRICE)), encoding="utf-8")
    print(f"[dashboard] wrote {OUT} (open in a browser; it reads state/run_log.jsonl live)")


def serve(port: int):
    import http.server, socketserver, os
    build()
    os.chdir(OUT.parent)
    with socketserver.TCPServer(("", port), http.server.SimpleHTTPRequestHandler) as httpd:
        print(f"[dashboard] http://localhost:{port}/dashboard.html  (Ctrl-C to stop)")
        httpd.serve_forever()


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--serve":
        serve(int(sys.argv[2]))
    else:
        build()
