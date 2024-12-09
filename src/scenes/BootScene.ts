import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    console.log("BootScene: Preloading...");
  }

  create() {
    console.log("BootScene: Loaded");
    this.scene.start("PreloadScene");
  }
}
