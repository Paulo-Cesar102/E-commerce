import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, MessageCircle, Package, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";
import { imageUrl, useFallbackImage } from "../lib/images";
import type { Order } from "../types";
import { EmptyState, ErrorState, Loader, PageHeading, StatusBadge } from "../components/UI";

export function OrdersPage() {
  const client = useQueryClient();
  const [reviewing, setReviewing] = useState<string | null>(null);
  const { data: orders, isLoading, error } = useQuery({ queryKey: ["orders"], queryFn: () => api<Order[]>("/orders/mine") });
  const orderAction = useMutation({ mutationFn: ({ id, action, reason }: { id: string; action: "cancel" | "return"; reason: string }) => api(`/orders/${id}/${action}`, { method: "POST", body: JSON.stringify({ reason }) }), onSuccess: () => client.invalidateQueries({ queryKey: ["orders"] }) });
  const review = useMutation({ mutationFn: ({ productId, orderId, rating, comment }: { productId: string; orderId: string; rating: number; comment: string }) => api(`/products/${productId}/reviews`, { method: "POST", body: JSON.stringify({ orderId, rating, comment }) }), onSuccess: () => { setReviewing(null); client.invalidateQueries({ queryKey: ["orders"] }); } });
  if (isLoading) return <Loader label="Buscando seus pedidos" />;
  function requestAction(id: string, action: "cancel" | "return") {
    const reason = window.prompt(action === "cancel" ? "Motivo do cancelamento:" : "Motivo da devolução:");
    if (reason && reason.trim().length >= 3) orderAction.mutate({ id, action, reason: reason.trim() });
  }
  return <div className="page-container orders-page">
    <PageHeading eyebrow="Sua conta" title="Meus pedidos" description="Acompanhe compras, entregas, devoluções e avaliações." />
    {error && <ErrorState message={(error as Error).message} />}
    {!error && !orders?.length && <EmptyState title="Você ainda não fez nenhuma compra" text="Explore a Vitrine e encontre algo especial." action={<Link className="button button-primary" to="/buscar">Começar a explorar <ArrowRight size={17} /></Link>} />}
    {orderAction.error && <ErrorState message={(orderAction.error as Error).message} />}{review.error && <ErrorState message={(review.error as Error).message} />}
    <div className="orders-list">{orders?.map((order) => <article className="order-card" key={order.id}>
      <header><div><span>Pedido #{order.id.slice(0, 8).toUpperCase()}</span><small>Realizado em {formatDate(order.createdAt)}</small></div><StatusBadge status={order.status} /></header>
      <div className="order-products">{order.items.map((item) => <div key={item.id}><img src={imageUrl(item.product?.images?.[0]?.url ?? item.imageUrl)} onError={useFallbackImage} alt="" /><span><strong>{item.product?.name ?? item.productName ?? "Produto"}</strong><small>{item.quantity} un. · {formatPrice(item.unitPrice)}</small></span>{order.status === "DELIVERED" && <button className="button button-ghost compact" onClick={() => setReviewing(reviewing === item.id ? null : item.id)}>Avaliar</button>}{reviewing === item.id && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); review.mutate({ productId: item.product?.id ?? "", orderId: order.id, rating: Number(form.get("rating")), comment: String(form.get("comment") ?? "") }); }}><label>Nota<select name="rating" defaultValue="5"><option value="5">5 estrelas</option><option value="4">4 estrelas</option><option value="3">3 estrelas</option><option value="2">2 estrelas</option><option value="1">1 estrela</option></select></label><label>Comentário<textarea name="comment" maxLength={1000} /></label><button className="button button-primary compact" disabled={review.isPending || !item.product?.id}>Enviar avaliação</button></form>}</div>)}</div>
      <div className="order-progress"><span className="complete"><Package size={16} /> Pedido recebido</span><i /><span className={["PAID", "PREPARING", "SHIPPED", "DELIVERED"].includes(order.status) ? "complete" : ""}><CalendarDays size={16} /> Em preparação</span><i /><span className={["SHIPPED", "DELIVERED"].includes(order.status) ? "complete" : ""}><Truck size={16} /> A caminho</span></div>
      <footer><div><small>Total do pedido</small><strong>{formatPrice(order.total)}</strong>{order.deliveryEstimateDate && <span>Previsão: {formatDate(order.deliveryEstimateDate)}</span>}</div><div>{order.mercadoPagoPreference && order.status === "PENDING_PAYMENT" && <a className="button button-primary compact" href={order.mercadoPagoPreference}>Pagar agora</a>}{order.status === "PENDING_PAYMENT" || order.status === "PAID" ? <button className="button button-ghost compact" onClick={() => requestAction(order.id, "cancel")} disabled={orderAction.isPending}>Cancelar pedido</button> : null}{order.status === "DELIVERED" && <button className="button button-ghost compact" onClick={() => requestAction(order.id, "return")} disabled={orderAction.isPending}>Solicitar devolução</button>}{order.directSeller ? <span className="quick-sale-order-owner">Venda rápida · {order.directSeller.name}</span> : <Link className="button button-ghost compact" to="/chat"><MessageCircle size={16} /> Falar com a loja</Link>}</div></footer>
    </article>)}</div>
  </div>;
}
