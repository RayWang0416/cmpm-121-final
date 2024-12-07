import Phaser from "phaser";

export default class Player extends Phaser.GameObjects.Rectangle {
  private speed: number = 500; // 玩家移动速度（像素/秒）
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys; // 键盘输入

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 50, 50, 0xffd700); // 黄色玩家角色
    scene.add.existing(this);

    // 获取方向键输入
    if (scene.input.keyboard) {
        this.cursors = scene.input.keyboard.createCursorKeys();
      } else {
        console.error("Keyboard plugin is not initialized");
        this.cursors = {} as Phaser.Types.Input.Keyboard.CursorKeys; // 提供一个空对象以避免后续报错
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
  
    // 计算新的位置
    const newX = this.x + velocityX * distance;
    const newY = this.y + velocityY * distance;
  
    // 边界检查
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
