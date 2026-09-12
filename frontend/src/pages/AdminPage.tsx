import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, CircleAlert, Headset, Send, Shield, ShoppingBag, Ticket, Wallet } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { API_URL } from "../lib/api";
import { formatPrice } from "../lib/format";
import { EmptyState, Loader, PageHeading } from "../components/UI";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../store/auth";

type SupportChat = { id: string; updatedAt: string; buyer: { name: string; email: string }; seller: { storeName: string }; messages: Array<{ id?: string; content: string; createdAt: string; senderId?: string }> };
type Overview = { pendingKyc: Array<{ id: string; storeName: string; approvalStatus: string; user: { name: string; email: string } }>; orders: Array<{ id: string; status: string; customer: { name: string }; seller: { storeName: string } }>; coupons: Array<{ id: string; code: string; active: boolean; usedCount: number }>; sellers: Array<{ id: string; storeName: string; approvalStatus: string; user: { name: string; email: string }; _count: { products: number; orders: number }; sales: { total: string | number; platformFee: string | number; orders: number } }>; supportChats: SupportChat[]; withdrawals: Array<{ id: string; amount: string | number; status: string; requestedAt: string; note?: string | null }>; finance: { grossSales: string | number; platformFees: string | number; availableFees: string | number; pendingFees: string | number; paidOrders: number; recentFees: Array<{ id: string; platformFee: string | number; total: string | number; createdAt: string; seller: { storeName: string } }>; salesChart: Record<string, { sales: number; fees: number }> } };

function SupportCenter({ chats, accessToken, onRefresh }: { chats: SupportChat[]; accessToken: string | null; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<SupportChat | null>(null);
  const [message, setMessage] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const selected = chats.find((chat) => chat.id === selectedId) ?? chats[0];

  useEffect(() => {
    if (!accessToken) return;
    const socket = io(API_URL, { auth: { token: accessToken } });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("admin:join"));
    socket.on("chat:message", (incoming: SupportChat["messages"][number]) => setDetail((current) => current ? { ...current, messages: [...current.messages, incoming] } : current));
    return () => { socket.disconnect(); };
  }, [accessToken]);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    void api<SupportChat>(`/chats/${selected.id}/admin`).then(setDetail);
    socketRef.current?.emit("chat:join", selected.id);
  }, [selected?.id]);

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || !detail) return;
    socketRef.current?.emit("chat:message", { chatId: detail.id, content: message.trim() });
    setMessage("");
  }

  async function closeTicket() {
    if (!detail) return;
    await api(`/chats/${detail.id}/close`, { method: "PATCH" });
    setDetail(null);
    onRefresh();
  }

  return <section className="support-center"><div className="support-center-head"><div><span className="eyebrow">Atendimento</span><h2><Headset size={19} /> Central de chamados</h2><p>Responda clientes e lojistas sem sair do painel.</p></div><strong>{chats.length} abertos</strong></div><div className="support-layout"><aside className="support-tickets">{chats.length ? chats.map((chat) => <button className={selected?.id === chat.id ? "active" : ""} key={chat.id} onClick={() => setSelectedId(chat.id)}><span className="support-avatar">{chat.buyer.name.slice(0, 1).toUpperCase()}</span><span><strong>{chat.buyer.name}</strong><small>{chat.seller.storeName}</small><em>{chat.messages[0]?.content ?? "Chamado iniciado"}</em></span></button>) : <div className="support-empty"><Headset size={25} /><p>Nenhum chamado aberto.</p></div>}</aside>{detail ? <div className="support-conversation"><header><div><strong>{detail.buyer.name}</strong><small>{detail.buyer.email} · {detail.seller.storeName}</small></div><button className="button button-dark" onClick={() => void closeTicket()}>Encerrar chamado</button></header><div className="support-messages">{detail.messages.map((item, index) => <div className="support-message" key={item.id ?? `${item.createdAt}-${index}`}><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div>)}</div><form className="support-reply" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Responder ao chamado..." /><button aria-label="Enviar resposta"><Send size={17} /></button></form></div> : <div className="support-empty"><Headset size={30} /><p>Selecione um chamado para responder.</p></div>}</div></section>;
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { data, isLoading } = useQuery({ queryKey: ["admin-overview"], queryFn: () => api<Overview>("/admin/overview") });
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const requestWithdrawal = useMutation({ mutationFn: () => api("/admin/withdrawals", { method: "POST", body: JSON.stringify({ amount: Number(withdrawalAmount.replace(",", ".")) }) }), onSuccess: () => { setWithdrawalAmount(""); queryClient.invalidateQueries({ queryKey: ["admin-overview"] }); } });
  const reviewKyc = useMutation({ mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" | "SUSPENDED" }) => api(`/admin/kyc/${id}`, { method: "PATCH", body: JSON.stringify({ approvalStatus: status }) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }) });
  useEffect(() => {
    if (!accessToken) return;
    const socket: Socket = io(API_URL, { auth: { token: accessToken } });
    socket.on("connect", () => socket.emit("admin:join"));
    socket.on("admin:refresh", () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }));
    return () => { socket.disconnect(); };
  }, [accessToken, queryClient]);
  if (isLoading) return <Loader label="Abrindo administração" />;
  if (!data) return <div className="page-container"><EmptyState title="Painel indisponível" text="Não foi possível carregar os dados administrativos." /></div>;
  const chartData = Object.entries(data.finance.salesChart).map(([date, values]) => ({ date: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), sales: values.sales, fees: values.fees }));
  return <div className="page-container admin-page"><PageHeading eyebrow="Central de controle" title="Administração" description="Acompanhe dinheiro, lojistas e operação da Vitrine." action={<span className="admin-live-status"><i /> Sistema operacional</span>} /><div className="admin-kpis"><div><span className="admin-kpi-icon coral"><Wallet size={19} /></span><span><small>Saldo disponível</small><strong>{formatPrice(data.finance.availableFees)}</strong><em>Pronto para solicitar saque</em></span></div><div><span className="admin-kpi-icon green"><ShoppingBag size={19} /></span><span><small>Vendas processadas</small><strong>{formatPrice(data.finance.grossSales)}</strong><em>{data.finance.paidOrders} pedidos aprovados</em></span></div><div><span className="admin-kpi-icon blue"><Shield size={19} /></span><span><small>Saldo pendente</small><strong>{formatPrice(data.finance.pendingFees)}</strong><em>Em solicitações de saque</em></span></div></div><section className="admin-finance"><div className="admin-finance-head"><div><span className="eyebrow">Carteira da plataforma</span><h2>{formatPrice(data.finance.platformFees)}</h2><p>Comissão registrada sobre pedidos aprovados.</p></div><form className="withdrawal-form" onSubmit={(event) => { event.preventDefault(); requestWithdrawal.mutate(); }}><label>Solicitar saque<input required min="0.01" max={Number(data.finance.availableFees)} step="0.01" value={withdrawalAmount} onChange={(event) => setWithdrawalAmount(event.target.value)} placeholder="Valor" /></label><button className="button button-dark" disabled={requestWithdrawal.isPending || Number(data.finance.availableFees) <= 0}><Wallet size={17} /> Solicitar saque</button></form></div><div className="admin-chart"><div className="section-heading"><h2>Vendas e comissão</h2><span>Histórico completo por dia</span></div>{chartData.length ? <ResponsiveContainer width="100%" height={220}><AreaChart data={chartData}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e8553d" stopOpacity={0.35} /><stop offset="95%" stopColor="#e8553d" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `R$${value}`} /><Tooltip formatter={(value) => formatPrice(Number(value ?? 0))} /><Area type="monotone" dataKey="sales" name="Vendas" stroke="#e8553d" fill="url(#salesFill)" strokeWidth={2} /><Area type="monotone" dataKey="fees" name="Comissão" stroke="#f0ba32" fill="none" strokeWidth={2} /></AreaChart></ResponsiveContainer> : <div className="chart-empty">Ainda não há vendas suficientes para formar o gráfico.</div>}</div><div className="admin-finance-list"><div className="section-heading"><h2>Histórico de saques</h2><span>{data.withdrawals.length} solicitações</span></div>{data.withdrawals.length ? data.withdrawals.map((withdrawal) => <div className="dashboard-row" key={withdrawal.id}><span><strong>{formatPrice(withdrawal.amount)}</strong><small>{new Date(withdrawal.requestedAt).toLocaleDateString("pt-BR")}</small></span><span className="status-pill">{withdrawal.status}</span></div>) : <p>Nenhum saque solicitado.</p>}</div></section><div className="admin-sections"><section className="admin-panel admin-panel-wide"><div className="section-heading"><h2><Shield size={18} /> Gestão de lojistas</h2><strong>{data.sellers.length}</strong></div>{data.sellers.map((seller) => <div className="dashboard-row seller-admin-row" key={seller.id}><span><strong>{seller.storeName}</strong><small>{seller.user.name} · {seller.sales.orders} vendas · {formatPrice(seller.sales.total)}</small></span><span className="seller-actions"><span className="status-pill">{seller.approvalStatus}</span>{seller.approvalStatus === "PENDING" && <><button title="Aprovar" onClick={() => reviewKyc.mutate({ id: seller.id, status: "APPROVED" })}><Check size={15} /></button><button title="Rejeitar" onClick={() => reviewKyc.mutate({ id: seller.id, status: "REJECTED" })}><CircleAlert size={15} /></button></>}</span></div>)}{!data.sellers.length && <div className="admin-empty"><Shield size={24} /><p>Nenhum lojista cadastrado.</p></div>}</section><section className="admin-panel"><div className="section-heading"><h2><Headset size={18} /> Chamados abertos</h2><strong>{data.supportChats.length}</strong></div>{data.supportChats.length ? data.supportChats.slice(0, 7).map((chat) => <div className="dashboard-row" key={chat.id}><span><strong>{chat.buyer.name}</strong><small>{chat.seller.storeName} · {chat.messages[0]?.content ?? "Sem mensagens"}</small></span><span className="status-pill">ABERTO</span></div>) : <div className="admin-empty"><Headset size={24} /><p>Nenhum chamado aberto.</p></div>}<button className="admin-panel-link">Abrir central de suporte <ArrowUpRight size={15} /></button></section><section className="admin-panel"><div className="section-heading"><h2><Ticket size={18} /> Cupons ativos</h2><strong>{data.coupons.length}</strong></div>{data.coupons.length ? data.coupons.slice(0, 6).map((coupon) => <div className="dashboard-row" key={coupon.id}><span><strong>{coupon.code}</strong><small>{coupon.usedCount} resgates</small></span><span>{coupon.active ? <Check size={17} className="coupon-active" /> : "Inativo"}</span></div>) : <div className="admin-empty"><Ticket size={24} /><p>Nenhum cupom criado.</p></div>}<button className="admin-panel-link">Gerenciar cupons <ArrowUpRight size={15} /></button></section></div></div>;
}