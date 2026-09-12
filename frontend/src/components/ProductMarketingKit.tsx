import { useState } from "react";
import { Check, Copy, Download, Link as LinkIcon, Megaphone, Store } from "lucide-react";
import { formatPrice } from "../lib/format";
import { createProductShareLink, downloadProductStory } from "../lib/marketing";
import type { Product } from "../types";

export function ProductMarketingKit({ product, image }: { product: Product; image: string }) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const link = createProductShareLink(product.id, product.seller?.id);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function generateStory() {
    setIsGenerating(true);
    try {
      await downloadProductStory({ title: product.name, price: formatPrice(product.price), imageUrl: image, storeName: product.seller?.storeName, productId: product.id });
    } finally {
      setIsGenerating(false);
    }
  }

  return <section className="marketing-kit" aria-labelledby="marketing-kit-title">
    <div className="marketing-store"><span className="marketing-store-avatar">{(product.seller?.storeName ?? "S").slice(0, 1).toUpperCase()}</span><span><small>Divulgação da loja</small><strong>{product.seller?.storeName ?? "Sua loja"}</strong></span><Store size={18} /></div>
    <div className="marketing-kit-heading"><span className="marketing-kit-icon"><Megaphone size={20} /></span><div><h2 id="marketing-kit-title">Kit de divulgação</h2><p>Crie um Story pronto e compartilhe o produto com rastreio.</p></div></div>
    <label className="marketing-link-label" htmlFor="product-share-link">Link rastreável do produto</label>
    <div className="marketing-link-row"><input id="product-share-link" readOnly value={link} /><button className="icon-button bordered" onClick={copyLink} title="Copiar link" aria-label="Copiar link">{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
    <button className="button button-primary full marketing-story-button" onClick={() => void generateStory()} disabled={isGenerating}><Download size={18} /> {isGenerating ? "Gerando arte..." : "Baixar Story 1080 x 1920"}</button>
    <span className="marketing-kit-note"><LinkIcon size={14} /> O link já inclui parâmetros para futuras campanhas e afiliados.</span>
  </section>;
}