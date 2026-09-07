create index highlight_campaigns_creative_reviewed_by_idx
  on public.highlight_campaigns(creative_reviewed_by)
  where creative_reviewed_by is not null;
