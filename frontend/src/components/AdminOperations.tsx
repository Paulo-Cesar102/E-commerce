import { useState } from "react";
import { Download, FileSearch, Filter, History, Store, Bell, Wallet } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../lib/api";
import { formatPrice } from "../lib/format";

type Seller = { id: string; storeName: string; approvalStatus: string; user: { name: string; email: string }; sales: { total: string | number; orders: number } };
type Order = { id: string; createdAt: string; status: string; total: string | number; customer: { name: string; email: string }; seller: { id: string; storeName: string } };
type Audit = { id: string; action: string; entityType: string; createdAt: string; user?: { name: string; email: string } | null };
type Notification = { id: string; title: string; body: string; createdAt: string; readAt?: string | null };
type Withdrawal = { id: string; amount: string | number; status: string; requestedAt: string };

function getDateRange(period: string) {
  if (period === "custom") return {};
  const end = new Date();
  const start = new Date(end);
  if (period === "today") start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setDate(start.getDate() - 29);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function AdminOperations() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string>();
  const overview = useQuery({ queryKey: ["admin-operations-overview"], queryFn: () => api<{ sellers: Seller[] }>("/admin/overview") });
  const range = period === "custom" ? { ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}), ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}) } : getDateRange(period);
  const params = new URLSearchParams({ ...range, ...(status ? { status } : {}), ...(customer ? { customer } : {}), ...(sellerId ? { sellerId } : {}) });
  const orders = useQuery({ queryKey: ["admin-orders", period, from, to, status, customer, sellerId], queryFn: () => api<Order[]>(`/admin/orders?${params}`) });
  const audit = useQuery({ queryKey: ["admin-audit"], queryFn: () => api<Audit[]>("/admin/audit") });
  const notifications = useQuery({ queryKey: ["admin-notifications"], queryFn: () => api<Notification[]>("/admin/notifications") });
  const withdrawals = useQuery({ queryKey: ["admin-withdrawals"], queryFn: async () => (await api<{ withdrawals: Withdrawal[] }>("/admin/overview")).withdrawals });
  const sellerDetail = useQuery({ queryKey: ["admin-seller", selectedSellerId], queryFn: () => api<{ storeName: string; products: Array<{ id: string; name: string; price: string | number }>; orders: Order[] }>(`/admin/sellers/${selectedSellerId}`), enabled: Boolean(selectedSellerId) });
  const updateSeller = useMutation({ mutationFn: ({ id, status: nextStatus }: { id: string; status: string }) => api(`/admin/sellers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-operations-overview"] }); queryClient.invalidateQueries({ queryKey: ["admin-overview"] }); } });
  const updateWithdrawal = useMutation({ mutationFn: ({ id, status: nextStatus }: { id: string; status: string }) => api(`/admin/withdrawals/${id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }) });

  async function exportCsv() {
    const token = localStorage.getItem("vitrine-session");
    const session = token ? JSON.parse(token) as { state?: { accessToken?: string } } : {};
    const response = await fetch(`${API_URL}/admin/export/orders.csv?${params}`, { headers: { Authorization: `Bearer ${session.state?.accessToken ?? ""}` } });
    const blob = await response.blob();
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "pedidos-vitrine.csv"; link.click(); URL.revokeObjectURL(link.href);
  }

  return <section className="admin-operations"><header><div><span className="eyebrow">Ferramentas</span><h2><Filter size={19} /> Operação e relatórios</h2><p>Filtre pedidos, gerencie contas e acompanhe a atividade administrativa.</p></div><button className="button button-dark" onClick={() => void exportCsv()}><Download size={16} /> Exportar CSV</button></header><div className="admin-filter-bar"><button className={period === "today" ? "active" : ""} onClick={() => setPeriod("today")}>Hoje</button><button className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>Semana</button><button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>Mês</button><button className={period === "custom" ? "active" : ""} onClick={() => setPeriod("custom")}>Personalizado</button>{period === "custom" && <><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></>}<input placeholder="Cliente ou e-mail" value={customer} onChange={(event) => setCustomer(event.target.value)} /><select value={sellerId} onChange={(event) => setSellerId(event.target.value)}><option value="">Todos os lojistas</option>{overview.data?.sellers.map((seller) => <option value={seller.id} key={seller.id}>{seller.storeName}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option>{["PENDING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELED", "REFUNDED"].map((item) => <option key={item}>{item}</option>)}</select></div><div className="admin-operation-grid"><section className="admin-operation-panel"><div className="section-heading"><h3><FileSearch size={17} /> Pedidos filtrados</h3><strong>{orders.data?.length ?? 0}</strong></div>{orders.data?.map((order) => <div className="operation-row" key={order.id}><span><strong>{order.customer.name}</strong><small>{order.seller.storeName} · {new Date(order.createdAt).toLocaleDateString("pt-BR")}</small></span><span><b>{formatPrice(order.total)}</b><small>{order.status}</small></span></div>)}</section><section className="admin-operation-panel"><div className="section-heading"><h3><Store size={17} /> Lojistas</h3><strong>{overview.data?.sellers.length ?? 0}</strong></div>{overview.data?.sellers.map((seller) => <div className="operation-row" key={seller.id}><button className="operation-main" onClick={() => setSelectedSellerId(seller.id)}><strong>{seller.storeName}</strong><small>{seller.sales.orders} vendas · {formatPrice(seller.sales.total)}</small></button><select value={seller.approvalStatus} onChange={(event) => updateSeller.mutate({ id: seller.id, status: event.target.value })}><option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option>SUSPENDED</option></select></div>)}{sellerDetail.data && <div className="seller-detail"><strong>{sellerDetail.data.storeName}</strong><small>{sellerDetail.data.products.length} produtos · {sellerDetail.data.orders.length} pedidos no histórico</small></div>}</section><section className="admin-operation-panel"><div className="section-heading"><h3><Wallet size={17} /> Saques</h3><strong>{withdrawals.data?.length ?? 0}</strong></div>{withdrawals.data?.map((withdrawal) => <div className="operation-row" key={withdrawal.id}><span><strong>{formatPrice(withdrawal.amount)}</strong><small>{new Date(withdrawal.requestedAt).toLocaleDateString("pt-BR")}</small></span><select value={withdrawal.status} onChange={(event) => updateWithdrawal.mutate({ id: withdrawal.id, status: event.target.value })}><option>REQUESTED</option><option>APPROVED</option><option>PAID</option><option>REJECTED</option></select></div>)}</section><section className="admin-operation-panel"><div className="section-heading"><h3><Bell size={17} /> Notificações</h3><strong>{notifications.data?.filter((item) => !item.readAt).length ?? 0}</strong></div>{notifications.data?.slice(0, 8).map((item) => <div className="operation-row" key={item.id}><span><strong>{item.title}</strong><small>{item.body}</small></span></div>)}</section><section className="admin-operation-panel audit-panel"><div className="section-heading"><h3><History size={17} /> Auditoria</h3><strong>{audit.data?.length ?? 0}</strong></div>{audit.data?.slice(0, 12).map((item) => <div className="operation-row" key={item.id}><span><strong>{item.action}</strong><small>{item.entityType} · {item.user?.name ?? "Sistema"}</small></span><small>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</small></div>)}</section></div></section>;
}
