import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { formatPrice } from "../lib/format";
import { imageUrl, useFallbackImage } from "../lib/images";
import type { Cart, CartItem, Order } from "../types";
import { EmptyState, ErrorState, Loader, PageHeading } from "../components/UI";

export function CartPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addressId, setAddressId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const { data: cart, isLoading, error } = useQuery({ queryKey: ["cart"], queryFn: () => api<Cart>("/cart") });
  const { data: addresses = [] } = useQuery({ queryKey: ["addresses"], queryFn: () => api<{ id: string; recipient: string; street: string; number: string; city: string; state: string; postalCode: string; isDefault: boolean }[]>("/addresses") });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CartItem> }) => api(`/cart/items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/cart/items/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });
  const checkout = useMutation({
    mutationFn: () => api<Order[]>("/orders/checkout", { method: "POST", body: JSON.stringify({ addressId: addressId || addresses.find((address) => address.isDefault)?.id, itemIds: selected.map((item) => item.id), ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}) }) }),
    onSuccess: (orders) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      const paymentUrl = orders.find((order) => order.mercadoPagoPreference)?.mercadoPagoPreference;
      if (paymentUrl) window.location.href = paymentUrl; else navigate("/pedidos");
    },
  });
  const selected = cart?.items.filter((item) => item.selected) ?? [];
  const subtotal = selected.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);

  if (isLoading) return <Loader label="Abrindo seu carrinho" />;
  if (error) return <div className="page-container"><ErrorState message={(error as Error).message} /></div>;
  if (!cart?.items.length) return <div className="page-container"><EmptyState title="Seu carrinho está vazio" text="Quando algum produto chamar sua atenção, ele aparece aqui." action={<Link className="button button-primary" to="/buscar">Explorar produtos <ArrowRight size={17} /></Link>} /></div>;

  return (
    <div className="page-container cart-page">
      <PageHeading eyebrow="Sua seleção" title="Carrinho" description={`${cart.items.length} ${cart.items.length === 1 ? "produto" : "produtos"} no carrinho`} />
      <div className="cart-layout">
        <section className="cart-list">
          <label className="select-all"><input type="checkbox" checked={selected.length === cart.items.length} onChange={(event) => cart.items.forEach((item) => update.mutate({ id: item.id, body: { selected: event.target.checked } }))} /><span>Selecionar todos</span></label>
          {cart.items.map((item) => <article className="cart-item" key={item.id}>
            <label className="check-control"><input type="checkbox" checked={item.selected} onChange={(event) => update.mutate({ id: item.id, body: { selected: event.target.checked } })} /><span><Check size={14} /></span></label>
            <Link to={`/produto/${item.productId}`} className="cart-item-image"><img src={imageUrl(item.product.images?.[0]?.url)} onError={useFallbackImage} alt={item.product.name} /></Link>
            <div className="cart-item-info"><span className="product-category">{item.product.category?.name ?? "Vitrine"}</span><Link to={`/produto/${item.productId}`}><h3>{item.product.name}</h3></Link><small>{item.product.stock} unidades disponíveis</small><div className="cart-mobile-price">{formatPrice(item.product.price)}</div></div>
            <div className="cart-item-actions"><strong>{formatPrice(Number(item.product.price) * item.quantity)}</strong><div className="quantity-control"><button disabled={item.quantity <= 1} onClick={() => update.mutate({ id: item.id, body: { quantity: item.quantity - 1 } })}><Minus size={15} /></button><span>{item.quantity}</span><button disabled={item.quantity >= item.product.stock} onClick={() => update.mutate({ id: item.id, body: { quantity: item.quantity + 1 } })}><Plus size={15} /></button></div><button className="remove-button" onClick={() => remove.mutate(item.id)}><Trash2 size={16} /> Remover</button></div>
          </article>)}
        </section>
        <aside className="cart-summary">
          <h2>Resumo do pedido</h2>
          <div className="summary-line"><span>Produtos selecionados</span><strong>{selected.reduce((sum, item) => sum + item.quantity, 0)}</strong></div>
          <div className="summary-line"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
          <div className="shipping-box"><label htmlFor="address">Endereço de entrega</label>{addresses.length ? <select id="address" value={addressId} onChange={(event) => setAddressId(event.target.value)}><option value="">Usar endereço principal</option>{addresses.map((address) => <option key={address.id} value={address.id}>{address.street}, {address.number} — {address.city}/{address.state}</option>)}</select> : <Link to="/enderecos">Cadastre um endereço antes de pagar</Link>}</div>
          <div className="shipping-box"><label htmlFor="coupon">Cupom de desconto</label><input id="coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Digite seu cupom" maxLength={40} /></div>
          <div className="summary-total"><span>Total</span><strong>{formatPrice(subtotal)}</strong><small>em até 10x de {formatPrice(subtotal / 10)}</small></div>
          {checkout.error && <p className="form-error">{(checkout.error as Error).message}</p>}
          <button className="button button-primary full" disabled={!selected.length || !addresses.length || checkout.isPending} onClick={() => checkout.mutate()}><ShoppingBag size={18} /> {checkout.isPending ? "Processando..." : "Ir para pagamento"}</button>
          <div className="secure-note"><ShieldCheck size={18} /><span>Pagamento seguro processado pelo Mercado Pago</span></div>
        </aside>
      </div>
    </div>
  );
}
