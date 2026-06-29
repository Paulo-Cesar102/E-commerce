import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return <div className="not-found"><span>404</span><h1>Essa página saiu da vitrine.</h1><p>O endereço pode ter mudado ou não existe mais.</p><Link className="button button-primary" to="/"><ArrowLeft size={18} /> Voltar ao início</Link></div>;
}
