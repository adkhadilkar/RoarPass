# Workflow architecture

```
run.py (Opus 4.8 orchestrator / state machine)
  │  reads config/{models,workflow,git}.yaml ; secrets from env/.env
  │
  ├─ Phase 0 bootstrap ──────────── git push (scaffold)
  ├─ Phase 1 requirements
  │     req_chunker ─► req_explorer ×N (parallel) ─► req_consistency_reviewer ─┐ loop
  │                                                                            └─► REFINED_REQUIREMENTS.md ─ push
  ├─ Phase 2 design
  │     design_chunker ─► page_designer ×N + asset_designer ─► design_refiner (loop) ─► design_system_reviewer
  │                                                              ─► screenshots ─► DESIGN_README.md ─ push
  │     ╰────────────────────────── HUMAN GATE (only one) ───────────────────────────╮
  ├─ Phase 3 implementation                       (resumes only after --approve) ◄────╯
  │     topo waves: coder ×N ─► code_reviewer (loop) ─► merge_agent ─ feature pushes
  │                          ─► deploy_agent ─► local deploy + parallel smoke checks ─ final tag push
  └─ Phase 4 data/test/demo
        data_seeder (synthetic FIFA WC 2026) ─► test_agent ×N (functional+integration, parallel)
                                              ─► demo_agent ─► 3–4 page demo + animations ─ push
```

Fan-out is concurrency-capped (`config/workflow.yaml: fanout.max_parallel_agents`). Every
worker→reviewer step uses the generic `review_loop` in `fanout.py`, which routes feedback only
to the workers a reviewer flagged.

Model routing: Opus 4.8 for orchestration + reviewers + merge + demo; Sonnet 4.6 for high-volume
workers (explorers, page designers, coders, testers, seeder, deploy). Edit `config/models.yaml`.
