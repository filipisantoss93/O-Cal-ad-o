alter table public.highlight_campaigns
  add column provider_payment_url text
  check (provider_payment_url is null or char_length(provider_payment_url) <= 2000);
