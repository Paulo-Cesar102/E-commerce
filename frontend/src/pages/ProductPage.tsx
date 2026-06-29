import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Heart, MessageCircle, Minus, Plus, ShieldCheck, ShoppingBag, Star, Truck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";
import { useAuthStore } from "../store/auth";
import type { Product } from "../types";
import { ErrorState, Loader } from "../components/UI";
import { ProductCard } from "../components/ProductCard";

type ProductDetail = { product: Product; related: Product[] };
const fallback = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80";

export function ProductPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductDetail>(`/products/${id}`, { auth: false }),
  });
  const add = useMutation({
    mutationFn: () => api("/cart/items", { method: "POST", body: JSON.stringify({ productId: id, quantity }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });
  const groupedOptions = useMemo(() => {
    return data?.product.options?.reduce<Record<string, string[]>>((acc, option) => {
      acc[option.type] = [...(acc[option.type] ?? []), option.value];
      return acc;
    }, {}) ?? {};
  }, [data]);

  function requireAuth(action: () => void) {
    if (!accessToken) navigate("/entrar", { state: { from: `/produto/${id}` } }); else action();
  }

  if (isLoading) return <Loader label="Abrindo produto" />;
  if (error || !data) return <div className="page-container"><ErrorState message={(error as Error)?.message} /></div>;
  const { product, related } = data;
  const images = product.images.length ? product.images : [{ url: fallback, alt: product.name }];
  const rating = product.reviews?.length ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length : 0;

  return (
    <div className="page-container product-page">
      <div className="breadcrumbs"><Link to="/">Início</Link><ChevronRight size={14} /><Link to={`/buscar?categoryId=${product.categoryId}`}>{product.category?.name}</Link><ChevronRight size={14} /><span>{product.name}</span></div>
      <section className="product-detail">
        <div className="product-gallery">
          <div className="product-thumbs">{images.map((image, index) => <button key={index} className={activeImage === index ? "active" : ""} onClick={() => setActiveImage(index)}><img src={image.url} alt="" /></button>)}</div>
          <div className="product-main-image"><img src={images[activeImage]?.url} alt={images[activeImage]?.alt || product.name} /></div>
        </div>
        <div className="product-info">
          <span className="product-category">{product.category?.name}</span>
          <h1>{product.name}</h1>
          <div className="detail-rating"><span><Star size={17} fill="currentColor" /> {rating ? rating.toFixed(1) : "Novo"}</span><a href="#avaliacoes">{product.reviews?.length ?? 0} avaliações</a><span>{product.stock > 0 ? "Em estoque" : "Indisponível"}</span></div>
          <p className="product-description">{product.description}</p>
          <div className="detail-price"><strong>{formatPrice(product.price)}</strong><span>ou 10x de {formatPrice(Number(product.price) / 10)} sem juros</span></div>
          {Object.entries(groupedOptions).map(([type, values]) => <div className="option-group" key={type}><label>{type === "size" ? "Tamanho" : type === "color" ? "Cor" : "Sabor"}</label><div>{values.map((value) => <button className={selectedOptions[type] === value ? "active" : ""} onClick={() => setSelectedOptions((current) => ({ ...current, [type]: value }))} key={value}>{value}</button>)}</div></div>)}
          <div className="buy-row">
            <div className="quantity-control"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={17} /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}><Plus size={17} /></button></div>
            <button className="button button-primary grow" disabled={product.stock === 0 || add.isPending} onClick={() => requireAuth(() => add.mutate())}><ShoppingBag size={19} /> {add.isSuccess ? "Adicionado" : "Adicionar ao carrinho"}</button>
            <button className="icon-button bordered" aria-label="Favoritar"><Heart size={20} /></button>
          </div>
          <button className="button button-dark full" disabled={product.stock === 0} onClick={() => requireAuth(() => add.mutate(undefined, { onSuccess: () => navigate("/carrinho") }))}>Comprar agora</button>
          <div className="purchase-benefits"><div><Truck /><span><strong>Entrega calculada no checkout</strong><small>Acompanhe pelo pedido</small></span></div><div><ShieldCheck /><span><strong>Pagamento protegido</strong><small>Ambiente seguro Mercado Pago</small></span></div></div>
          {product.seller && <div className="seller-summary"><Link to={`/loja/${product.seller.id}`}><span className="store-avatar">{product.seller.storeName[0]}</span><span><small>Vendido por</small><strong>{product.seller.storeName}</strong><em>Visitar loja</em></span></Link><button onClick={() => requireAuth(async () => { await api("/chats", { method: "POST", body: JSON.stringify({ sellerId: product.seller!.id }) }); navigate("/chat"); })}><MessageCircle size={17} /> Falar com a loja</button></div>}
        </div>
      </section>
      <section id="avaliacoes" className="reviews-section">
        <div><span className="eyebrow">Quem comprou, conta</span><h2>Avaliações do produto</h2></div>
        {!product.reviews?.length ? <p className="muted">Este produto ainda não recebeu avaliações.</p> : <div className="review-grid">{product.reviews.map((review) => <article key={review.id}><div className="review-stars">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={15} fill={index < review.rating ? "currentColor" : "none"} />)}</div><p>{review.comment ?? "Produto avaliado sem comentário."}</p><footer><strong>{review.user?.name}</strong><span>{formatDate(review.createdAt)}</span></footer></article>)}</div>}
      </section>
      {related.length > 0 && <section className="related-section"><div className="section-head"><div><span className="eyebrow">Continue explorando</span><h2>Produtos relacionados</h2></div></div><div className="product-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></section>}
    </div>
  );
}
