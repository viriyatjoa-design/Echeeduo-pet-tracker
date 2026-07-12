-- Milestone AI, phase 2: automatic stool/urine photo analysis (owner-requested).
-- Stores the AI's observation text on the litter log so it persists in the
-- journal and can be refreshed. Safe to run any time; run AFTER 001-003.

alter table litter_logs
  add column if not exists ai_analysis text,
  add column if not exists ai_analyzed_at timestamptz;
