import { Bell, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { EmptyState, Loader, PageHeading } from "../components/UI";

type Notification = { id: string; title: string; body: string; readAt?: string | null; createdAt: string };

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => api<Notification[]>("/notifications") });
  const markRead = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "PATCH" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }) });
  if (isLoading) return <Loader label="Abrindo notificações" />;
  return <div className="page-container"><PageHeading eyebrow="Acompanhe tudo" title="Notificações" description="Atualizações sobre pedidos, pagamentos e sua conta" />{notifications.length ? <div className="stack-list">{notifications.map((notification) => <article className={`notification-item ${notification.readAt ? "" : "is-unread"}`} key={notification.id}><Bell size={18} /><div><strong>{notification.title}</strong><p>{notification.body}</p><small>{new Date(notification.createdAt).toLocaleString("pt-BR")}</small></div>{!notification.readAt && <button className="icon-button" title="Marcar como lida" onClick={() => markRead.mutate(notification.id)}><Check size={17} /></button>}</article>)}</div> : <EmptyState title="Nenhuma notificação" text="Você será avisado quando houver novidades." />}</div>;
}