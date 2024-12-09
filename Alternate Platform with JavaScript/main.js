import Phaser from "phaser";
import GameScene from './GameScene.js';
import { GRID_SIZE, TILE_SIZE } from "./utils/Constants";

const config = {
    type: Phaser.AUTO,
    width: 1500,
    height: 1500,
    backgroundColor: "#8B4513",
    parent: "game-container",
    scene: [GameScene],
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    input: {
        keyboard: true, // Enable keyboard input
    },
};

new Phaser.Game(config);
