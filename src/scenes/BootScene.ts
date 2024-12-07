import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // 预加载内容
  }

  create() {
    console.log("BootScene loaded");
    this.scene.start("PreloadScene");
  }
  
}
