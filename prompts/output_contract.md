# Output contract conventions

Agents return blocks the orchestrator parses:

- File-producing agents:
  ===FILE: <relative/path>===
  <file contents>
  ===END FILE===

- Decision/review agents return JSON:
  ===JSON===
  { ... }
  ===END JSON===

- Loop-gating reviewers must include:
  {"signed_off": true|false, "round": N,
   "findings": [{"severity":"high|medium|low","target":"<slug>","issue":"...","fix":"..."}]}

No text outside these blocks.
