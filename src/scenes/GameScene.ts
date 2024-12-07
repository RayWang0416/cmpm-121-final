import Phaser from "phaser";
import { GRID_SIZE, TILE_SIZE } from "../utils/Constants";

export default class GameScene extends Phaser.Scene {
  private grid: Phaser.GameObjects.Rectangle[][] = []; // 存储网格的二维数组

  constructor() {
    super("GameScene");
  }

  create() {
    console.log("GameScene create called"); // 调试日志
    this.createGrid();
  }

  private createGrid() {
    console.log("Creating grid..."); // 调试日志

    const offsetX = (this.cameras.main.width - GRID_SIZE * TILE_SIZE) / 2;
    const offsetY = (this.cameras.main.height - GRID_SIZE * TILE_SIZE) / 2;

    this.grid = [];
    for (let row = 0; row < GRID_SIZE; row++) {
        const gridRow: Phaser.GameObjects.Rectangle[] = [];
        for (let col = 0; col < GRID_SIZE; col++) {
            const x = offsetX + col * TILE_SIZE + TILE_SIZE / 2;
            const y = offsetY + row * TILE_SIZE + TILE_SIZE / 2;

            const tile = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0x228b22); // 绿色地块
            tile.setStrokeStyle(1, 0x000000); // 边框

            gridRow.push(tile);
        }
        this.grid.push(gridRow);
    }
    console.log("Grid created:", this.grid);
}

}
