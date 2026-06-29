import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, PackageCheck, Store } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Category, Product } from "../types";
import { ProductCard } from "../components/ProductCard";
import { EmptyState, ErrorState, Loader } from "../components/UI";

type StoreResponse = {
  id: string;
  storeName: string;
  description?: string;
  categories: Category[];
  products: Product[];
};

export function StorePage() {
  const { sellerId = "" } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["store", sellerId],
    queryFn: () => api<StoreResponse>(`/products/stores/${sellerId}`, { auth: false }),
  });

  if (isLoading) return <Loader label="Abrindo a loja" />;
  if (error || !data) return <div className="page-container"><ErrorState message={(error as Error)?.message} /></div>;

  const ratingCount = data.products.reduce((sum, product) => sum + (product.ratingCount ?? 0), 0);
  return (
    <div className="store-page">
      <section className="store-header">
        <div className="store-identity">
          <span className="store-logo"><Store size={36} /></span>
          <div><span className="verified-label"><BadgeCheck size={15} /> Loja verificada</span><h1>{data.storeName}</h1><p>{data.description ?? "Uma loja independente dentro da Vitrine."}</p></div>
        </div>
        <div className="store-stats">
          <span><strong>{data.products.length}</strong><small>produtos</small></span>
          <span><strong>{ratingCount}</strong><small>avaliações</small></span>
          <span><PackageCheck /><small>Compra protegida</small></span>
        </div>
      </section>
      <nav className="store-categories">
        <Link to={`/loja/${sellerId}`}>Todos</Link>
        {data.categories.map((category) => <Link key={category.id} to={`/buscar?sellerId=${sellerId}&categoryId=${category.id}`}>{category.name}<small>{category._count?.products ?? 0}</small></Link>)}
      </nav>
      <section className="page-container store-products">
        <div className="section-head"><div><span className="eyebrow">Catálogo da loja</span><h2>Mais bem avaliados primeiro</h2><p>Produtos organizados pela nota e pela quantidade de avaliações.</p></div></div>
        {data.products.length ? <div className="product-grid">{data.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState title="Loja sem produtos ativos" text="O catálogo desta loja está sendo preparado." />}
      </section>
    </div>
  );
}
