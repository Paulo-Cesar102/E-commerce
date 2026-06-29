import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, MessageCircle, Package, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";
import type { Order } from "../types";
import { EmptyState, ErrorState, Loader, PageHeading, StatusBadge } from "../components/UI";

export function OrdersPage() {
  const { data: orders, isLoading, error } = useQuery({ queryKey: ["orders"], queryFn: () => api<Order[]>("/orders/mine") });
  if (isLoading) return <Loader label="Buscando seus pedidos" />;
  return <div className="page-container orders-page">
    <PageHeading eyebrow="Sua conta" title="Meus pedidos" description="Acompanhe compras, entregas e converse com cada loja." />
    {error && <ErrorState message={(error as Error).message} />}
    {!error && !orders?.length && <EmptyState title="Você ainda não fez nenhuma compra" text="Explore a Vitrine e encontre algo especial." action={<Link className="button button-primary" to="/buscar">Começar a explorar <ArrowRight size={17} /></Link>} />}
    <div className="orders-list">{orders?.map((order) => <article className="order-card" key={order.id}>
      <header><div><span>Pedido #{order.id.slice(0, 8).toUpperCase()}</span><small>Realizado em {formatDate(order.createdAt)}</small></div><StatusBadge status={order.status} /></header>
      <div className="order-products">{order.items.map((item) => <div key={item.id}><img src={item.product?.images?.[0]?.url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80"} alt="" /><span><strong>{item.product?.name ?? "Produto"}</strong><small>{item.quantity} un. · {formatPrice(item.unitPrice)}</small></span></div>)}</div>
      <div className="order-progress"><span className="complete"><Package size={16} /> Pedido recebido</span><i /><span className={["PAID","PREPARING","SHIPPED","DELIVERED"].includes(order.status) ? "complete" : ""}><CalendarDays size={16} /> Em preparação</span><i /><span className={["SHIPPED","DELIVERED"].includes(order.status) ? "complete" : ""}><Truck size={16} /> A caminho</span></div>
      <footer><div><small>Total do pedido</small><strong>{formatPrice(order.total)}</strong>{order.deliveryEstimateDate && <span>Previsão: {formatDate(order.deliveryEstimateDate)}</span>}</div><div>{order.mercadoPagoPreference && order.status === "PENDING_PAYMENT" && <a className="button button-primary compact" href={order.mercadoPagoPreference}>Pagar agora</a>}<Link className="button button-ghost compact" to="/chat"><MessageCircle size={16} /> Falar com a loja</Link></div></footer>
    </article>)}</div>
  </div>;
}
