import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Category, Product } from "../types";
import { ProductCard } from "../components/ProductCard";
import { EmptyState, ErrorState, Loader, PageHeading } from "../components/UI";

type ProductResponse = { items: Product[]; total: number; page: number; limit: number };

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const sellerId = params.get("sellerId") ?? "";
  const listingType = params.get("listingType") === "QUICK_SALE" ? "QUICK_SALE" : "";
  const localOnly = params.get("localOnly") === "true";
  const city = params.get("city") ?? "";
  const state = params.get("state") ?? "";
  const sort = params.get("sort") ?? "rating";
  const page = Number(params.get("page") ?? 1);
  const cityFilter = city.trim().length >= 2 ? city.trim() : "";
  const stateFilter = /^[A-Za-z]{2}$/.test(state) ? state.toUpperCase() : "";
  const query = new URLSearchParams({ page: String(page), limit: "12" });
  if (q) query.set("q", q);
  if (categoryId) query.set("categoryId", categoryId);
  if (sellerId) query.set("sellerId", sellerId);
  if (listingType) query.set("listingType", listingType);
  if (localOnly) query.set("localOnly", "true");
  if (cityFilter) query.set("city", cityFilter);
  if (stateFilter) query.set("state", stateFilter);
  query.set("sort", sort);

  const { data, isLoading, error } = useQuery({
    queryKey: ["products", q, categoryId, sellerId, listingType, localOnly, cityFilter, stateFilter, sort, page],
    queryFn: () => api<ProductResponse>(`/products?${query}`, { auth: false }),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/products/categories", { auth: false }),
  });

  function update(key: string, value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  function updateMode(mode: "all" | "local" | "quick-sale") {
    const next = new URLSearchParams(params);
    next.delete("page");
    next.delete("listingType");
    next.delete("localOnly");
    if (mode === "local") next.set("localOnly", "true");
    if (mode === "quick-sale") {
      next.set("listingType", "QUICK_SALE");
      next.delete("city");
      next.delete("state");
    }
    setParams(next);
  }

  const pages = data ? Math.ceil(data.total / data.limit) : 1;
  const title = q
    ? `Resultados para “${q}”`
    : localOnly
      ? "Produtos locais"
      : listingType === "QUICK_SALE"
        ? "Venda rápida"
        : "Encontre seu próximo favorito";

  return (
    <div className="page-container catalog-page">
      <PageHeading eyebrow={localOnly ? "Lojas da sua região" : listingType === "QUICK_SALE" ? "Anúncios de pessoas" : "Catálogo"} title={title} description={localOnly ? "Explore vitrines locais e filtre por cidade ou estado." : listingType === "QUICK_SALE" ? "Encontre itens anunciados por pessoas e vendidos pelo checkout da Vitrine." : `${data?.total ?? 0} produtos disponíveis agora`} />
      {!sellerId && <div className="catalog-mode-tabs" role="group" aria-label="Tipo de produto">
        <button aria-pressed={!localOnly && !listingType} className={!localOnly && !listingType ? "active" : ""} onClick={() => updateMode("all")}>Todos</button>
        <button aria-pressed={localOnly} className={localOnly ? "active" : ""} onClick={() => updateMode("local")}>Produtos locais</button>
        <button aria-pressed={listingType === "QUICK_SALE"} className={listingType === "QUICK_SALE" ? "active" : ""} onClick={() => updateMode("quick-sale")}>Venda rápida</button>
      </div>}
      <div className="catalog-toolbar">
        <div className="filter-label"><SlidersHorizontal size={18} /> Filtrar por</div>
        <div className="filter-pills">
          <button className={!categoryId ? "active" : ""} onClick={() => update("categoryId")}>Todos</button>
          {categories.map((category) => (
            <button key={category.id} className={categoryId === category.id ? "active" : ""} onClick={() => update("categoryId", category.id)}>{category.name}</button>
          ))}
        </div>
        {!sellerId && listingType !== "QUICK_SALE" && <div className="local-store-filter"><div><strong>{localOnly ? "Filtre por cidade ou estado" : "Descubra lojas da sua cidade"}</strong><small>{localOnly ? "Veja produtos de lojistas locais; deixe em branco para explorar todas as cidades." : "Informe sua localização para incluir vitrines locais que recebem pedidos pelo WhatsApp."}</small></div><label>Cidade<input value={city} onChange={(event) => update("city", event.target.value)} placeholder="Sua cidade" /></label><label>UF<input value={state} maxLength={2} onChange={(event) => update("state", event.target.value.toUpperCase().slice(0, 2))} placeholder="SP" /></label></div>}
        {(q || categoryId || city || state || localOnly || listingType) && <button className="clear-filter" onClick={() => setParams({})}><X size={16} /> Limpar</button>}
        <label className="sort-select"><Star size={16} /><select value={sort} onChange={(event) => update("sort", event.target.value)}><option value="rating">Mais bem avaliados</option><option value="new">Mais recentes</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option></select></label>
      </div>
      {isLoading && <Loader label="Buscando produtos" />}
      {error && <ErrorState message={(error as Error).message} />}
      {!isLoading && !error && data?.items.length === 0 && (
        <EmptyState title={localOnly ? "Nenhum produto local encontrado" : listingType === "QUICK_SALE" ? "Nenhum anúncio de venda rápida encontrado" : "Nada por aqui ainda"} text="Tente outro nome ou remova os filtros." action={<button className="button button-dark" onClick={() => setParams({})}><Search size={17} /> Ver todos</button>} />
      )}
      {data && data.items.length > 0 && <div className="product-grid">{data.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      {pages > 1 && <div className="pagination">
        <button disabled={page <= 1} onClick={() => update("page", String(page - 1))}><ChevronLeft size={18} /></button>
        <span>Página <strong>{page}</strong> de {pages}</span>
        <button disabled={page >= pages} onClick={() => update("page", String(page + 1))}><ChevronRight size={18} /></button>
      </div>}
    </div>
  );
}
