export type Category = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  accent: string;
};

export type CatalogPriceMode = "fixed" | "from" | "consult";

export type Product = {
  id: string;
  kind: "product" | "service";
  priceMode: CatalogPriceMode;
  name: string;
  description: string;
  price: number | null;
  promotionalPrice?: number;
  imageUrl?: string | null;
  isFeatured?: boolean;
};

export type FeaturedCatalogItem = {
  id: string;
  businessSlug: string;
  businessName: string;
  kind: "product" | "service";
  priceMode: CatalogPriceMode;
  name: string;
  description: string;
  price: number | null;
  promotionalPrice?: number;
  imageUrl?: string | null;
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
  isSponsored?: boolean;
  highlightCampaignId?: number | null;
  sponsoredPlacement?: "city" | "category" | "combo" | null;
  tags: string[];
  whatsapp: string | null;
  directionsUrl?: string | null;
  appleMapsUrl?: string | null;
  wazeUrl?: string | null;
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
  originalPrice?: number | null;
  offerPrice?: number;
  imageUrl?: string | null;
  isFeatured?: boolean;
};
