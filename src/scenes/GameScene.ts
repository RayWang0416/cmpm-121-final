import Phaser from "phaser";
import { GRID_SIZE, TILE_SIZE } from "../utils/Constants";
import Player from "../objects/Player";

export default class GameScene extends Phaser.Scene {
  private player!: Player;

  constructor() {
    super("GameScene");
  }

  create() {
    this.createGrid();
    this.createPlayer();
  }

  private createGrid() {
    const offsetX = (this.cameras.main.width - GRID_SIZE * TILE_SIZE) / 2;
    const offsetY = (this.cameras.main.height - GRID_SIZE * TILE_SIZE) / 2;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = offsetX + col * TILE_SIZE + TILE_SIZE / 2;
        const y = offsetY + row * TILE_SIZE + TILE_SIZE / 2;

        const tile = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0x228b22);
        tile.setStrokeStyle(1, 0x000000);
      }
    }
  }

  private createPlayer() {
    const startX = this.cameras.main.width / 2; // 玩家从画布中央开始
    const startY = this.cameras.main.height / 2;
    this.player = new Player(this, startX, startY);
  }

  update(time: number, delta: number) {
    this.player.update(delta); // 持续更新玩家位置
  }
}
