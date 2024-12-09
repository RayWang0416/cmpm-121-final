import Phaser from "phaser";
import { GRID_SIZE, TILE_SIZE } from "../utils/Constants";
import Player from "../objects/Player";
import { TileManager, TileData } from "../objects/Tile";
import AchievementsManager from "../utils/Achievements";

// Interface to represent the player's inventory
interface Inventory {
  potato: number;
  carrot: number;
  cabbage: number;
}

export default class GameScene extends Phaser.Scene {
  private player!: Player; // The player object
  private tileManager!: TileManager; // Tile manager for grid handling
  private achievementsManager!: AchievementsManager; // Achievements manager
  private grid: TileData[][] = []; // 2D array representing the grid of tiles
  private activeTile: TileData | null = null; // The tile the player is currently interacting with
  private dayCount: number = 1; // Counter for the current day
  private dayText!: Phaser.GameObjects.Text; // Text to display the current day
  private inventory: Inventory = { potato: 1, carrot: 1, cabbage: 1 }; // Initial inventory
  private inventoryText!: Phaser.GameObjects.Text; // Text to display the inventory
  private controlsText!: Phaser.GameObjects.Text; // Text to display control instructions
  private actionsRemaining: number = 10; // Limit of actions per day
  private actionsText!: Phaser.GameObjects.Text; // Text to display remaining actions

  constructor() {
    super("GameScene");
  }

  create() {
    // Initialize managers
    this.tileManager = new TileManager(this);
    this.achievementsManager = new AchievementsManager(this);

    // Set up the game environment
    this.grid = this.tileManager.createGrid(GRID_SIZE, TILE_SIZE);
    this.createPlayer();
    this.createNextDayButton();
    this.createDayCounter();
    this.createInventoryDisplay();
    this.createActionsCounter();
    this.createControlsDisplay();

    // Register keyboard events for player actions
    if (this.input && this.input.keyboard) {
        this.input.keyboard.on("keydown-P", () => this.performAction(() => this.plantOnCurrentTile("potato")));
        this.input.keyboard.on("keydown-C", () => this.performAction(() => this.plantOnCurrentTile("carrot")));
        this.input.keyboard.on("keydown-B", () => this.performAction(() => this.plantOnCurrentTile("cabbage")));
        this.input.keyboard.on("keydown-H", () => this.performAction(() => this.harvestFromCurrentTile()));
      } else {
        console.error("Keyboard input plugin is not initialized.");
      }
  }

  private createActionsCounter() {
    this.actionsText = this.add.text(10, 200, `Actions Remaining: ${this.actionsRemaining}`, {
      font: "16px Arial",
      color: "#ffffff",
    });
  }

  private updateActionsCounter() {
    this.actionsText.setText(`Actions Remaining: ${this.actionsRemaining}`);
  }

  private performAction(action: () => void) {
    if (this.actionsRemaining > 0) {
      action();
      this.actionsRemaining--;
      this.updateActionsCounter();

      if (this.actionsRemaining === 0) {
        console.log("No more actions left for today!");
      }
    } else {
      console.error("You have no actions remaining for today!");
    }
  }

  // Display control instructions on the right side of the screen
  private createControlsDisplay() {
    const text = `
Controls:
P - Plant Potato
C - Plant Carrot
B - Plant Cabbage
H - Harvest Plant
Arrow Keys - Move Player
`;
    this.controlsText = this.add.text(
      this.cameras.main.width - 140,
      50,
      text,
      {
        font: "16px Arial",
        color: "#ffffff",
        align: "left",
      }
    );
    this.controlsText.setOrigin(0, 0);
  }

  // Create the player and place them at the center of the grid
  private createPlayer() {
    const startX = this.cameras.main.width / 2;
    const startY = this.cameras.main.height / 2;
    this.player = new Player(this, startX, startY);
  }

  // Create a button to advance to the next day
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
      this.actionsRemaining = 10;
      this.updateActionsCounter();
      this.tileManager.updateGridProperties(GRID_SIZE, TILE_SIZE);
      this.growPlants();
    });
  }

  // Display the current day
  private createDayCounter() {
    this.dayText = this.add.text(10, 50, `Day: ${this.dayCount}`, {
      font: "20px Arial",
      color: "#ffffff",
    });
  }

  // Display the player's inventory
  private createInventoryDisplay() {
    this.inventoryText = this.add.text(10, 100, this.getInventoryString(), {
      font: "16px Arial",
      color: "#ffffff",
    });
  }

  // Generate the inventory display string
  private getInventoryString(): string {
    return `Inventory:\n🥔 Potato: ${this.inventory.potato}\n🥕 Carrot: ${this.inventory.carrot}\n🥬 Cabbage: ${this.inventory.cabbage}`;
  }

  // Update the inventory display
  private updateInventoryDisplay() {
    this.inventoryText.setText(this.getInventoryString());
  }

  // Plant a specified type of plant on the active tile
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

  // Grow plants based on conditions and update their levels
  private growPlants() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const tile = this.grid[row][col];

        if (!tile.plant) continue;

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

        if (conditions && tile.sunlight >= conditions.sunlight && tile.water >= conditions.water) {
          tile.water -= conditions.water;
          tile.plant.level = nextLevel;
        }

        const plantType = tile.plant.type;
        const plantLevel = tile.plant.level;
        tile.text.setText(
          `☀️ ${tile.sunlight}\n💧 ${tile.water}\n🌱 ${plantType} L${plantLevel}`
        );
      }
    }
  }

  // Harvest a plant from the active tile
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

    this.achievementsManager.checkAndUpdate(plant.type, this.inventory[plant.type]);
  }

  // Update loop
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

  // Highlight the tile the player is currently standing on
  private highlightTile(row: number, col: number) {
    if (this.activeTile) {
      this.activeTile.rectangle.setFillStyle(0x228b22);
    }

    this.activeTile = this.grid[row][col];
    this.activeTile.rectangle.setFillStyle(0x32cd32);
  }
}
