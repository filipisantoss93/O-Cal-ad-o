create index business_data_imports_started_by_idx
  on public.business_data_imports (started_by)
  where started_by is not null;

create index business_source_records_matched_business_id_idx
  on public.business_source_records (matched_business_id)
  where matched_business_id is not null;

create index business_duplicate_candidates_business_b_id_idx
  on public.business_duplicate_candidates (business_b_id)
  where business_b_id is not null;

create index business_duplicate_candidates_resolved_by_idx
  on public.business_duplicate_candidates (resolved_by)
  where resolved_by is not null;

create index business_merge_history_duplicate_candidate_id_idx
  on public.business_merge_history (duplicate_candidate_id)
  where duplicate_candidate_id is not null;

create index business_merge_history_executed_by_idx
  on public.business_merge_history (executed_by)
  where executed_by is not null;
