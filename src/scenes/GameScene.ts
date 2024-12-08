import Phaser from "phaser";
import { GRID_SIZE, TILE_SIZE } from "../utils/Constants";
import Player from "../objects/Player";

interface TileData {
  rectangle: Phaser.GameObjects.Rectangle;
  sunlight: number;
  water: number;
  text: Phaser.GameObjects.Text;
  plant?: { type: "potato" | "carrot" | "cabbage"; level: 1 | 2 | 3 };
}

interface Inventory {
  potato: number;
  carrot: number;
  cabbage: number;
}

export default class GameScene extends Phaser.Scene {
  private player!: Player;
  private grid: TileData[][] = [];
  private activeTile: TileData | null = null;
  private dayCount: number = 1;
  private dayText!: Phaser.GameObjects.Text;
  private inventory: Inventory = { potato: 1, carrot: 1, cabbage: 1 };
  private inventoryText!: Phaser.GameObjects.Text;
  private achievements: string[] = [];
  private achievementsText!: Phaser.GameObjects.Text;

  constructor() {
    super("GameScene");
  }

  create() {
    this.createGrid();
    this.createPlayer();
    this.createNextDayButton();
    this.createDayCounter();
    this.createInventoryDisplay();
    this.createAchievementsDisplay();

    if (this.input && this.input.keyboard) {
      this.input.keyboard.on("keydown-P", () => this.plantOnCurrentTile("potato"));
      this.input.keyboard.on("keydown-C", () => this.plantOnCurrentTile("carrot"));
      this.input.keyboard.on("keydown-B", () => this.plantOnCurrentTile("cabbage"));
      this.input.keyboard.on("keydown-H", () => this.harvestFromCurrentTile());
    } else {
      console.error("Keyboard input plugin is not initialized.");
    }
  }

  private createAchievementsDisplay() {
    this.achievementsText = this.add.text(10, 200, "Achievements:\n", {
      font: "16px Arial",
      color: "#ffffff",
    });
  }

  private updateAchievements(type: "potato" | "carrot" | "cabbage") {
    const thresholds = [
      { count: 10, title: `${type} master` },
      { count: 15, title: `${type} god` },
      { count: 20, title: `${type} legend` },
    ];

    for (const threshold of thresholds) {
      if (
        this.inventory[type] >= threshold.count &&
        !this.achievements.includes(threshold.title)
      ) {
        this.achievements.push(threshold.title);
        this.showAchievement(threshold.title);
      }
    }

    this.updateAchievementsDisplay();
  }

  private showAchievement(title: string) {
    const achievementText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      `Achievement Unlocked!\n${title}`,
      {
        font: "20px Arial",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { left: 10, right: 10, top: 5, bottom: 5 },
      }
    );
    achievementText.setOrigin(0.5, 0.5);

    this.time.delayedCall(2000, () => {
      achievementText.destroy();
    });
  }

  private updateAchievementsDisplay() {
    this.achievementsText.setText(
      `Achievements:\n${this.achievements.join("\n")}`
    );
  }

  private createGrid() {
    const offsetX = (this.cameras.main.width - GRID_SIZE * TILE_SIZE) / 2;
    const offsetY = (this.cameras.main.height - GRID_SIZE * TILE_SIZE) / 2;

    for (let row = 0; row < GRID_SIZE; row++) {
      const gridRow: TileData[] = [];
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = offsetX + col * TILE_SIZE + TILE_SIZE / 2;
        const y = offsetY + row * TILE_SIZE + TILE_SIZE / 2;

        const rectangle = this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0x228b22);
        rectangle.setStrokeStyle(1, 0x000000);

        const sunlight = Phaser.Math.Between(0, 100);
        const water = Phaser.Math.Between(0, 100);

        const textX = x - TILE_SIZE / 2 + 5;
        const textY = y - TILE_SIZE / 2 + 5;
        const text = this.add.text(textX, textY, `☀️ ${sunlight}\n💧 ${water}`, {
          font: "14px Arial",
          color: "#ffffff",
          align: "left",
        });
        text.setOrigin(0, 0);

        gridRow.push({ rectangle, sunlight, water, text });
      }
      this.grid.push(gridRow);
    }
  }

  private createPlayer() {
    const startX = this.cameras.main.width / 2;
    const startY = this.cameras.main.height / 2;
    this.player = new Player(this, startX, startY);
  }

  private createNextDayButton() {
    const button = this.add.text(150, 50, "Next Day", {
      font: "20px Arial",
      backgroundColor: "#000000",
      color: "#ffffff",
      padding: { left: 10, right: 10, top: 5, bottom: 5 },
    });

    button.setInteractive();
    button.on("pointerdown", () => {
      this.dayCount++;
      this.dayText.setText(`Day: ${this.dayCount}`);
      this.updateGridProperties();
      this.growPlants();
    });
  }

  private createDayCounter() {
    this.dayText = this.add.text(10, 50, `Day: ${this.dayCount}`, {
      font: "20px Arial",
      color: "#ffffff",
    });
  }

  private createInventoryDisplay() {
    this.inventoryText = this.add.text(10, 100, this.getInventoryString(), {
      font: "16px Arial",
      color: "#ffffff",
    });
  }

  private getInventoryString(): string {
    return `Inventory:\n🥔 Potato: ${this.inventory.potato}\n🥕 Carrot: ${this.inventory.carrot}\n🥬 Cabbage: ${this.inventory.cabbage}`;
  }

  private updateInventoryDisplay() {
    this.inventoryText.setText(this.getInventoryString());
  }

  private updateGridProperties() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const tile = this.grid[row][col];
        tile.sunlight = Phaser.Math.Between(0, 100);
        tile.water = Math.min(tile.water + Phaser.Math.Between(0, 30), 100);
        tile.text.setText(`☀️ ${tile.sunlight}\n💧 ${tile.water}`);
      }
    }
  }

  private plantOnCurrentTile(type: "potato" | "carrot" | "cabbage") {
    if (!this.activeTile) return;

    const tile = this.activeTile;
    if (tile.plant) {
      console.error("This tile already has a plant!");
      return;
    }

    const conditions = {
      potato: tile.sunlight >= 0 && tile.water >= 20,
      carrot: tile.sunlight >= 0 && tile.water >= 20,
      cabbage: tile.sunlight >= 0 && tile.water >= 70,
    };

    if (!conditions[type]) {
      console.error("This tile does not meet the planting conditions!");
      return;
    }

    if (this.inventory[type] <= 0) {
      console.error(`No ${type} left in inventory!`);
      return;
    }

    const waterCost = { potato: 20, carrot: 20, cabbage: 70 };
    tile.water -= waterCost[type];
    this.inventory[type]--;
    this.updateInventoryDisplay();

    tile.plant = { type, level: 1 };
    tile.text.setText(`☀️ ${tile.sunlight}\n💧 ${tile.water}\n🌱 ${type} L1`);
  }

  private growPlants() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const tile = this.grid[row][col];
  
        // 如果格子中没有植物，跳过处理
        if (!tile.plant) continue;
  
        // 检查植物是否可以升级
        const growConditions: Record<
          "potato" | "carrot" | "cabbage",
          Record<number, { sunlight: number; water: number }>
        > = {
          potato: { 2: { sunlight: 20, water: 20 }, 3: { sunlight: 20, water: 20 } },
          carrot: { 2: { sunlight: 60, water: 40 }, 3: { sunlight: 45, water: 20 } },
          cabbage: { 2: { sunlight: 55, water: 30 }, 3: { sunlight: 65, water: 20 } },
        };
  
        const nextLevel = (tile.plant.level + 1) as 1 | 2 | 3;
        const conditions = growConditions[tile.plant.type]?.[nextLevel];
  
        // 如果植物可以升级，则进行升级
        if (conditions && tile.sunlight >= conditions.sunlight && tile.water >= conditions.water) {
          tile.water -= conditions.water;
          tile.plant.level = nextLevel;
        }
  
        // 更新显示，无论植物是否升级，都需要显示植物信息
        const plantType = tile.plant.type;
        const plantLevel = tile.plant.level;
        tile.text.setText(
          `☀️ ${tile.sunlight}\n💧 ${tile.water}\n🌱 ${plantType} L${plantLevel}`
        );
      }
    }
  }
  
  private harvestFromCurrentTile() {
    if (!this.activeTile || !this.activeTile.plant) {
      console.error("No plant to harvest!");
      return;
    }

    const tile = this.activeTile;
    const plant = tile.plant!;
    const harvestAmount = { 1: 1, 2: 2, 3: 4 }[plant.level];

    this.inventory[plant.type] += harvestAmount;
    tile.plant = undefined;
    tile.text.setText(tile.text.text.replace(/\n🌱.*$/, ""));
    this.updateInventoryDisplay();

    this.updateAchievements(plant.type);
  }

  update(time: number, delta: number) {
    this.player.update(delta);

    const offsetX = (this.cameras.main.width - GRID_SIZE * TILE_SIZE) / 2;
    const offsetY = (this.cameras.main.height - GRID_SIZE * TILE_SIZE) / 2;

    const gridX = Math.floor((this.player.x - offsetX) / TILE_SIZE);
    const gridY = Math.floor((this.player.y - offsetY) / TILE_SIZE);

    if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
      this.highlightTile(gridY, gridX);
    }
  }

  private highlightTile(row: number, col: number) {
    if (this.activeTile) {
      this.activeTile.rectangle.setFillStyle(0x228b22);
    }

    this.activeTile = this.grid[row][col];
    this.activeTile.rectangle.setFillStyle(0x32cd32);
  }
}
