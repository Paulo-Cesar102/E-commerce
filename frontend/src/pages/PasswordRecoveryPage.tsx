import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeading } from "../components/UI";

type RequestResult = { requested: true; token?: string };

export function PasswordRecoveryPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "");
  const [password, setPassword] = useState("");
  const [issuedToken, setIssuedToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).has("token")) window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
  }, []);
  async function request(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { const result = await api<RequestResult>("/auth/password-reset/request", { method: "POST", auth: false, body: JSON.stringify({ email }) }); setIssuedToken(result.token ?? ""); setMessage("Se a conta existir, enviaremos as instrucoes de recuperacao para o e-mail cadastrado."); }
    catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
  }
  async function reset(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { await api("/auth/password-reset/confirm", { method: "POST", auth: false, body: JSON.stringify({ token, password }) }); setMessage("Senha atualizada. Entre novamente com sua nova senha."); setToken(""); setPassword(""); }
    catch (caught) { setError((caught as Error).message); } finally { setBusy(false); }
  }
  return <div className="page-container"><PageHeading eyebrow="Acesso à conta" title="Recuperar senha" description="Receba um link por e-mail e escolha uma nova senha." /><div className="address-form"><form onSubmit={request}><label>E-mail cadastrado<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="button button-primary" disabled={busy}>Enviar link de recuperacao</button></form>{issuedToken && <p className="form-error">Token de desenvolvimento: <code>{issuedToken}</code></p>}<form onSubmit={reset}><label>Token de recuperacao<input required value={token} onChange={(event) => setToken(event.target.value)} /></label><label>Nova senha<input type="password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button button-primary" disabled={busy}>Atualizar senha</button></form>{message && <p>{message}</p>}{error && <p className="form-error">{error}</p>}<Link to="/entrar">Voltar para entrar</Link></div></div>;
}
