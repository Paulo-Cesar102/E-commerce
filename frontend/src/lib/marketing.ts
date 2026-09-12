type StoryInput = {
  title: string;
  price: string;
  imageUrl: string;
  storeName?: string;
  productId: string;
};

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem do produto."));
    image.src = source;
  });
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function createProductShareLink(productId: string, refId?: string | null) {
  const url = new URL(`/produto/${productId}`, window.location.origin);
  url.searchParams.set("utm_source", "instagram");
  url.searchParams.set("utm_medium", "story_share");
  url.searchParams.set("utm_campaign", "divulgacao_automatica");
  if (refId) url.searchParams.set("ref", refId);
  return url.toString();
}

export async function downloadProductStory(input: StoryInput) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Seu navegador não conseguiu criar a arte.");

  const productImage = await loadImage(input.imageUrl);
  const background = context.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, "#20211f");
  background.addColorStop(0.58, "#3a3b36");
  background.addColorStop(1, "#171817");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#e8553d";
  context.font = "800 34px sans-serif";
  context.textAlign = "left";
  context.fillText("VITRINE", 92, 112);
  context.fillStyle = "#ffffff";
  context.font = "700 34px sans-serif";
  context.textAlign = "left";
  context.fillText((input.storeName ?? "Sua loja").slice(0, 25), 92, 170);

  context.fillStyle = "#e8553d";
  roundedRect(context, 92, 220, 300, 62, 31);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "700 25px sans-serif";
  context.textAlign = "center";
  context.fillText("DESTAQUE DA LOJA", 242, 260);

  const imageX = 92;
  const imageY = 320;
  const imageSize = 896;
  context.save();
  context.shadowColor = "rgba(0, 0, 0, .28)";
  context.shadowBlur = 38;
  context.shadowOffsetY = 18;
  context.fillStyle = "#f7f5ef";
  roundedRect(context, imageX, imageY, imageSize, imageSize, 36);
  context.fill();
  context.restore();
  context.save();
  roundedRect(context, imageX, imageY, imageSize, imageSize, 36);
  context.clip();
  drawCover(context, productImage, imageX, imageY, imageSize, imageSize);
  context.restore();

  context.fillStyle = "#ffffff";
  context.textAlign = "left";
  context.font = "700 50px sans-serif";
  const title = input.title.length > 32 ? `${input.title.slice(0, 29)}...` : input.title;
  context.fillText(title, 92, 1305);
  context.fillStyle = "#e8553d";
  context.font = "800 82px sans-serif";
  context.fillText(input.price, 92, 1410);

  context.fillStyle = "#ffffff";
  roundedRect(context, 92, 1490, 896, 112, 56);
  context.fill();
  context.fillStyle = "#20211f";
  context.textAlign = "center";
  context.font = "700 37px sans-serif";
  context.fillText("Disponível no link da bio", 540, 1560);
  context.fillStyle = "#b8c6be";
  context.font = "500 26px sans-serif";
  context.fillText("Confira detalhes, estoque e entrega na Vitrine", 540, 1740);

  const anchor = document.createElement("a");
  anchor.download = `story-${input.productId}.png`;
  anchor.href = canvas.toDataURL("image/png", 1);
  anchor.click();
}