import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  deleteCatalogItemAction,
  saveCatalogItemAction,
  setFeaturedCatalogItemAction,
  toggleCatalogItemAction,
} from "@/app/painel/catalogo/actions";
import {
  ArrowRightIcon,
  SparklesIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
} from "@/components/icons";
import { getMerchantWorkspace } from "@/lib/merchant/dal";
import { publicMediaUrl } from "@/lib/merchant/media";

export const metadata: Metadata = { title: "Produtos e serviços" };

type CatalogPageProps = {
  searchParams: Promise<{ loja?: string; erro?: string; sucesso?: string }>;
};

function moneyInput(value: number | null) {
  if (value === null) return "";
  return Number(value).toFixed(2).replace(".", ",");
}

const errorMessages: Record<string, string> = {
  loja_invalida: "Selecione uma loja válida.",
  item_invalido: "O item selecionado não foi encontrado.",
  salvar_item: "Não foi possível salvar o item. Revise os dados e tente novamente.",
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const { supabase, businesses } = await getMerchantWorkspace("/painel/catalogo");

  if (businesses.length === 0) {
    return (
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
          Vitrine
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
          Primeiro, cadastre sua loja.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
          Produtos e serviços precisam estar ligados a uma vitrine digital.
        </p>
        <Link
          href="/painel/loja"
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-black text-white"
        >
          Cadastrar loja
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    );
  }

  const requestedId = Number(params.loja);
  const business =
    businesses.find(
      (item) => Number.isSafeInteger(requestedId) && item.id === requestedId,
    ) ?? businesses[0];
  const { data: items, error } = await supabase
    .from("catalog_items")
    .select(
      "id, kind, name, description, price, promotional_price, image_path, is_active, is_featured, created_at",
    )
    .eq("business_id", business.id)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar produtos e serviços.");

  return (
    <div>
      <div className="flex items-start gap-4">
        <span className="hidden size-12 place-items-center rounded-2xl bg-accent/25 text-ink sm:grid">
          <TagIcon className="size-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">
            Sua vitrine
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-ink sm:text-4xl">
            Produtos e serviços
          </h1>
          <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
            Cadastre o que sua loja vende e escolha um item para ganhar destaque na página inicial da cidade.
          </p>
        </div>
      </div>

      <section className="mt-7 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto">
          {businesses.map((item) => (
            <Link
              key={item.id}
              href={`/painel/catalogo?loja=${item.id}`}
              className={`min-w-48 rounded-xl border px-4 py-3 transition ${
                item.id === business.id
                  ? "border-brand/35 bg-brand/8"
                  : "border-line bg-canvas hover:border-brand/25"
              }`}
            >
              <span className="block truncate text-sm font-black text-ink">{item.name}</span>
              <span className="mt-1 block text-xs font-bold text-muted">
                {item.billing_suspended ? "Suspensa pelo plano" : "Gerenciar vitrine"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {params.erro && errorMessages[params.erro] ? (
        <p role="alert" className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-4 text-sm font-bold text-brand-dark">
          {errorMessages[params.erro]}
        </p>
      ) : null}
      {params.sucesso === "item_salvo" ? (
        <p role="status" className="mt-6 rounded-2xl border border-positive/20 bg-positive-soft p-4 text-sm font-bold text-positive">
          Item salvo na vitrine.
        </p>
      ) : null}

      {business.billing_suspended ? (
        <div className="mt-6 rounded-2xl border border-brand/20 bg-brand/8 p-5">
          <p className="font-black text-brand-dark">Esta loja está suspensa pelo plano.</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Os itens continuam salvos, mas deixam de aparecer ao público até a regularização.
          </p>
        </div>
      ) : null}

      <section className="mt-8 rounded-[2rem] border border-line bg-surface p-5 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand-dark">
            <StoreIcon className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Novo item</p>
            <h2 className="mt-1 text-2xl font-black text-ink">Adicionar à vitrine</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Marque “Destacar” para colocar este produto ou serviço no espaço de destaque da cidade. Apenas um item por loja fica destacado por vez.
            </p>
          </div>
        </div>

        <form action={saveCatalogItemAction} encType="multipart/form-data" className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="business_id" value={business.id} />
          <label className="text-sm font-black text-ink">
            Tipo
            <select name="kind" defaultValue="product" className="mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-semibold">
              <option value="product">Produto</option>
              <option value="service">Serviço</option>
            </select>
          </label>
          <label className="text-sm font-black text-ink">
            Nome
            <input name="name" minLength={2} maxLength={160} required className="mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-semibold" placeholder="Ex.: Troca de óleo completa" />
          </label>
          <label className="text-sm font-black text-ink sm:col-span-2">
            Descrição
            <textarea name="description" maxLength={1200} rows={3} className="mt-1 w-full rounded-xl border border-line bg-white p-3 font-semibold" placeholder="Explique o produto ou serviço de forma objetiva." />
          </label>
          <label className="text-sm font-black text-ink">
            Preço
            <input name="price" inputMode="decimal" required className="mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-semibold" placeholder="99,90" />
          </label>
          <label className="text-sm font-black text-ink">
            Preço promocional <span className="font-semibold text-muted">(opcional)</span>
            <input name="promotional_price" inputMode="decimal" className="mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 font-semibold" placeholder="79,90" />
          </label>
          <label className="text-sm font-black text-ink sm:col-span-2">
            Imagem <span className="font-semibold text-muted">(opcional, até 5 MB)</span>
            <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" className="mt-1 block w-full rounded-xl border border-line bg-white p-3 text-sm" />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-4 text-sm font-black text-ink">
            <input type="checkbox" name="is_active" defaultChecked className="size-4" />
            Publicar na vitrine
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-accent-dark/20 bg-accent/20 p-4 text-sm font-black text-ink">
            <input type="checkbox" name="is_featured" className="size-4" />
            <StarIcon className="size-4" />
            Destacar este item
          </label>
          <button className="min-h-12 rounded-xl bg-ink px-5 text-sm font-black text-white sm:col-span-2">
            Salvar produto ou serviço
          </button>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-brand-dark">Vitrine atual</p>
            <h2 className="mt-1 text-2xl font-black text-ink">Itens cadastrados</h2>
          </div>
          <span className="rounded-full bg-canvas px-3 py-1.5 text-xs font-black text-muted">
            {(items ?? []).length} item{(items ?? []).length === 1 ? "" : "s"}
          </span>
        </div>

        {(items ?? []).length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
            <SparklesIcon className="mx-auto size-6 text-muted" />
            <p className="mt-3 font-black text-ink">Sua vitrine ainda não tem produtos ou serviços.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {(items ?? []).map((item) => {
              const imageUrl = publicMediaUrl(supabase, item.image_path);
              return (
                <article key={item.id} className={`rounded-3xl border bg-surface p-5 shadow-sm ${item.is_featured ? "border-accent-dark/30" : "border-line"}`}>
                  <div className="flex gap-4">
                    <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-canvas text-xl font-black text-muted">
                      {imageUrl ? (
                        <Image src={imageUrl} alt={item.name} fill sizes="80px" className="object-cover" />
                      ) : item.kind === "service" ? "SV" : "PR"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-brand-dark">
                          {item.kind === "service" ? "Serviço" : "Produto"}
                        </span>
                        {item.is_featured ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2 py-1 text-[0.65rem] font-black text-ink">
                            <StarIcon className="size-3" /> DESTAQUE
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-1 truncate text-lg font-black text-ink">{item.name}</h3>
                      <p className="mt-1 text-sm font-bold text-muted">
                        {item.promotional_price !== null ? (
                          <><span className="mr-2 line-through">R$ {moneyInput(item.price)}</span>R$ {moneyInput(item.promotional_price)}</>
                        ) : `R$ ${moneyInput(item.price)}`}
                      </p>
                      <p className="mt-1 text-xs font-bold text-muted">{item.is_active ? "Publicado" : "Pausado"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <form action={setFeaturedCatalogItemAction}>
                      <input type="hidden" name="business_id" value={business.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="next_featured" value={item.is_featured ? "false" : "true"} />
                      <button className="min-h-10 w-full rounded-xl border border-accent-dark/20 bg-accent/15 px-3 text-xs font-black text-ink">
                        {item.is_featured ? "Remover destaque" : "Destacar item"}
                      </button>
                    </form>
                    <form action={toggleCatalogItemAction}>
                      <input type="hidden" name="business_id" value={business.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="next_active" value={item.is_active ? "false" : "true"} />
                      <button className="min-h-10 w-full rounded-xl border border-line bg-canvas px-3 text-xs font-black text-ink">
                        {item.is_active ? "Pausar" : "Publicar"}
                      </button>
                    </form>
                  </div>

                  <details className="mt-3 rounded-2xl border border-line bg-canvas p-4">
                    <summary className="cursor-pointer text-sm font-black text-ink">Editar item</summary>
                    <form action={saveCatalogItemAction} encType="multipart/form-data" className="mt-4 grid gap-3">
                      <input type="hidden" name="business_id" value={business.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <select name="kind" defaultValue={item.kind} className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold">
                        <option value="product">Produto</option>
                        <option value="service">Serviço</option>
                      </select>
                      <input name="name" defaultValue={item.name} minLength={2} maxLength={160} required className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold" />
                      <textarea name="description" defaultValue={item.description ?? ""} maxLength={1200} rows={3} className="rounded-xl border border-line bg-white p-3 text-sm font-semibold" />
                      <div className="grid grid-cols-2 gap-2">
                        <input name="price" defaultValue={moneyInput(item.price)} inputMode="decimal" required className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold" />
                        <input name="promotional_price" defaultValue={moneyInput(item.promotional_price)} inputMode="decimal" className="min-h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold" />
                      </div>
                      <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" className="rounded-xl border border-line bg-white p-3 text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 text-xs font-black text-ink"><input type="checkbox" name="is_active" defaultChecked={item.is_active} /> Publicado</label>
                        <label className="flex items-center gap-2 text-xs font-black text-ink"><input type="checkbox" name="is_featured" defaultChecked={item.is_featured} /> Destaque</label>
                      </div>
                      <button className="min-h-10 rounded-xl bg-ink px-3 text-xs font-black text-white">Salvar alterações</button>
                    </form>
                  </details>

                  <form action={deleteCatalogItemAction} className="mt-3">
                    <input type="hidden" name="business_id" value={business.id} />
                    <input type="hidden" name="item_id" value={item.id} />
                    <button className="min-h-9 text-xs font-black text-brand-dark underline underline-offset-4">Excluir item</button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
