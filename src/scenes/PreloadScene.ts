import Phaser from "phaser";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    // 预加载内容
  }

  create() {
    console.log("PreloadScene loaded");
    this.scene.start("GameScene");
  }  
}
