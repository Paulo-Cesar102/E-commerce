import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Heart, MessageCircle, Minus, Plus, ShieldCheck, ShoppingBag, Star, Truck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";
import { imageUrl, productFallbackImage, useFallbackImage } from "../lib/images";
import { useAuthStore } from "../store/auth";
import type { Product } from "../types";
import { ErrorState, Loader } from "../components/UI";
import { ProductCard } from "../components/ProductCard";
import { ProductMarketingKit } from "../components/ProductMarketingKit";

type ProductDetail = { product: Product; related: Product[] };

export function ProductPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [quantity, setQuantity] = useState(1);
  const [showFreeOrderForm, setShowFreeOrderForm] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductDetail>(`/products/${id}`, { auth: false }),
  });
  const add = useMutation({
    mutationFn: () => api("/cart/items", { method: "POST", body: JSON.stringify({ productId: id, quantity, ...(selectedVariant ? { variantId: selectedVariant.id } : {}) }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });
  const favorite = useMutation({ mutationFn: () => api(`/wishlist/${id}`, { method: "POST" }) });
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
  const selectedVariant = product.variants?.find((variant) => Object.entries(variant.attributes).every(([key, value]) => selectedOptions[key] === value));
  const availableStock = selectedVariant?.stock ?? product.stock;
  const optionAvailable = (type: string, value: string) => !product.variants?.length || product.variants.some((variant) => variant.active && variant.stock > 0 && variant.attributes[type] === value && Object.entries(selectedOptions).every(([selectedType, selectedValue]) => selectedType === type || variant.attributes[selectedType] === selectedValue));
  const images = product.images.length ? product.images : [{ url: productFallbackImage, alt: product.name }];
  const rating = product.reviews?.length ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length : 0;
  const isQuickSale = product.listingType === "QUICK_SALE";
  const isFreeStore = !isQuickSale && product.seller?.plan === "FREE";
  const whatsappUrl = product.seller?.whatsappPhone
    ? `https://wa.me/${product.seller.whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Tenho interesse em ${quantity} unidade(s) de ${product.name}${selectedVariant ? ` (${selectedVariant.sku})` : ""}.`)}`
    : null;

  function sendFreeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product.seller?.whatsappPhone) return;
    const fields = new FormData(event.currentTarget);
    const unitPrice = Number(selectedVariant?.price ?? product.price);
    const variantLabel = selectedVariant ? ` · Variação: ${Object.values(selectedVariant.attributes).join(" / ")} (SKU ${selectedVariant.sku})` : "";
    const address = [
      fields.get("recipient"), `${fields.get("street")}, ${fields.get("number")}`,
      fields.get("complement"), fields.get("district"),
      `${fields.get("city")}/${String(fields.get("state")).toUpperCase()}`, `CEP ${fields.get("postalCode")}`,
    ].filter(Boolean).join(", ");
    const message = [
      `Olá, ${product.seller.storeName}! Quero fazer este pedido pelo plano Grátis da Vitrine.`,
      `Produto: ${product.name}${variantLabel}`,
      `Quantidade: ${quantity}`,
      `Valor dos produtos: ${formatPrice(unitPrice * quantity)} (frete a combinar)`,
      `Cliente: ${fields.get("recipient")}`,
      `Telefone: ${fields.get("phone")}`,
      `Endereço para entrega: ${address}`,
      "Por favor, confirme a disponibilidade, o frete e a forma de pagamento por aqui.",
    ];
    const href = `https://wa.me/${product.seller.whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(message.join("\n"))}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="page-container product-page">
      <div className="breadcrumbs"><Link to="/">Início</Link><ChevronRight size={14} /><Link to={`/buscar?categoryId=${product.categoryId}`}>{product.category?.name}</Link><ChevronRight size={14} /><span>{product.name}</span></div>
      <section className="product-detail">
        <div className="product-gallery">
          <div className="product-thumbs">{images.map((image, index) => <button key={index} className={activeImage === index ? "active" : ""} onClick={() => setActiveImage(index)}><img src={imageUrl(image.url)} onError={useFallbackImage} alt="" /></button>)}</div>
          <div className="product-main-image"><img src={imageUrl(images[activeImage]?.url)} onError={useFallbackImage} alt={images[activeImage]?.alt || product.name} /></div>
        </div>
        <div className="product-info">
          <div className="product-detail-labels"><span className="product-category">{product.category?.name}</span>{isQuickSale && <span className="product-detail-condition">{product.condition === "USED" ? "Usado" : "Novo"}</span>}</div>
          <h1>{product.name}</h1>
          <div className="detail-rating"><span><Star size={17} fill="currentColor" /> {rating ? rating.toFixed(1) : "Novo"}</span><a href="#avaliacoes">{product.reviews?.length ?? 0} avaliações</a><span>{product.stock > 0 ? "Em estoque" : "Indisponível"}</span></div>
          <p className="product-description">{product.description}</p>
          <div className="detail-price"><strong>{formatPrice(selectedVariant?.price ?? product.price)}</strong>{!isFreeStore && <span>ou 10x de {formatPrice(Number(selectedVariant?.price ?? product.price) / 10)} sem juros</span>}</div>
          {Object.entries(groupedOptions).map(([type, values]) => <div className="option-group" key={type}><label>{type === "size" ? "Tamanho" : type === "color" ? "Cor" : "Sabor"}</label><div>{values.map((value) => <button disabled={!optionAvailable(type, value)} className={selectedOptions[type] === value ? "active" : ""} onClick={() => setSelectedOptions((current) => ({ ...current, [type]: value }))} key={value}>{value}</button>)}</div></div>)}
          {selectedVariant && <small>SKU: {selectedVariant.sku} · {selectedVariant.stock} unidades disponíveis</small>}
          {!isFreeStore && <div className="buy-row">
            <div className="quantity-control"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={17} /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}><Plus size={17} /></button></div>
            <button className="button button-primary grow" disabled={availableStock === 0 || (!!product.variants?.length && !selectedVariant) || add.isPending} onClick={() => requireAuth(() => add.mutate())}><ShoppingBag size={19} /> {add.isSuccess ? "Adicionado" : "Adicionar ao carrinho"}</button>
            <button className="icon-button bordered" aria-label="Favoritar" disabled={favorite.isPending} onClick={() => requireAuth(() => favorite.mutate())}><Heart size={20} fill={favorite.isSuccess ? "currentColor" : "none"} /></button>
          </div>}
          {isFreeStore
            ? whatsappUrl
              ? <>
                <button className="button button-primary full local-whatsapp-cta" type="button" onClick={() => setShowFreeOrderForm((visible) => !visible)}><MessageCircle size={18} /> {showFreeOrderForm ? "Fechar pedido" : "Pedir pelo WhatsApp"}</button>
                {showFreeOrderForm && <form className="free-whatsapp-order" onSubmit={sendFreeOrder}>
                  <h2>Dados do pedido</h2>
                  <p>O pedido e o endereço serão enviados à loja pelo WhatsApp. Frete e pagamento são combinados diretamente com o vendedor.</p>
                  {!!product.variants?.length && !selectedVariant && <p className="form-error">Selecione uma variação do produto antes de continuar.</p>}
                  <div className="quantity-control"><button type="button" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={17} /></button><span>{quantity}</span><button type="button" disabled={quantity >= availableStock} onClick={() => setQuantity((value) => Math.min(availableStock, value + 1))}><Plus size={17} /></button></div>
                  <label>Nome de quem recebe<input name="recipient" required maxLength={120} /></label>
                  <label>Seu telefone<input name="phone" required type="tel" inputMode="tel" maxLength={20} placeholder="(11) 99999-9999" /></label>
                  <div className="free-whatsapp-address-row"><label>Rua / avenida<input name="street" required maxLength={160} /></label><label>Número<input name="number" required maxLength={20} /></label></div>
                  <label>Complemento (opcional)<input name="complement" maxLength={100} /></label>
                  <label>Bairro<input name="district" required maxLength={100} /></label>
                  <div className="free-whatsapp-address-row"><label>Cidade<input name="city" required maxLength={100} /></label><label>UF<input name="state" required minLength={2} maxLength={2} /></label></div>
                  <label>CEP<input name="postalCode" required inputMode="numeric" maxLength={9} placeholder="00000-000" onChange={(event) => { const digits = event.currentTarget.value.replace(/\D/g, "").slice(0, 8); event.currentTarget.value = digits.replace(/^(\d{5})(\d)/, "$1-$2"); }} /></label>
                  <button className="button button-primary full" type="submit" disabled={availableStock < 1 || quantity > availableStock || (!!product.variants?.length && !selectedVariant)}><MessageCircle size={18} /> Enviar pedido pelo WhatsApp</button>
                  <small>Esses dados serão compartilhados com a loja pelo WhatsApp para combinar a entrega.</small>
                </form>}
              </>
              : <p className="form-error">A loja ainda não configurou o WhatsApp para pedidos.</p>
            : <button className="button button-dark full" disabled={product.stock === 0} onClick={() => requireAuth(() => add.mutate(undefined, { onSuccess: () => navigate("/carrinho") }))}>Comprar agora</button>}
          <div className="purchase-benefits">{isFreeStore ? <><div><MessageCircle /><span><strong>Atendimento local</strong><small>{product.seller?.city}{product.seller?.state ? `/${product.seller.state}` : ""} · combine retirada ou entrega com a loja</small></span></div><div><ShieldCheck /><span><strong>Pedido direto com o lojista</strong><small>Pagamento e entrega combinados pelo WhatsApp</small></span></div></> : <><div><Truck /><span><strong>{isQuickSale ? "Envio pelos Correios" : "Entrega calculada no checkout"}</strong><small>Acompanhe pelo pedido</small></span></div><div><ShieldCheck /><span><strong>Pagamento protegido</strong><small>Ambiente seguro Mercado Pago</small></span></div></>}</div>
          <ProductMarketingKit product={product} image={imageUrl(images[activeImage]?.url)} />
          {product.seller && <div className="seller-summary"><Link to={`/loja/${product.seller.id}`}><span className="store-avatar">{product.seller.storeName[0]}</span><span><small>Vendido por</small><strong>{product.seller.storeName}</strong><em>Visitar loja</em></span></Link><button onClick={() => requireAuth(async () => { await api("/chats", { method: "POST", body: JSON.stringify({ sellerId: product.seller!.id }) }); navigate("/chat"); })}><MessageCircle size={17} /> Falar com a loja</button></div>}
          {isQuickSale && product.ownerUser && <div className="seller-summary"><div><span className="store-avatar">{product.ownerUser.name[0]}</span><span><small>Anúncio de venda rápida</small><strong>{product.ownerUser.name}</strong><em>Vendedor independente · produto enviado pelos Correios</em></span></div></div>}
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
