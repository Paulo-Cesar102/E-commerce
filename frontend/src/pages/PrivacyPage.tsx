import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeading } from "../components/UI";
import { useAuthStore } from "../store/auth";

export function PrivacyPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function exportData() {
    setBusy(true); setError("");
    try { const data = await api<unknown>("/privacy/export"); const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "meus-dados-vitrine.json"; link.click(); URL.revokeObjectURL(url); }
    catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
  }
  async function deleteAccount() {
    if (!window.confirm("Excluir sua conta? Seus dados pessoais e sessões serão removidos. Pedidos e registros financeiros exigidos poderão ser mantidos anonimizados.")) return;
    setBusy(true); setError("");
    try { await api("/privacy/account", { method: "DELETE", retry: false }); logout(); navigate("/", { replace: true }); }
    catch (caught) { setError((caught as Error).message); setBusy(false); }
  }
  return <div className="page-container"><PageHeading eyebrow="Sua conta" title="Privacidade e dados" description="Baixe uma cópia dos dados associados à sua conta ou solicite a exclusão." /><div className="orders-list"><article className="order-card"><h2>Exportar meus dados</h2><p>Baixe seus dados de perfil, endereços, pedidos, favoritos e consentimentos em JSON.</p><button className="button button-primary" onClick={() => void exportData()} disabled={busy}>Baixar meus dados</button></article><article className="order-card"><h2>Excluir conta</h2><p>A sessão será revogada e os dados pessoais apagados. Registros financeiros necessários para pedidos poderão ser mantidos anonimizados.</p><button className="button button-ghost" onClick={() => void deleteAccount()} disabled={busy}>Excluir minha conta</button></article>{error && <p className="form-error">{error}</p>}</div></div>;
}
