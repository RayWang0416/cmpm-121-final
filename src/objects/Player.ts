import Phaser from "phaser";

export default class Player extends Phaser.GameObjects.Rectangle {
  private speed: number = 500;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 50, 50, 0xffd700);
    scene.add.existing(this);

    if (scene.input.keyboard) {
        this.cursors = scene.input.keyboard.createCursorKeys();
      } else {
        console.error("Keyboard plugin is not initialized");
        this.cursors = {} as Phaser.Types.Input.Keyboard.CursorKeys;
      }
      
  }

  update(delta: number) {
    let velocityX = 0;
    let velocityY = 0;
  
    if (this.cursors.left.isDown) {
      velocityX = -1;
    } else if (this.cursors.right.isDown) {
      velocityX = 1;
    }
  
    if (this.cursors.up.isDown) {
      velocityY = -1;
    } else if (this.cursors.down.isDown) {
      velocityY = 1;
    }
  
    const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    if (magnitude > 0) {
      velocityX /= magnitude;
      velocityY /= magnitude;
    }
  
    const distance = (this.speed * delta) / 1000;
  
    const newX = this.x + velocityX * distance;
    const newY = this.y + velocityY * distance;
  
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;
  
    if (newX - halfWidth >= 0 && newX + halfWidth <= this.scene.scale.width) {
      this.x = newX;
    }
    if (newY - halfHeight >= 0 && newY + halfHeight <= this.scene.scale.height) {
      this.y = newY;
    }
  }
  
  
}
