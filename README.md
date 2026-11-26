# E-commerce

## Planos para lojistas

- **Grátis:** até 10 produtos ativos, vitrine pública, pedidos locais pelo WhatsApp e acesso ao painel/mensagens. A loja precisa configurar WhatsApp, cidade e UF.
- **Pro:** R$ 25/mês, checkout no aplicativo, Mercado Pago, frete/envio e catálogo sem limite de produtos ativos.
- Lojas grátis aparecem na busca local quando o comprador informa cidade e UF. O checkout do app só aceita lojas Pro; o backend também valida isso.
- O Pro só é liberado após confirmação do Mercado Pago por webhook.

Para habilitar assinaturas, configure `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `PRO_MONTHLY_PRICE`, `FRONTEND_URL` e `API_PUBLIC_URL` no ambiente do backend. Cada assinatura envia notificações de preapproval e cobranças recorrentes ao endpoint:

`https://<dominio-da-api>/seller/subscription/mercado-pago/webhook`

O preço padrão é R$ 25 por mês. Não coloque credenciais reais em arquivos versionados.

As cobranças recorrentes confirmadas são registradas separadamente da comissão de pedidos e contabilizadas como receita da plataforma. Para saques de lojistas, o fluxo inicial é manual via Pix: o lojista informa a chave, o admin aprova e registra a referência do comprovante depois de transferir. O sistema não envia Pix automaticamente.

## Venda rápida

- Qualquer usuário pode anunciar um item próprio; cada anúncio começa com estoque único.
- Usuários sem Pro podem manter um anúncio ativo por vez. O Pro de lojista também libera anúncios ativos ilimitados.
- As vendas usam o checkout do Mercado Pago e o frete dos Correios, calculado com o CEP de origem informado no anúncio.
- A comissão da plataforma é de 5% sobre o valor do item após descontos, sem incluir o frete.
- Cada checkout de Venda rápida deve conter itens do mesmo anunciante e CEP, separados dos produtos de loja.
- O anunciante informa o código de rastreio e marca a entrega. O repasse líquido fica disponível para pagamento manual pelo administrador após a entrega e o prazo de devolução de 7 dias.
- O administrador pode analisar devoluções de pedidos de loja e de Venda rápida, negando com justificativa ou solicitando estorno integral pelo Mercado Pago.

## Limites da API

- A API limita cada IP a 100 requisições por janela de 15 minutos.
- Login, Google e recuperação de senha permitem até 8 tentativas por 15 minutos; cadastro permite 5 e renovação de sessão, 30.
- A busca de produtos aceita até 30 resultados por página e páginas de 1 a 1.000.

