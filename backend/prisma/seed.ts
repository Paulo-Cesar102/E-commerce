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

for (const name of categories) {
  const slug = slugify(name);
  await prisma.category.upsert({
    where: { slug },
    update: { name, active: true },
    create: { name, slug, active: true },
  });
}

console.log(`${categories.length} categorias globais sincronizadas.`);
await prisma.$disconnect();
