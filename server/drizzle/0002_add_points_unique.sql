-- Phase 6: points_ledger に UNIQUE制約を追加して二重加算を防ぐ
-- type='earned_accepted' かつ related_job_id IS NOT NULL の組み合わせで一意にする

CREATE UNIQUE INDEX IF NOT EXISTS idx_points_earned_job
  ON points_ledger (related_job_id, type)
  WHERE type = 'earned_accepted' AND related_job_id IS NOT NULL;
