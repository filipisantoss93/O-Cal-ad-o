begin;

alter table public.businesses
  add column tags text[] not null default '{}'::text[];

alter table public.businesses
  add constraint businesses_tags_limit_check
    check (cardinality(tags) <= 12),
  add constraint businesses_tags_no_empty_check
    check (array_position(tags, '') is null);

create index businesses_tags_gin_idx
  on public.businesses using gin (tags);

-- Consolida as categorias automotivas específicas em uma categoria ampla.
update public.businesses
set category_id = 2
where category_id = 3;

delete from public.categories where id = 3;

update public.categories
set slug = 'alimentacao', name = 'Alimentação e Bebidas',
    description = 'Restaurantes, lanchonetes, mercados, padarias, bebidas e alimentação em geral.',
    icon = '🍴', display_order = 10, is_active = true
where id = 1;

update public.categories
set slug = 'automotivo', name = 'Automotivo',
    description = 'Veículos, peças, acessórios, manutenção, estética e serviços automotivos.',
    icon = '🚗', display_order = 20, is_active = true
where id = 2;

update public.categories
set slug = 'moda-acessorios', name = 'Moda e Acessórios',
    description = 'Roupas, calçados, bolsas, joias, relógios e acessórios.',
    icon = '👕', display_order = 30, is_active = true
where id = 4;

update public.categories
set slug = 'beleza-estetica', name = 'Beleza e Estética',
    description = 'Salões, barbearias, estética, cosméticos e autocuidado.',
    icon = '✨', display_order = 40, is_active = true
where id = 5;

update public.categories
set slug = 'saude-bem-estar', name = 'Saúde e Bem-estar',
    description = 'Clínicas, consultórios, farmácias, terapias e bem-estar.',
    icon = '🩺', display_order = 50, is_active = true
where id = 6;

update public.categories
set slug = 'casa-decoracao', name = 'Casa, Móveis e Decoração',
    description = 'Móveis, decoração, utilidades, eletrodomésticos e itens para o lar.',
    icon = '🏠', display_order = 60, is_active = true
where id = 9;

update public.categories
set slug = 'construcao-reforma', name = 'Construção e Reforma',
    description = 'Materiais, ferramentas, acabamentos e soluções para obras e reformas.',
    icon = '🧱', display_order = 70, is_active = true
where id = 7;

update public.categories
set slug = 'tecnologia-eletronicos', name = 'Tecnologia e Eletrônicos',
    description = 'Informática, celulares, eletrônicos, acessórios e assistência técnica.',
    icon = '💻', display_order = 80, is_active = true
where id = 8;

update public.categories
set slug = 'servicos', name = 'Serviços',
    description = 'Prestadores, profissionais e soluções para pessoas e empresas.',
    icon = '🛠️', display_order = 90, is_active = true
where id = 10;

insert into public.categories (slug, name, description, icon, display_order, is_active)
values
  ('educacao', 'Educação e Cursos', 'Escolas, cursos, reforço, idiomas, treinamentos e capacitação.', '🎓', 100, true),
  ('esporte-lazer', 'Esporte e Lazer', 'Academias, esportes, hobbies, lazer e atividades recreativas.', '⚽', 110, true),
  ('pets', 'Pets', 'Pet shops, banho e tosa, veterinários e produtos para animais.', '🐾', 120, true),
  ('infantil-bebes', 'Infantil e Bebês', 'Produtos, roupas, serviços e atividades para crianças e bebês.', '🧸', 130, true),
  ('festas-eventos', 'Festas e Eventos', 'Buffets, decoração, fotografia, som, espaços e serviços para eventos.', '🎉', 140, true),
  ('turismo-hospedagem', 'Turismo e Hospedagem', 'Hotéis, pousadas, agências, passeios e serviços para visitantes.', '🧳', 150, true),
  ('imoveis', 'Imóveis', 'Imobiliárias, corretores, locação, venda e serviços relacionados a imóveis.', '🏢', 160, true),
  ('financeiro-seguros', 'Financeiro, Seguros e Contabilidade', 'Contabilidade, crédito, seguros, consultoria e serviços financeiros.', '💳', 170, true),
  ('transporte-logistica', 'Transporte e Logística', 'Fretes, mudanças, entregas, transporte e soluções logísticas.', '🚚', 180, true),
  ('agro-rural', 'Agro e Rural', 'Produtos, equipamentos e serviços para agronegócio e atividades rurais.', '🌾', 190, true),
  ('papelaria-livros-presentes', 'Papelaria, Livros e Presentes', 'Papelaria, livraria, presentes, lembranças e artigos criativos.', '🎁', 200, true),
  ('comunicacao-marketing', 'Comunicação e Marketing', 'Marketing, publicidade, gráfica, comunicação visual e produção de conteúdo.', '📣', 210, true),
  ('industria-atacado', 'Indústria, Atacado e Distribuição', 'Fabricantes, distribuidores, fornecedores e vendas em atacado.', '🏭', 220, true),
  ('outros', 'Outros', 'Negócios que não se encaixam nas categorias principais.', '➕', 230, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    updated_at = now();

commit;
