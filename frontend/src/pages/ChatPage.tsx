import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send, ShoppingBag } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { api, API_URL } from "../lib/api";
import { formatDate, getInitials } from "../lib/format";
import { useAuthStore } from "../store/auth";
import type { Chat, ChatMessage } from "../types";
import { EmptyState, ErrorState, Loader, PageHeading } from "../components/UI";

export function ChatPage() {
  const queryClient = useQueryClient();
  const { user, accessToken } = useAuthStore();
  const [activeId, setActiveId] = useState<string>();
  const [message, setMessage] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: chats = [], isLoading, error } = useQuery({ queryKey: ["chats"], queryFn: () => api<Chat[]>("/chats") });
  const active = chats.find((chat) => chat.id === activeId) ?? chats[0];

  useEffect(() => {
    if (!accessToken) return;
    const socket = io(API_URL, { auth: { token: accessToken } });
    socketRef.current = socket;
    socket.on("chat:message", (incoming: ChatMessage) => {
      queryClient.setQueryData<Chat[]>(["chats"], (current = []) => current.map((chat) => chat.id === active?.id ? { ...chat, messages: [...chat.messages, incoming] } : chat));
    });
    return () => { socket.disconnect(); };
  }, [accessToken, active?.id, queryClient]);

  useEffect(() => {
    if (active) socketRef.current?.emit("chat:join", active.id);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active, active?.messages.length]);

  function send(event: FormEvent) {
    event.preventDefault();
    if (!message.trim() || !active) return;
    socketRef.current?.emit("chat:message", { chatId: active.id, content: message.trim() });
    setMessage("");
  }

  if (isLoading) return <Loader label="Abrindo suas conversas" />;
  return <div className="page-container chat-page">
    <PageHeading eyebrow="Atendimento direto" title="Mensagens" description="Converse com a loja sem sair da Vitrine." />
    {error && <ErrorState message={(error as Error).message} />}
    {!error && !chats.length && <EmptyState title="Nenhuma conversa iniciada" text="Na página de um produto, toque em “Falar com a loja” para começar." />}
    {chats.length > 0 && <div className="chat-shell">
      <aside className="chat-list"><div className="chat-list-title">Conversas <span>{chats.length}</span></div>{chats.map((chat) => { const otherName = user?.role === "CUSTOMER" ? chat.seller.storeName : chat.buyer.name; const last = chat.messages.at(-1); return <button className={active?.id === chat.id ? "active" : ""} key={chat.id} onClick={() => setActiveId(chat.id)}><span className="avatar">{getInitials(otherName)}</span><span><strong>{otherName}</strong><small>{last?.content ?? "Conversa iniciada"}</small></span></button>; })}</aside>
      {active && <section className="conversation">
        <header><div className="avatar">{getInitials(user?.role === "CUSTOMER" ? active.seller.storeName : active.buyer.name)}</div><div><strong>{user?.role === "CUSTOMER" ? active.seller.storeName : active.buyer.name}</strong><span><i /> Atendimento online</span></div>{active.order && <div className="chat-order"><ShoppingBag size={16} /> Pedido #{active.order.id.slice(0, 8)}</div>}</header>
        <div className="messages">{active.messages.map((item) => <div key={item.id} className={item.senderId === user?.id ? "message mine" : "message"}><p>{item.content}</p><time>{new Date(item.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div>)}<div ref={bottomRef} /></div>
        <form className="message-form" onSubmit={send}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva uma mensagem..." /><button aria-label="Enviar"><Send size={19} /></button></form>
      </section>}
    </div>}
  </div>;
}
