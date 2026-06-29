import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Headphones, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { imageUrl, useFallbackImage } from "../lib/images";
import type { Category, Product } from "../types";
import { ProductCard } from "../components/ProductCard";
import { EmptyState, ErrorState, Loader } from "../components/UI";

type ProductResponse = { items: Product[]; total: number };

export function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["products", "home"],
    queryFn: () => api<ProductResponse>("/products?limit=8&sort=rating", { auth: false }),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/products/categories", { auth: false }),
  });

  return (
    <>
      <section className="hero">
        <img src="/assets/vitrine-hero.png" alt="Seleção colorida de produtos da Vitrine" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="hero-kicker"><Sparkles size={16} /> Curadoria que combina com você</span>
          <h1>VITRINE</h1>
          <p>Descubra produtos de lojas independentes e compre com conversa direta, pagamento protegido e entrega acompanhada.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/buscar">Explorar produtos <ArrowRight size={18} /></Link>
            <Link className="button button-light" to="/criar-conta?tipo=vendedor">Quero vender</Link>
          </div>
        </div>
      </section>

      <section className="trust-band">
        <div><ShieldCheck /><span><strong>Compra protegida</strong><small>Pagamento seguro</small></span></div>
        <div><PackageCheck /><span><strong>Entrega acompanhada</strong><small>Do pedido à sua porta</small></span></div>
        <div><Headphones /><span><strong>Conversa direta</strong><small>Chat com o vendedor</small></span></div>
      </section>

      {categories.length > 0 && (
        <section className="section">
          <div className="section-head"><div><span className="eyebrow">Explore do seu jeito</span><h2>Categorias em destaque</h2></div><Link to="/buscar">Ver todas <ArrowRight size={17} /></Link></div>
          <div className="category-grid category-image-grid">
            {categories.slice(0, 6).map((category, index) => (
              <Link key={category.id} to={`/buscar?categoryId=${category.id}`} className={`category-tile category-tone-${index % 6}`}>
                {category.products?.[0]?.images?.[0]?.url && <img src={imageUrl(category.products[0].images[0].url)} onError={useFallbackImage} alt="" />}
                <span className="category-shade" />
                <span className="category-count">{category._count?.products ?? 0} produtos</span>
                <strong>{category.name}</strong>
                <ArrowRight size={20} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section products-section">
        <div className="section-head">
          <div><span className="eyebrow">Chegaram agora</span><h2>Novidades na Vitrine</h2><p>Uma seleção enxuta para você descobrir sem rolar para sempre.</p></div>
          <Link to="/buscar">Ver catálogo <ArrowRight size={17} /></Link>
        </div>
        {isLoading ? <Loader label="Preparando a vitrine" /> : (
          error ? <ErrorState message={(error as Error).message} /> :
          data?.items.length ? <div className="product-grid">{data.items.map((product) => <ProductCard key={product.id} product={product} />)}</div> :
          <EmptyState title="A vitrine está sendo preparada" text="Os primeiros produtos aparecem aqui assim que as lojas publicarem seus catálogos." />
        )}
      </section>

      <section className="seller-banner">
        <div><span className="eyebrow">Sua loja, do seu jeito</span><h2>Leve seus produtos para uma vitrine maior.</h2><p>Cadastre seu catálogo, acompanhe vendas e converse com clientes em um só lugar.</p></div>
        <Link className="button button-dark" to="/criar-conta?tipo=vendedor">Abrir minha loja <ArrowRight size={18} /></Link>
      </section>
    </>
  );
}
