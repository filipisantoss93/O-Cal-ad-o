import type { Business, Category, Promotion } from "@/types/catalog";

export const categories: Category[] = [
  {
    slug: "alimentacao",
    name: "Alimentação e Bebidas",
    icon: "🍴",
    description: "Restaurantes, mercados, padarias e bebidas",
    accent: "bg-[#fff0df]",
  },
  {
    slug: "automotivo",
    name: "Automotivo",
    icon: "🚗",
    description: "Veículos, peças, oficinas e serviços",
    accent: "bg-[#e5f1ef]",
  },
  {
    slug: "moda-acessorios",
    name: "Moda e Acessórios",
    icon: "👕",
    description: "Roupas, calçados, bolsas e acessórios",
    accent: "bg-[#e9efff]",
  },
  {
    slug: "beleza-estetica",
    name: "Beleza e Estética",
    icon: "✨",
    description: "Salões, barbearias, estética e cosméticos",
    accent: "bg-[#ffe9f2]",
  },
  {
    slug: "saude-bem-estar",
    name: "Saúde e Bem-estar",
    icon: "🩺",
    description: "Clínicas, farmácias, terapias e bem-estar",
    accent: "bg-[#e5f7f2]",
  },
  {
    slug: "casa-decoracao",
    name: "Casa, Móveis e Decoração",
    icon: "🏠",
    description: "Móveis, decoração e utilidades para o lar",
    accent: "bg-[#e8f5ee]",
  },
  {
    slug: "construcao-reforma",
    name: "Construção e Reforma",
    icon: "🧱",
    description: "Materiais, ferramentas, obras e acabamentos",
    accent: "bg-[#fff4dc]",
  },
  {
    slug: "tecnologia-eletronicos",
    name: "Tecnologia e Eletrônicos",
    icon: "💻",
    description: "Informática, celulares, eletrônicos e assistência",
    accent: "bg-[#e9efff]",
  },
  {
    slug: "servicos",
    name: "Serviços",
    icon: "🛠️",
    description: "Profissionais e soluções para pessoas e empresas",
    accent: "bg-[#eef0f2]",
  },
  {
    slug: "educacao",
    name: "Educação e Cursos",
    icon: "🎓",
    description: "Escolas, cursos, idiomas e capacitação",
    accent: "bg-[#edf0ff]",
  },
  {
    slug: "esporte-lazer",
    name: "Esporte e Lazer",
    icon: "⚽",
    description: "Academias, esportes, hobbies e lazer",
    accent: "bg-[#e8f5ee]",
  },
  {
    slug: "pets",
    name: "Pets",
    icon: "🐾",
    description: "Pet shops, veterinários, banho e tosa",
    accent: "bg-[#fff0df]",
  },
  {
    slug: "infantil-bebes",
    name: "Infantil e Bebês",
    icon: "🧸",
    description: "Produtos, roupas e serviços infantis",
    accent: "bg-[#fff4dc]",
  },
  {
    slug: "festas-eventos",
    name: "Festas e Eventos",
    icon: "🎉",
    description: "Buffets, decoração, fotografia, som e espaços",
    accent: "bg-[#ffe9f2]",
  },
  {
    slug: "turismo-hospedagem",
    name: "Turismo e Hospedagem",
    icon: "🧳",
    description: "Hotéis, pousadas, agências e passeios",
    accent: "bg-[#e5f7f2]",
  },
  {
    slug: "imoveis",
    name: "Imóveis",
    icon: "🏢",
    description: "Imobiliárias, corretores, venda e locação",
    accent: "bg-[#eef0f2]",
  },
  {
    slug: "financeiro-seguros",
    name: "Financeiro, Seguros e Contabilidade",
    icon: "💳",
    description: "Contabilidade, crédito, seguros e consultoria",
    accent: "bg-[#e9efff]",
  },
  {
    slug: "transporte-logistica",
    name: "Transporte e Logística",
    icon: "🚚",
    description: "Fretes, mudanças, entregas e transporte",
    accent: "bg-[#e5f1ef]",
  },
  {
    slug: "agro-rural",
    name: "Agro e Rural",
    icon: "🌾",
    description: "Produtos, equipamentos e serviços rurais",
    accent: "bg-[#e8f5ee]",
  },
  {
    slug: "papelaria-livros-presentes",
    name: "Papelaria, Livros e Presentes",
    icon: "🎁",
    description: "Papelaria, livraria, presentes e artigos criativos",
    accent: "bg-[#fff4dc]",
  },
  {
    slug: "comunicacao-marketing",
    name: "Comunicação e Marketing",
    icon: "📣",
    description: "Marketing, publicidade, gráfica e comunicação visual",
    accent: "bg-[#ffe9f2]",
  },
  {
    slug: "industria-atacado",
    name: "Indústria, Atacado e Distribuição",
    icon: "🏭",
    description: "Fabricantes, distribuidores e fornecedores",
    accent: "bg-[#eef0f2]",
  },
  {
    slug: "outros",
    name: "Outros",
    icon: "➕",
    description: "Outros negócios e serviços locais",
    accent: "bg-[#eef0f2]",
  },
];

// O ambiente público não usa mais dados demonstrativos. Estes arrays permanecem
// vazios apenas para compatibilidade durante a migração completa para o Supabase.
export const businesses: Business[] = [];
export const promotions: Promotion[] = [];

export function getBusinessBySlug(slug: string) {
  return businesses.find((business) => business.slug === slug);
}

export function filterBusinesses(query?: string, categorySlug?: string) {
  const normalizedQuery = query?.trim().toLocaleLowerCase("pt-BR") ?? "";

  return businesses.filter((business) => {
    const matchesCategory =
      !categorySlug || business.categorySlug === categorySlug;
    const searchableText = [
      business.name,
      business.description,
      business.categoryName,
      business.neighborhood,
      ...business.tags,
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    return matchesCategory && searchableText.includes(normalizedQuery);
  });
}
