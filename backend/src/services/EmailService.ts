import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

export class EmailService {
  async sendPasswordReset(to: string, resetUrl: string) {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new AppError(503, "Recuperacao por e-mail nao configurada");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject: "Redefina sua senha da Vitrine",
        text: `Recebemos uma solicitacao para redefinir a senha da sua conta. Use este link em ate uma hora: ${resetUrl}\n\nSe voce nao solicitou a troca, ignore esta mensagem.`,
        html: `<p>Recebemos uma solicitacao para redefinir a senha da sua conta Vitrine.</p><p><a href="${resetUrl}">Criar uma nova senha</a></p><p>O link expira em uma hora. Se voce nao solicitou a troca, ignore esta mensagem.</p>`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      // Avoid logging the recipient, reset URL, API key, or provider response body.
      console.error(`Password reset email provider returned HTTP ${response.status}`);
      throw new AppError(502, "Nao foi possivel enviar o e-mail de recuperacao agora");
    }
  }
}
