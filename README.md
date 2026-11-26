# E-commerce

## Planos para lojistas

- **Grátis:** até 10 produtos ativos, vitrine pública, pedidos locais pelo WhatsApp e acesso ao painel/mensagens. A loja precisa configurar WhatsApp, cidade e UF.
- **Pro:** R$ 25/mês, checkout no aplicativo, Mercado Pago, frete/envio e catálogo sem limite de produtos ativos.
- Lojas grátis aparecem na busca local quando o comprador informa cidade e UF. O checkout do app só aceita lojas Pro; o backend também valida isso.
- O Pro só é liberado após confirmação do Mercado Pago por webhook.

Para habilitar assinaturas, configure `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `PRO_MONTHLY_PRICE` e `FRONTEND_URL` no ambiente do backend. No painel do Mercado Pago, cadastre o webhook de assinaturas/preapproval apontando para:

`https://<dominio-da-api>/seller/subscription/mercado-pago/webhook`

O preço padrão é R$ 25 por mês. Não coloque credenciais reais em arquivos versionados.

## Venda rápida

- Qualquer usuário pode anunciar um item próprio; cada anúncio começa com estoque único.
- Usuários sem Pro podem manter um anúncio ativo por vez. O Pro de lojista também libera anúncios ativos ilimitados.
- As vendas usam o checkout do Mercado Pago e o frete dos Correios, calculado com o CEP de origem informado no anúncio.
- A comissão da plataforma é de 5% sobre o valor do item após descontos, sem incluir o frete.
- Cada checkout de Venda rápida deve conter itens do mesmo anunciante e CEP, separados dos produtos de loja.
- O anunciante informa o código de rastreio e marca a entrega. O repasse líquido fica disponível para pagamento manual pelo administrador após a entrega e o prazo de devolução de 7 dias.
- O processo de análise e resolução de solicitações de devolução de Venda rápida ainda precisa ser concluído antes do lançamento.

