import { useQuery } from "@tanstack/react-query";
import { Award, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import type { Product } from "../types";
import { ProductCard } from "../components/ProductCard";
import { EmptyState, ErrorState, Loader } from "../components/UI";

type ProductResponse = { items: Product[]; total: number };

export function RecommendedPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["products", "recommended"],
    queryFn: () => api<ProductResponse>("/products?sort=rating&limit=24", { auth: false }),
  });

  return <div className="page-container recommended-page">
    <section className="recommended-header">
      <div><span className="eyebrow"><Sparkles size={14} /> Curadoria da comunidade</span><h1>Os mais recomendados</h1><p>Produtos com as melhores notas aparecem primeiro. Em caso de empate, vence quem recebeu mais avaliações.</p></div>
      <div className="ranking-rule"><Award /><span><strong>Ranking transparente</strong><small>Nota média + volume de avaliações</small></span></div>
    </section>
    {isLoading && <Loader label="Montando o ranking" />}
    {error && <ErrorState message={(error as Error).message} />}
    {data && !data.items.length && <EmptyState title="Ainda não há produtos avaliados" text="Quando as primeiras compras forem entregues e avaliadas, o ranking aparece aqui." />}
    {data && data.items.length > 0 && <div className="product-grid ranked-grid">{data.items.map((product, index) => <div className="ranked-product" key={product.id}><span className="rank-number">#{index + 1}</span><ProductCard product={product} /></div>)}</div>}
  </div>;
}
