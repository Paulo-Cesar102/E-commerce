import bcrypt from "bcrypt";
import prisma from "./prisma.js";
import { slugify } from "../src/utils/slugify.js";

const categories = [
  "Eletrônicos",
  "Celulares e Smartphones",
  "Informática e Computadores",
  "Games e Consoles",
  "TV, Áudio e Vídeo",
  "Eletrodomésticos",
  "Casa, Móveis e Decoração",
  "Cozinha e Utilidades",
  "Moda Feminina",
  "Moda Masculina",
  "Calçados",
  "Bolsas, Malas e Acessórios",
  "Beleza e Cuidados Pessoais",
  "Saude e Bem-estar",
  "Esportes e Fitness",
  "Brinquedos e Hobbies",
  "Bebês",
  "Pet Shop",
  "Supermercado e Alimentos",
  "Bebidas",
  "Livros",
  "Papelaria e Escritório",
  "Automotivo",
  "Ferramentas e Construção",
  "Jardim e Área Externa",
  "Indústria e Comércio",
  "Instrumentos Musicais",
  "Relógios e Joias",
  "Viagem e Lazer",
  "Artesanato",
];

const demoProducts = [
  { category: "Celulares e Smartphones", name: "Smartphone Aurora 128 GB", description: "Smartphone desbloqueado, com tela ampla, câmera nítida e bateria para o dia todo.", price: 1899.9, image: "photo-1511707171634-5f897ff02aa9", alt: "Smartphone moderno" },
  { category: "Informática e Computadores", name: "Notebook Essencial 15 polegadas", description: "Notebook leve para estudos, trabalho e tarefas do dia a dia.", price: 3299.9, image: "photo-1496181133206-80ce9b88a853", alt: "Notebook aberto sobre uma mesa" },
  { category: "Games e Consoles", name: "Controle sem fio para jogos", description: "Controle ergonômico sem fio para aproveitar seus jogos favoritos.", price: 289.9, image: "photo-1486572788966-cfd3df1f5b42", alt: "Acessórios para videogame" },
  { category: "TV, Áudio e Vídeo", name: "Fone Bluetooth com estojo", description: "Fone sem fio compacto com estojo recarregável para ouvir música em qualquer lugar.", price: 249.9, image: "photo-1505740420928-5e560c06d30e", alt: "Fones de ouvido" },
  { category: "Eletrodomésticos", name: "Cafeteira compacta para casa", description: "Cafeteira prática para preparar seu café favorito sem ocupar muito espaço.", price: 379.9, image: "photo-1495474472287-4d71bcdd2085", alt: "Café preparado em casa" },
  { category: "Casa, Móveis e Decoração", name: "Luminária de mesa minimalista", description: "Luminária de design simples para deixar a sala ou o escritório mais aconchegante.", price: 159.9, image: "photo-1600210492486-724fe5c67fb0", alt: "Sala com decoração contemporânea" },
  { category: "Moda Feminina", name: "Bolsa transversal urbana", description: "Bolsa versátil para compor looks do dia a dia com praticidade.", price: 139.9, image: "photo-1483985988355-763728e1935b", alt: "Moda feminina em ambiente urbano" },
  { category: "Calçados", name: "Tênis casual vermelho", description: "Tênis confortável para caminhar e completar combinações casuais.", price: 219.9, image: "photo-1542291026-7eec264c27ff", alt: "Tênis esportivo vermelho" },
  { category: "Eletrônicos", name: "Carregador portátil USB-C", description: "Bateria portátil compacta para manter seus dispositivos carregados durante o dia.", price: 119.9, image: "photo-1518770660439-4636190af475", alt: "Componentes eletrônicos" },
  { category: "Moda Masculina", name: "Jaqueta casual leve", description: "Jaqueta versátil para dias frescos, com corte confortável e visual atemporal.", price: 249.9, image: "photo-1515886657613-9f3515b0c78f", alt: "Look casual contemporâneo" },
  { category: "Bolsas, Malas e Acessórios", name: "Mochila para viagem e trabalho", description: "Mochila espaçosa com compartimentos práticos para rotina e pequenas viagens.", price: 199.9, image: "photo-1553062407-98eeb64c6a62", alt: "Mochila de viagem" },
  { category: "Beleza e Cuidados Pessoais", name: "Kit de cuidados pessoais", description: "Seleção de itens para uma rotina diária simples de autocuidado.", price: 89.9, image: "photo-1596462502278-27bfdc403348", alt: "Produtos de beleza e cuidados pessoais" },
  { category: "Saude e Bem-estar", name: "Tapete para alongamento e yoga", description: "Tapete confortável para alongamento, meditação e exercícios em casa.", price: 129.9, image: "photo-1505751172876-fa1923c5c528", alt: "Bem-estar e cuidados" },
  { category: "Esportes e Fitness", name: "Acessórios para treino funcional", description: "Itens versáteis para montar uma rotina de exercícios em casa ou na academia.", price: 99.9, image: "photo-1517836357463-d25dfeac3438", alt: "Treino em academia" },
  { category: "Brinquedos e Hobbies", name: "Kit de blocos para montar", description: "Brinquedo criativo para montar, inventar histórias e brincar em família.", price: 79.9, image: "photo-1566576912321-d58ddd7a6088", alt: "Brinquedos coloridos" },
  { category: "Bebês", name: "Manta macia para bebê", description: "Manta delicada e confortável para acompanhar os momentos de descanso do bebê.", price: 69.9, image: "photo-1519689680058-324335c77eba", alt: "Enxoval delicado para bebê" },
  { category: "Pet Shop", name: "Cama confortável para pets", description: "Cama macia para seu companheiro descansar com conforto.", price: 149.9, image: "photo-1543466835-00a7907e9de1", alt: "Cachorro de estimação" },
  { category: "Supermercado e Alimentos", name: "Cesta de frutas da estação", description: "Seleção colorida de frutas frescas para completar a mesa da semana.", price: 49.9, image: "photo-1542838132-92c53300491e", alt: "Frutas e vegetais frescos" },
  { category: "Bebidas", name: "Kit de bebidas artesanais", description: "Seleção de bebidas para compartilhar em encontros e ocasiões especiais.", price: 59.9, image: "photo-1514362545857-3bc16c4c7d1b", alt: "Bebidas servidas em uma mesa" },
  { category: "Livros", name: "Livro de histórias para inspirar", description: "Uma leitura envolvente para acompanhar momentos tranquilos.", price: 54.9, image: "photo-1544947950-fa07a98d237f", alt: "Livro aberto" },
  { category: "Papelaria e Escritório", name: "Caderno para ideias e projetos", description: "Caderno versátil para anotações, planejamento e criatividade.", price: 34.9, image: "photo-1455390582262-044cdead277a", alt: "Caderno e materiais de escrita" },
  { category: "Automotivo", name: "Acessório organizador automotivo", description: "Organizador prático para manter itens essenciais sempre à mão no carro.", price: 74.9, image: "photo-1492144534655-ae79c964c9d7", alt: "Automóvel em destaque" },
  { category: "Ferramentas e Construção", name: "Jogo de ferramentas manuais", description: "Conjunto básico para pequenos reparos e projetos domésticos.", price: 119.9, image: "photo-1581147036324-c1c9a9c5ed15", alt: "Ferramentas para reparos" },
  { category: "Jardim e Área Externa", name: "Kit de jardinagem para casa", description: "Acessórios essenciais para cuidar de plantas e cultivar um pequeno jardim.", price: 89.9, image: "photo-1416879595882-3373a0480b5b", alt: "Plantas em um jardim" },
  { category: "Indústria e Comércio", name: "Luminária industrial de bancada", description: "Iluminação funcional para oficinas, ateliês e espaços de trabalho.", price: 229.9, image: "photo-1581091226825-a6a2a5aee158", alt: "Ambiente de trabalho industrial" },
  { category: "Instrumentos Musicais", name: "Violão acústico para iniciantes", description: "Violão acústico para aprender, praticar e compartilhar música.", price: 599.9, image: "photo-1511379938547-c1f69419868d", alt: "Instrumentos e equipamentos musicais" },
  { category: "Relógios e Joias", name: "Relógio clássico de pulso", description: "Relógio de visual elegante para usar no trabalho e em ocasiões especiais.", price: 299.9, image: "photo-1523170335258-f5ed11844a49", alt: "Relógio de pulso" },
  { category: "Viagem e Lazer", name: "Mala compacta de viagem", description: "Mala prática para organizar roupas e acessórios em viagens curtas.", price: 349.9, image: "photo-1488646953014-85cb44e25828", alt: "Viajantes em um destino turístico" },
  { category: "Artesanato", name: "Peça decorativa feita à mão", description: "Peça artesanal para trazer personalidade e um toque autoral à decoração.", price: 89.9, image: "photo-1452860606245-08befc0ff44b", alt: "Materiais para trabalhos artesanais" },
];

const demoFreeProducts = [
  { category: "Cozinha e Utilidades", name: "Tábua de madeira para cozinha", description: "Tábua prática para o preparo e a apresentação de receitas.", price: 59.9, image: "photo-1556911220-e15b29be8c8f", alt: "Cozinha organizada" },
  { category: "Casa, Móveis e Decoração", name: "Vaso decorativo artesanal", description: "Vaso de linhas simples para dar destaque a plantas e flores.", price: 44.9, image: "photo-1600210492486-724fe5c67fb0", alt: "Decoração para casa" },
  { category: "Pet Shop", name: "Brinquedo para cães", description: "Brinquedo resistente para estimular a brincadeira do seu pet.", price: 29.9, image: "photo-1543466835-00a7907e9de1", alt: "Cachorro de estimação" },
];

function demoProductId(index: number) {
  return `80000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

async function seedDemoData() {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    throw new Error("Os dados de demonstração só podem ser criados em development ou test.");
  }

  const demoPassword = process.env.DEMO_SEED_PASSWORD;
  if (!demoPassword || demoPassword.length < 8) {
    throw new Error("Defina DEMO_SEED_PASSWORD com pelo menos 8 caracteres para criar os usuários de demonstração.");
  }

  const password = await bcrypt.hash(demoPassword, 12);
  const proUser = await prisma.user.upsert({
    where: { email: "demo-pro@vitrine.local" },
    update: { name: "Vendedor Pro Demo", password, role: "SELLER" },
    create: {
      name: "Vendedor Pro Demo",
      email: "demo-pro@vitrine.local",
      password,
      role: "SELLER",
      emailVerifiedAt: new Date(),
      sellerProfile: { create: { storeName: "Vitrine Pro Demo", approvalStatus: "APPROVED", plan: "PRO", subscriptionStatus: "AUTHORIZED" } },
    },
  });
  const proSeller = await prisma.sellerProfile.upsert({
    where: { userId: proUser.id },
    update: { storeName: "Vitrine Pro Demo", approvalStatus: "APPROVED", plan: "PRO", subscriptionStatus: "AUTHORIZED", planExpiresAt: null },
    create: { userId: proUser.id, storeName: "Vitrine Pro Demo", approvalStatus: "APPROVED", plan: "PRO", subscriptionStatus: "AUTHORIZED" },
  });

  const freeUser = await prisma.user.upsert({
    where: { email: "demo-free@vitrine.local" },
    update: { name: "Vendedor Grátis Demo", password, role: "SELLER" },
    create: {
      name: "Vendedor Grátis Demo",
      email: "demo-free@vitrine.local",
      password,
      role: "SELLER",
      emailVerifiedAt: new Date(),
      sellerProfile: { create: { storeName: "Ateliê Local Demo", approvalStatus: "APPROVED", city: "São Paulo", state: "SP" } },
    },
  });
  const freeSeller = await prisma.sellerProfile.upsert({
    where: { userId: freeUser.id },
    update: { storeName: "Ateliê Local Demo", approvalStatus: "APPROVED", plan: "FREE", subscriptionStatus: "NONE", planExpiresAt: null, city: "São Paulo", state: "SP", whatsappPhone: null },
    create: { userId: freeUser.id, storeName: "Ateliê Local Demo", approvalStatus: "APPROVED", plan: "FREE", city: "São Paulo", state: "SP" },
  });

  const customer = await prisma.user.upsert({
    where: { email: "demo-cliente@vitrine.local" },
    update: { name: "Cliente Demo", password, role: "CUSTOMER" },
    create: { name: "Cliente Demo", email: "demo-cliente@vitrine.local", password, role: "CUSTOMER", emailVerifiedAt: new Date() },
  });
  await prisma.address.upsert({
    where: { id: "83000000-0000-4000-8000-000000000001" },
    update: { recipient: "Cliente Demo", postalCode: "01001-000", street: "Praça da Sé", number: "100", district: "Sé", city: "São Paulo", state: "SP", isDefault: true, userId: customer.id },
    create: { id: "83000000-0000-4000-8000-000000000001", recipient: "Cliente Demo", postalCode: "01001-000", street: "Praça da Sé", number: "100", district: "Sé", city: "São Paulo", state: "SP", isDefault: true, userId: customer.id },
  });

  const now = Date.now();
  for (const [index, product] of demoProducts.entries()) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: slugify(product.category) } });
    const createdAt = new Date(index < 8 ? now - index * 1000 : now - (index + 30) * 86_400_000);
    await prisma.product.upsert({
      where: { id: demoProductId(index + 1) },
      update: {
        name: product.name, description: product.description, price: product.price, stock: 12,
        listingType: "STORE", status: "ACTIVE", sellerId: proSeller.id, categoryId: category.id, createdAt,
        images: { deleteMany: {}, create: [{ url: `https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=900&q=80`, alt: product.alt, position: 0 }] },
      },
      create: {
        id: demoProductId(index + 1), name: product.name, description: product.description, price: product.price,
        stock: 12, listingType: "STORE", status: "ACTIVE", sellerId: proSeller.id, categoryId: category.id, createdAt,
        images: { create: [{ url: `https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=900&q=80`, alt: product.alt, position: 0 }] },
      },
    });
  }

  for (const [index, product] of demoFreeProducts.entries()) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: slugify(product.category) } });
    const id = demoProductId(100 + index + 1);
    await prisma.product.upsert({
      where: { id },
      update: {
        name: product.name, description: product.description, price: product.price, stock: 4,
        listingType: "STORE", status: "ACTIVE", sellerId: freeSeller.id, categoryId: category.id,
        images: { deleteMany: {}, create: [{ url: `https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=900&q=80`, alt: product.alt, position: 0 }] },
      },
      create: {
        id, name: product.name, description: product.description, price: product.price, stock: 4,
        listingType: "STORE", status: "ACTIVE", sellerId: freeSeller.id, categoryId: category.id,
        images: { create: [{ url: `https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=900&q=80`, alt: product.alt, position: 0 }] },
      },
    });
  }

  const orderProductId = demoProductId(4);
  const orderImage = demoProducts[3]?.image;
  if (!orderImage) throw new Error("O produto de demonstração do pedido não foi configurado.");
  await prisma.order.upsert({
    where: { id: "82000000-0000-4000-8000-000000000001" },
    update: {
      subtotal: 249.9, shippingCost: 0, discount: 0, platformFee: 12.5, total: 249.9,
      shippingMethod: "Retirada demonstrativa", shippingAddress: { recipient: "Cliente Demo", city: "São Paulo", state: "SP" },
      status: "PAID", customerId: customer.id, sellerId: proSeller.id,
      items: { deleteMany: {}, create: [{ productId: orderProductId, quantity: 1, unitPrice: 249.9, productName: "Fone Bluetooth com estojo", imageUrl: `https://images.unsplash.com/${orderImage}?auto=format&fit=crop&w=900&q=80` }] },
      payment: { upsert: { create: { status: "APPROVED", provider: "DEMO" }, update: { status: "APPROVED", provider: "DEMO" } } },
    },
    create: {
      id: "82000000-0000-4000-8000-000000000001", subtotal: 249.9, shippingCost: 0, discount: 0,
      platformFee: 12.5, total: 249.9, shippingMethod: "Retirada demonstrativa",
      shippingAddress: { recipient: "Cliente Demo", city: "São Paulo", state: "SP" }, status: "PAID",
      customerId: customer.id, sellerId: proSeller.id,
      items: { create: [{ productId: orderProductId, quantity: 1, unitPrice: 249.9, productName: "Fone Bluetooth com estojo", imageUrl: `https://images.unsplash.com/${orderImage}?auto=format&fit=crop&w=900&q=80` }] },
      payment: { create: { status: "APPROVED", provider: "DEMO" } },
    },
  });

  await prisma.cart.upsert({
    where: { userId: customer.id },
    update: { items: { deleteMany: {}, create: [{ productId: demoProductId(1), quantity: 1, selected: true }] } },
    create: { userId: customer.id, items: { create: [{ productId: demoProductId(1), quantity: 1, selected: true }] } },
  });

  console.log(`Dados de demonstração sincronizados: ${demoProducts.length} produtos Pro, ${demoFreeProducts.length} produtos grátis e 3 contas.`);
  console.log("Contas: demo-pro@vitrine.local, demo-free@vitrine.local e demo-cliente@vitrine.local (senha definida em DEMO_SEED_PASSWORD).");
}

try {
  for (const name of categories) {
    const slug = slugify(name);
    await prisma.category.upsert({
      where: { slug },
      update: { name, active: true },
      create: { name, slug, active: true },
    });
  }

  console.log(`${categories.length} categorias globais sincronizadas.`);
  if (process.env.SEED_DEMO_DATA === "true") await seedDemoData();
} finally {
  await prisma.$disconnect();
}
