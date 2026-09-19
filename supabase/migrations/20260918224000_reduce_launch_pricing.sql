-- Precos de lancamento para acelerar aquisicao de comerciantes.
-- Mantem os produtos/planos existentes e altera somente os valores.

update public.billing_plan_prices
set
  price_cents = case billing_cycle
    when 'monthly' then 1990
    when 'semiannual' then 9990
    when 'annual' then 17990
    else price_cents
  end,
  updated_at = now()
where plan_code = 'pro'
  and billing_cycle in ('monthly', 'semiannual', 'annual');

update public.billing_products
set
  price_cents = case code
    when 'promo_5' then 490
    when 'promo_10' then 790
    when 'promo_20' then 1290
    when 'promo_50' then 2490
    else price_cents
  end,
  updated_at = now()
where code in ('promo_5', 'promo_10', 'promo_20', 'promo_50');

update public.highlight_packages
set
  price_cents = case code
    when 'banner_7' then 2990
    when 'banner_15' then 4990
    when 'banner_30' then 7990
    else price_cents
  end,
  updated_at = now()
where code in ('banner_7', 'banner_15', 'banner_30');
