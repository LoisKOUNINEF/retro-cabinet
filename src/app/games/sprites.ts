// Pixel art shared by the canvas games: one string per row, '#' is a lit pixel.
export type Sprite = string[];

export const spriteWidth = (sprite: Sprite) => sprite[0]?.length ?? 0;
export const spriteHeight = (sprite: Sprite) => sprite.length;

// One fillRect per lit pixel.
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number, colour: string): void {
  ctx.fillStyle = colour;
  sprite.forEach((row, dy) => [...row].forEach((pixel, dx) => {
    if (pixel === '#') ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
  }));
}
