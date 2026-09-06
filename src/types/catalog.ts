export type Category = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  accent: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  promotionalPrice?: number;
};

export type Business = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  neighborhood: string;
  address: string;
  distance: string;
  rating: number;
  reviewCount: number;
  isOpen: boolean;
  alwaysOpen?: boolean;
  hoursAvailable?: boolean;
  closesAt: string;
  initials: string;
  palette: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  verified: boolean;
  tags: string[];
  whatsapp: string | null;
  directionsUrl?: string | null;
  products: Product[];
};

export type Promotion = {
  id: string;
  businessSlug: string;
  businessName: string;
  title: string;
  description: string;
  badge: string;
  symbol: string;
  palette: string;
  expiresLabel: string;
};
