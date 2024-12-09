import Phaser from "phaser";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    console.log("PreloadScene: Preloading...");
  }

  create() {
    console.log("PreloadScene: Loaded");
    this.scene.start("GameScene");
  }
}
