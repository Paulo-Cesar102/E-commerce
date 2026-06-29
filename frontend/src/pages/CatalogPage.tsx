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
  const sort = params.get("sort") ?? "rating";
  const page = Number(params.get("page") ?? 1);
  const query = new URLSearchParams({ page: String(page), limit: "12" });
  if (q) query.set("q", q);
  if (categoryId) query.set("categoryId", categoryId);
  if (sellerId) query.set("sellerId", sellerId);
  query.set("sort", sort);

  const { data, isLoading, error } = useQuery({
    queryKey: ["products", q, categoryId, sellerId, sort, page],
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

  const pages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="page-container catalog-page">
      <PageHeading eyebrow="Catálogo" title={q ? `Resultados para “${q}”` : "Encontre seu próximo favorito"} description={`${data?.total ?? 0} produtos disponíveis agora`} />
      <div className="catalog-toolbar">
        <div className="filter-label"><SlidersHorizontal size={18} /> Filtrar por</div>
        <div className="filter-pills">
          <button className={!categoryId ? "active" : ""} onClick={() => update("categoryId")}>Todos</button>
          {categories.map((category) => (
            <button key={category.id} className={categoryId === category.id ? "active" : ""} onClick={() => update("categoryId", category.id)}>{category.name}</button>
          ))}
        </div>
        {(q || categoryId) && <button className="clear-filter" onClick={() => setParams({})}><X size={16} /> Limpar</button>}
        <label className="sort-select"><Star size={16} /><select value={sort} onChange={(event) => update("sort", event.target.value)}><option value="rating">Mais bem avaliados</option><option value="new">Mais recentes</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option></select></label>
      </div>
      {isLoading && <Loader label="Buscando produtos" />}
      {error && <ErrorState message={(error as Error).message} />}
      {!isLoading && !error && data?.items.length === 0 && (
        <EmptyState title="Nada por aqui ainda" text="Tente outro nome ou remova os filtros." action={<button className="button button-dark" onClick={() => setParams({})}><Search size={17} /> Ver todos</button>} />
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
