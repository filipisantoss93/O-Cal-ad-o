alter table public.businesses
  add column if not exists website_button_label text;

alter table public.businesses
  add constraint businesses_website_button_label_length_check
  check (
    website_button_label is null
    or char_length(btrim(website_button_label)) between 1 and 32
  );
