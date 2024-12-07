import Phaser from "phaser";
import BootScene from "./scenes/BootScene";
import PreloadScene from "./scenes/PreloadScene";
import GameScene from "./scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: "#8B4513",
    parent: "game-container", // 挂载到 #game-container
    scene: [BootScene, PreloadScene, GameScene],
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
  };
  
  new Phaser.Game(config);
  
