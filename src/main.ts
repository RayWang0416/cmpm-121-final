import Phaser from "phaser";
import GameScene from "./scenes/GameScene";
import { GRID_SIZE, TILE_SIZE } from "./utils/Constants";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1500,
    height: 1500,
    backgroundColor: "#8B4513",
    parent: "game-container",
    scene: [GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
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
