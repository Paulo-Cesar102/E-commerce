import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Store } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import type { User } from "../types";

type AuthResponse = { user: User; accessToken: string };

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const [seller, setSeller] = useState(params.get("tipo") === "vendedor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", storeName: "", acceptTerms: false });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api<AuthResponse>(mode === "login" ? "/auth/login" : "/auth/register", {
        method: "POST",
        auth: false,
        body: JSON.stringify(mode === "login" ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password, role: seller ? "SELLER" : "CUSTOMER", acceptTerms: form.acceptTerms, ...(seller ? { storeName: form.storeName } : {}) }),
      });
      setSession(response);
      const target = (location.state as { from?: string } | null)?.from;
      navigate(target ?? (response.user.role === "CUSTOMER" ? "/" : "/dashboard"));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle(credential: string) {
    setLoading(true);
    setError("");
    try {
      const response = await api<AuthResponse>("/auth/google", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ credential }),
      });
      setSession(response);
      const target = (location.state as { from?: string } | null)?.from;
      navigate(target ?? (response.user.role === "CUSTOMER" ? "/" : "/dashboard"));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <img src="/assets/vitrine-hero.png" alt="" />
        <div className="auth-visual-overlay" />
        <div className="auth-visual-copy">
          <span className="brand brand-light"><span className="brand-mark">V</span><span>VITRINE</span></span>
          <h2>{mode === "login" ? "Que bom ter você de volta." : seller ? "Sua loja merece uma vitrine à altura." : "Sua próxima descoberta começa aqui."}</h2>
          <ul><li><CheckCircle2 /> Compra e pagamento protegidos</li><li><CheckCircle2 /> Acompanhe cada pedido</li><li><CheckCircle2 /> Converse direto com a loja</li></ul>
        </div>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-heading"><span className="eyebrow">{mode === "login" ? "Bem-vindo de volta" : "Comece agora"}</span><h1>{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</h1><p>{mode === "login" ? "Acesse seus pedidos, mensagens e favoritos." : "Leva menos de um minuto."}</p></div>
          {mode === "register" && <div className="role-selector"><button type="button" className={!seller ? "active" : ""} onClick={() => setSeller(false)}>Quero comprar</button><button type="button" className={seller ? "active" : ""} onClick={() => setSeller(true)}><Store size={16} /> Quero vender</button></div>}
          {mode === "register" && <label>Nome completo<input required minLength={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Como podemos chamar você?" /></label>}
          {mode === "register" && seller && <label>Nome da loja<input required minLength={2} value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} placeholder="Ex.: Casa Aurora" /></label>}
          <label>E-mail<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="voce@email.com" /></label>
          <label>Senha<div className="password-input"><input required minLength={mode === "register" ? 6 : 1} type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Sua senha" /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {mode === "register" && <label><input required type="checkbox" checked={form.acceptTerms} onChange={(event) => setForm({ ...form, acceptTerms: event.target.checked })} /> Li e aceito os termos de uso e a política de privacidade.</label>}
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary full auth-submit" disabled={loading}>{loading ? "Só um instante..." : mode === "login" ? "Entrar" : "Criar minha conta"} <ArrowRight size={18} /></button>
          <div className="auth-security"><LockKeyhole size={15} /> Seus dados são protegidos</div>
          <p className="auth-switch">{mode === "login" ? "Ainda não tem conta?" : "Já tem uma conta?"} <Link to={mode === "login" ? "/criar-conta" : "/entrar"}>{mode === "login" ? "Cadastre-se" : "Entrar"}</Link></p>
          {mode === "login" && (
            <>
              <div className="auth-divider"><span>ou</span></div>
              <div className="google-login">
                <GoogleLogin
                  onSuccess={(response) => { if (response.credential) void loginWithGoogle(response.credential); }}
                  onError={() => setError("Nao foi possivel entrar com o Google. Tente novamente.")}
                  text="signin_with"
                  width="430"
                />
              </div>
            </>
          )}
        </form>
      </section>
    </div>
  );
}
