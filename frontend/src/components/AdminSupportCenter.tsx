import { useEffect, useState, type FormEvent } from "react";
import { Headset, Send } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../lib/api";
import { useAuthStore } from "../store/auth";

type Ticket = { id: string; updatedAt: string; buyer: { name: string; email: string }; seller: { storeName: string }; messages: Array<{ id?: string; content: string; createdAt: string; senderId?: string }> };

export function AdminSupportCenter() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [message, setMessage] = useState("");
  const { data: tickets = [] } = useQuery({ queryKey: ["admin-support-chats"], queryFn: async () => (await api<{ supportChats: Ticket[] }>("/admin/overview")).supportChats, enabled: Boolean(accessToken), staleTime: 15_000 });

  useEffect(() => {
    if (!accessToken) return;
    const socket: Socket = io(API_URL, { auth: { token: accessToken } });
    socket.on("connect", () => socket.emit("admin:join"));
    socket.on("chat:message", (incoming: Ticket["messages"][number]) => setDetail((current) => current ? { ...current, messages: [...current.messages, incoming] } : current));
    socket.on("admin:refresh", () => queryClient.invalidateQueries({ queryKey: ["admin-support-chats"] }));
    return () => { socket.disconnect(); };
  }, [accessToken, queryClient]);

  useEffect(() => {
    const ticket = tickets.find((item) => item.id === selectedId) ?? tickets[0];
    if (!ticket) return;
    setSelectedId(ticket.id);
    void api<Ticket>(`/chats/${ticket.id}/admin`).then(setDetail);
  }, [selectedId, tickets]);

  useEffect(() => {
    const openCenter = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const trigger = target.closest("button");
      if (trigger?.textContent?.includes("Abrir central de suporte")) document.querySelector(".admin-support-center")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("click", openCenter);
    return () => document.removeEventListener("click", openCenter);
  }, []);

  function send(event: FormEvent) {
    event.preventDefault();
    if (!detail || !message.trim()) return;
    const socket = io(API_URL, { auth: { token: accessToken } });
    socket.emit("admin:join");
    socket.emit("chat:join", detail.id);
    socket.emit("chat:message", { chatId: detail.id, content: message.trim() });
    window.setTimeout(() => socket.disconnect(), 500);
    setMessage("");
  }

  async function closeTicket() {
    if (!detail) return;
    await api(`/chats/${detail.id}/close`, { method: "PATCH" });
    setDetail(null);
    queryClient.invalidateQueries({ queryKey: ["admin-support-chats"] });
  }

  return <section className="admin-support-center"><header><div><span className="eyebrow">Atendimento</span><h2><Headset size={19} /> Central de chamados</h2><p>Responda clientes e lojistas em tempo real.</p></div><strong>{tickets.length} abertos</strong></header><div className="admin-support-layout"><aside>{tickets.length ? tickets.map((ticket) => <button className={detail?.id === ticket.id ? "active" : ""} key={ticket.id} onClick={() => setSelectedId(ticket.id)}><span className="support-avatar">{ticket.buyer.name.slice(0, 1).toUpperCase()}</span><span><strong>{ticket.buyer.name}</strong><small>{ticket.seller.storeName}</small><em>{ticket.messages[0]?.content ?? "Chamado iniciado"}</em></span></button>) : <div className="support-empty"><Headset size={27} /><p>Nenhum chamado aberto.</p></div>}</aside>{detail ? <div className="admin-support-conversation"><header><div><strong>{detail.buyer.name}</strong><small>{detail.buyer.email} · {detail.seller.storeName}</small></div><button className="button button-dark" onClick={() => void closeTicket()}>Encerrar chamado</button></header><div className="support-messages">{detail.messages.map((item, index) => <div className="support-message" key={item.id ?? `${item.createdAt}-${index}`}><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></div>)}</div><form className="support-reply" onSubmit={send}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Responder ao chamado..." /><button aria-label="Enviar resposta"><Send size={17} /></button></form></div> : <div className="support-empty"><Headset size={30} /><p>Selecione um chamado para responder.</p></div>}</div></section>;
}
