import type { Business, Category, Promotion } from "@/types/catalog";

export const categories: Category[] = [
  {
    slug: "alimentacao",
    name: "Alimentação",
    icon: "🍴",
    description: "Restaurantes, mercados e padarias",
    accent: "bg-[#fff0df]",
  },
  {
    slug: "moda",
    name: "Moda",
    icon: "👕",
    description: "Roupas, calçados e acessórios",
    accent: "bg-[#e9efff]",
  },
  {
    slug: "beleza",
    name: "Beleza",
    icon: "✨",
    description: "Salões, estética e autocuidado",
    accent: "bg-[#ffe9f2]",
  },
  {
    slug: "casa",
    name: "Casa",
    icon: "🏠",
    description: "Móveis, decoração e utilidades",
    accent: "bg-[#e8f5ee]",
  },
  {
    slug: "servicos",
    name: "Serviços",
    icon: "🔧",
    description: "Profissionais e soluções locais",
    accent: "bg-[#eef0f2]",
  },
  {
    slug: "saude",
    name: "Saúde",
    icon: "💚",
    description: "Clínicas, farmácias e bem-estar",
    accent: "bg-[#e5f7f2]",
  },
];

export const businesses: Business[] = [
  {
    id: "business-padaria-praca",
    slug: "padaria-pao-da-praca",
    name: "Pão da Praça",
    description:
      "Padaria artesanal com fornadas frescas, café e opções para o dia inteiro.",
    categorySlug: "alimentacao",
    categoryName: "Alimentação",
    neighborhood: "Centro",
    address: "Praça Central, 84",
    distance: "850 m",
    rating: 4.9,
    reviewCount: 126,
    isOpen: true,
    closesAt: "19h",
    initials: "PP",
    palette: "from-[#ef6a43] to-[#f5a640]",
    verified: true,
    tags: ["Pães artesanais", "Café", "Encomendas"],
    whatsapp: null,
    products: [
      {
        id: "pao-fermentacao",
        name: "Pão de fermentação natural",
        description: "Casca crocante e miolo macio, 500 g.",
        price: 18.9,
      },
      {
        id: "combo-cafe",
        name: "Combo café da manhã",
        description: "Café, pão na chapa e suco do dia.",
        price: 24.9,
        promotionalPrice: 19.9,
      },
    ],
  },
  {
    id: "business-oficina-avenida",
    slug: "oficina-avenida",
    name: "Oficina Avenida",
    description:
      "Manutenção preventiva, diagnóstico eletrônico e atendimento transparente.",
    categorySlug: "servicos",
    categoryName: "Serviços",
    neighborhood: "Vila Nova",
    address: "Av. das Palmeiras, 320",
    distance: "1,2 km",
    rating: 4.8,
    reviewCount: 89,
    isOpen: true,
    closesAt: "18h",
    initials: "OA",
    palette: "from-[#183a3a] to-[#2b7770]",
    verified: true,
    tags: ["Mecânica", "Diagnóstico", "Revisão"],
    whatsapp: null,
    products: [
      {
        id: "checkup",
        name: "Check-up preventivo",
        description: "Inspeção visual e eletrônica dos principais sistemas.",
        price: 149,
      },
      {
        id: "scanner",
        name: "Diagnóstico com scanner",
        description: "Leitura e análise de falhas eletrônicas.",
        price: 120,
      },
    ],
  },
  {
    id: "business-casa-bela",
    slug: "casa-bela-decor",
    name: "Casa Bela Decor",
    description:
      "Decoração afetiva, presentes e peças selecionadas para transformar a casa.",
    categorySlug: "casa",
    categoryName: "Casa",
    neighborhood: "Jardim América",
    address: "Rua das Acácias, 41",
    distance: "1,8 km",
    rating: 4.7,
    reviewCount: 54,
    isOpen: false,
    closesAt: "abre amanhã às 9h",
    initials: "CB",
    palette: "from-[#9f5968] to-[#dd9b7c]",
    verified: false,
    tags: ["Decoração", "Presentes", "Utilidades"],
    whatsapp: null,
    products: [
      {
        id: "kit-vasos",
        name: "Kit de vasos cerâmicos",
        description: "Três peças em tamanhos diferentes.",
        price: 89.9,
      },
      {
        id: "luminaria-mesa",
        name: "Luminária de mesa",
        description: "Luz quente e acabamento em madeira.",
        price: 139.9,
      },
    ],
  },
  {
    id: "business-studio-maria",
    slug: "studio-maria",
    name: "Studio Maria",
    description:
      "Cabelo, unhas e tratamentos de beleza com hora marcada e cuidado próximo.",
    categorySlug: "beleza",
    categoryName: "Beleza",
    neighborhood: "Centro",
    address: "Rua do Comércio, 215",
    distance: "2,1 km",
    rating: 5,
    reviewCount: 42,
    isOpen: true,
    closesAt: "20h",
    initials: "SM",
    palette: "from-[#7c3d71] to-[#d66e9e]",
    verified: true,
    tags: ["Cabelo", "Manicure", "Agendamento"],
    whatsapp: null,
    products: [
      {
        id: "escova",
        name: "Escova modelada",
        description: "Finalização personalizada para seu tipo de cabelo.",
        price: 65,
      },
      {
        id: "manicure",
        name: "Manicure completa",
        description: "Cuidado, esmaltação e acabamento.",
        price: 42,
      },
    ],
  },
];

export const promotions: Promotion[] = [
  {
    id: "promotion-breakfast",
    businessSlug: "padaria-pao-da-praca",
    businessName: "Pão da Praça",
    title: "Café da manhã completo",
    description: "De R$ 24,90 por R$ 19,90 durante a semana.",
    badge: "20% OFF",
    symbol: "☕",
    palette: "bg-[#fff0df]",
    expiresLabel: "Até sexta-feira",
  },
  {
    id: "promotion-checkup",
    businessSlug: "oficina-avenida",
    businessName: "Oficina Avenida",
    title: "Check-up antes de viajar",
    description: "Inspeção de 20 itens com diagnóstico eletrônico.",
    badge: "DESTAQUE",
    symbol: "🚗",
    palette: "bg-[#e5f1ef]",
    expiresLabel: "Vagas limitadas",
  },
  {
    id: "promotion-beauty",
    businessSlug: "studio-maria",
    businessName: "Studio Maria",
    title: "Terça da beleza",
    description: "Escova modelada com hidratação inclusa.",
    badge: "COMBO",
    symbol: "💇‍♀️",
    palette: "bg-[#ffe9f2]",
    expiresLabel: "Toda terça-feira",
  },
];

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
