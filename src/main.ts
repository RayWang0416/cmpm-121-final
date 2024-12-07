import Phaser from "phaser";
import BootScene from "./scenes/BootScene";
import PreloadScene from "./scenes/PreloadScene";
import GameScene from "./scenes/GameScene";
import { GRID_SIZE, TILE_SIZE } from "./utils/Constants";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GRID_SIZE * TILE_SIZE + 100, // 宽度应至少为网格宽度 + 边距
    height: GRID_SIZE * TILE_SIZE + 100, // 高度应至少为网格高度 + 边距
    backgroundColor: "#8B4513",
    parent: "game-container",
    scene: [BootScene, PreloadScene, GameScene],
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    input: {
        keyboard: true, // 启用键盘输入
    },
};
  

new Phaser.Game(config);
