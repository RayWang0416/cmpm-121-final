import Phaser from "phaser";

export interface TileData {
  rectangle: Phaser.GameObjects.Rectangle;
  sunlight: number;
  water: number;
  text: Phaser.GameObjects.Text;
  plant?: { type: "potato" | "carrot" | "cabbage"; level: 1 | 2 | 3 };
}

export class TileManager {
  private scene: Phaser.Scene;
  private grid: TileData[][] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Create the grid with tiles
  createGrid(gridSize: number, tileSize: number): TileData[][] {
    const offsetX = (this.scene.cameras.main.width - gridSize * tileSize) / 2;
    const offsetY = (this.scene.cameras.main.height - gridSize * tileSize) / 2;

    for (let row = 0; row < gridSize; row++) {
      const gridRow: TileData[] = [];
      for (let col = 0; col < gridSize; col++) {
        const x = offsetX + col * tileSize + tileSize / 2;
        const y = offsetY + row * tileSize + tileSize / 2;

        const rectangle = this.scene.add.rectangle(x, y, tileSize, tileSize, 0x228b22);
        rectangle.setStrokeStyle(1, 0x000000);

        const sunlight = Phaser.Math.Between(0, 100);
        const water = Phaser.Math.Between(0, 100);

        const textX = x - tileSize / 2 + 5;
        const textY = y - tileSize / 2 + 5;
        const text = this.scene.add.text(textX, textY, `☀️ ${sunlight}\n💧 ${water}`, {
          font: "14px Arial",
          color: "#ffffff",
          align: "left",
        });
        text.setOrigin(0, 0);

        gridRow.push({ rectangle, sunlight, water, text });
      }
      this.grid.push(gridRow);
    }
    return this.grid;
  }

  // Update sunlight, water, and display for all tiles
  updateGridProperties(gridSize: number, tileSize: number): void {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const tile = this.grid[row][col];

        tile.sunlight = Phaser.Math.Between(0, 100);
        tile.water = Math.min(tile.water + Phaser.Math.Between(0, 30), 100);

        if (tile.plant) {
          const plantType = tile.plant.type;
          const plantLevel = tile.plant.level;
          tile.text.setText(
            `☀️ ${tile.sunlight}\n💧 ${tile.water}\n🌱 ${plantType} L${plantLevel}`
          );
        } else {
          tile.text.setText(`☀️ ${tile.sunlight}\n💧 ${tile.water}`);
        }
      }
    }
  }

  getGrid(): TileData[][] {
    return this.grid;
  }
}
