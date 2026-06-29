import type { ReactNode } from "react";
import { AlertCircle, PackageOpen } from "lucide-react";
import clsx from "clsx";
import type { OrderStatus } from "../types";

export function Loader({ label = "Carregando" }: { label?: string }) {
  return <div className="loader-wrap"><span className="spinner" /><span>{label}</span></div>;
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><PackageOpen size={38} /><h2>{title}</h2><p>{text}</p>{action}</div>;
}

export function ErrorState({ message }: { message?: string }) {
  return <div className="error-state"><AlertCircle size={28} /><div><strong>Algo não saiu como esperado</strong><p>{message ?? "Tente novamente em instantes."}</p></div></div>;
}

const statusLabels: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pagamento aprovado",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={clsx("status-badge", `status-${status.toLowerCase()}`)}>{statusLabels[status]}</span>;
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}
