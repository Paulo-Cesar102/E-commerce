import { useState } from "react";
import { BarChart3, FileSearch, Headset, Store, Wallet } from "lucide-react";

export type AdminTab = "overview" | "finance" | "support" | "sellers" | "audit";

export function AdminCommandBar({ active, onChange }: { active: AdminTab; onChange: (tab: AdminTab) => void }) {
  return <nav className="admin-command-bar" aria-label="Abas administrativas"><span className="admin-command-label">Painel B2B</span><button className={active === "overview" ? "active" : ""} onClick={() => onChange("overview")}><BarChart3 size={16} /> Visão geral</button><button className={active === "finance" ? "active" : ""} onClick={() => onChange("finance")}><Wallet size={16} /> Financeiro</button><button className={active === "support" ? "active" : ""} onClick={() => onChange("support")}><Headset size={16} /> Chamados</button><button className={active === "sellers" ? "active" : ""} onClick={() => onChange("sellers")}><Store size={16} /> Lojistas</button><button className={active === "audit" ? "active" : ""} onClick={() => onChange("audit")}><FileSearch size={16} /> Auditoria</button></nav>;
}
