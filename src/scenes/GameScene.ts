import Phaser from "phaser";
import { GRID_SIZE, TILE_SIZE } from "../utils/Constants";
import Player from "../objects/Player";

enum PlantType {
  None = 0,
  Potato = 1,
  Carrot = 2,
  Cabbage = 3
}

type PlantLevel = 1 | 2 | 3;

interface GrowthCondition {
  sunlight: number;
  water: number;
}

type GrowthMap = Partial<Record<PlantLevel, GrowthCondition>>;

const growConditions: Record<PlantType, GrowthMap> = {
  [PlantType.Potato]: {2: {sunlight:20, water:20}, 3:{sunlight:20, water:20}},
  [PlantType.Carrot]: {2: {sunlight:60, water:40}, 3:{sunlight:45, water:20}},
  [PlantType.Cabbage]:{2: {sunlight:55, water:30}, 3:{sunlight:65, water:20}},
  [PlantType.None]: {}
};

interface TileData {
  rectangle: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

interface Inventory {
  potato: number;
  carrot: number;
  cabbage: number;
}

interface GameState {
  dayCount: number;
  inventory: Inventory;
  achievements: string[];
  gridData: Uint8Array;
  playerX: number;
  playerY: number;
  actionsRemaining: number;
}

interface FullSaveData {
  currentState: Omit<GameState,"gridData"> & {gridData:number[]};
  undoStack: (Omit<GameState,"gridData"> & {gridData:number[]})[];
  redoStack: (Omit<GameState,"gridData"> & {gridData:number[]})[];
}

export default class GameScene extends Phaser.Scene {
  private player!: Player;
  private grid: TileData[][] = [];
  private activeTile: TileData | null = null; 

  // Current state
  private dayCount: number = 1;
  private inventory: Inventory = { potato: 1, carrot: 1, cabbage: 1 }; 
  private achievements: string[] = [];
  private actionsRemaining: number = 10;
  private gridData!: Uint8Array;

  // UI elements
  private dayText!: Phaser.GameObjects.Text;
  private inventoryText!: Phaser.GameObjects.Text;
  private achievementsText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;
  private actionsText!: Phaser.GameObjects.Text;

  // Undo/Redo stacks
  private undoStack: GameState[] = [];
  private redoStack: GameState[] = [];

  // Offsets for gridData
  private readonly FIELDS_PER_CELL = 4;
  private readonly SUNLIGHT_OFFSET = 0;
  private readonly WATER_OFFSET = 1;
  private readonly PLANT_TYPE_OFFSET = 2;
  private readonly PLANT_LEVEL_OFFSET = 3;

  constructor() {
    super("GameScene");
  }

  create() {
    this.gridData = new Uint8Array(GRID_SIZE * GRID_SIZE * this.FIELDS_PER_CELL);

    // 初始化场景 (F1.c的方式)：
    this.initNewGame();

    // 尝试从自动存档加载 (F1.c)
    const autoSaveData = localStorage.getItem("autoSave");
    if (autoSaveData) {
      const loadFromAutoSave = window.confirm("An autosave was found. Do you want to continue where you left off?");
      if (loadFromAutoSave) {
        this.loadGameFromJSON(autoSaveData);
      }
    }

    // 注册键盘事件
    if (this.input && this.input.keyboard) {
      this.input.keyboard.on("keydown-P", () => this.performAction(() => this.plantOnCurrentTile("potato")));
      this.input.keyboard.on("keydown-C", () => this.performAction(() => this.plantOnCurrentTile("carrot")));
      this.input.keyboard.on("keydown-B", () => this.performAction(() => this.plantOnCurrentTile("cabbage")));
      this.input.keyboard.on("keydown-H", () => this.performAction(() => this.harvestFromCurrentTile()));

      // 手动保存
      this.input.keyboard.on("keydown-S", () => {
        const slotStr = window.prompt("Enter save slot number (e.g. 1, 2, 3):");
        if (slotStr) {
          const slot = parseInt(slotStr, 10);
          if (!isNaN(slot)) {
            this.saveGame(slot);
          }
        }
      });

      // 手动加载
      this.input.keyboard.on("keydown-L", () => {
        const slotStr = window.prompt("Enter load slot number (e.g. 1, 2, 3):");
        if (slotStr) {
          const slot = parseInt(slotStr, 10);
          if (!isNaN(slot)) {
            this.loadGame(slot);
          }
        }
      });

      // [F1.d] 撤销和重做
      this.input.keyboard.on("keydown-U", () => this.undo());
      this.input.keyboard.on("keydown-R", () => this.redo());
    } else {
      console.error("Keyboard input plugin is not initialized.");
    }
  }

  private initNewGame() {
    this.undoStack = [];
    this.redoStack = [];

    this.createGrid();
    this.createPlayer();
    this.createNextDayButton();
    this.createDayCounter();
    this.createInventoryDisplay();
    this.createAchievementsDisplay();
    this.createControlsDisplay();
    this.createActionsCounter();
    this.updateActionsCounter();
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
    // 在执行行动前将当前状态压入undoStack
    this.pushCurrentStateToUndo();
    // 执行行动
    action();
    // 清空redoStack
    this.redoStack = [];
    // 自动存档 (F1.c)
    this.autoSaveGame();
  }

  // 将当前状态复制并压入undoStack
  private pushCurrentStateToUndo() {
    this.undoStack.push(this.copyCurrentState());
  }

  private copyCurrentState(): GameState {
    return {
      dayCount: this.dayCount,
      inventory: { ...this.inventory },
      achievements: [...this.achievements],
      gridData: new Uint8Array(this.gridData),
      playerX: this.player ? this.player.x : this.cameras.main.width / 2,
      playerY: this.player ? this.player.y : this.cameras.main.height / 2,
      actionsRemaining: this.actionsRemaining,
    };
  }

  private loadFromGameState(state: GameState) {
    this.dayCount = state.dayCount;
    this.inventory = { ...state.inventory };
    this.achievements = [...state.achievements];
    this.gridData = new Uint8Array(state.gridData);
    this.player.setPosition(state.playerX, state.playerY);
    this.actionsRemaining = state.actionsRemaining;

    // 更新UI显示
    this.dayText.setText(`Day: ${this.dayCount}`);
    this.updateInventoryDisplay();
    this.updateAchievementsDisplay();
    this.updateAllTilesDisplay();
    this.updateActionsCounter();
  }

  private undo() {
    if (this.undoStack.length > 0) {
      // 当前状态压入redoStack
      this.redoStack.push(this.copyCurrentState());
      // 从undoStack弹出状态并恢复
      const prevState = this.undoStack.pop()!;
      this.loadFromGameState(prevState);
      this.autoSaveGame();
    } else {
      console.log("No more undo available!");
    }
  }

  private redo() {
    if (this.redoStack.length > 0) {
      // 当前状态压入undoStack
      this.undoStack.push(this.copyCurrentState());
      // 从redoStack弹出状态并恢复
      const nextState = this.redoStack.pop()!;
      this.loadFromGameState(nextState);
      this.autoSaveGame();
    } else {
      console.log("No more redo available!");
    }
  }

  private createControlsDisplay() {
    const text = `
Controls:
P - Plant Potato
C - Plant Carrot
B - Plant Cabbage
H - Harvest Plant
Arrow Keys - Move Player
S - Save Game
L - Load Game
U - Undo
R - Redo
`;
    this.controlsText = this.add.text(
      this.cameras.main.width - 160,
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

  private createAchievementsDisplay() {
    this.achievementsText = this.add.text(10, 250, "Achievements:\n", {
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
      if (this.inventory[type] >= threshold.count && !this.achievements.includes(threshold.title)) {
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

    // 2秒后移除
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

        this.setSunlight(row, col, sunlight);
        this.setWater(row, col, water);
        this.setPlantType(row, col, PlantType.None);
        this.setPlantLevel(row, col, 0);

        const textX = x - TILE_SIZE / 2 + 5;
        const textY = y - TILE_SIZE / 2 + 5;
        const text = this.add.text(textX, textY, this.getTileInfoString(row, col), {
          font: "14px Arial",
          color: "#ffffff",
          align: "left",
        });
        text.setOrigin(0, 0);

        gridRow.push({ rectangle, text });
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
      this.performAction(() => {
        this.dayCount++;
        this.actionsRemaining = 10;
        this.updateActionsCounter();
        this.dayText.setText(`Day: ${this.dayCount}`);
        this.growPlants();
        this.updateGridProperties();
      });
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
        const newSunlight = Phaser.Math.Between(0, 100);
        const newWater = Math.min(this.getWater(row, col) + Phaser.Math.Between(0, 30), 100);

        this.setSunlight(row, col, newSunlight);
        this.setWater(row, col, newWater);
      }
    }
    this.updateAllTilesDisplay();
  }

  private getTileInfoString(row: number, col: number): string {
    const sunlight = this.getSunlight(row, col);
    const water = this.getWater(row, col);
    const plantType = this.getPlantType(row, col);
    const plantLevel = this.getPlantLevel(row, col);

    let str = `☀️ ${sunlight}\n💧 ${water}`;
    if (plantType !== PlantType.None) {
      const typeStr = (plantType === PlantType.Potato) ? "potato" :
                      (plantType === PlantType.Carrot) ? "carrot" : "cabbage";
      str += `\n🌱 ${typeStr} L${plantLevel}`;
    }
    return str;
  }

  private updateAllTilesDisplay() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        this.grid[row][col].text.setText(this.getTileInfoString(row, col));
      }
    }
  }

  private plantOnCurrentTile(type: "potato" | "carrot" | "cabbage") {
    if (!this.activeTile) return;

    const { row, col } = this.getActiveTilePosition();
    const water = this.getWater(row, col);

    if (this.getPlantType(row, col) !== PlantType.None) {
      console.error("This tile already has a plant!");
      return;
    }

    const conditions: Record<"potato"|"carrot"|"cabbage", boolean> = {
      potato: water >= 20,
      carrot: water >= 20,
      cabbage: water >= 70,
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
    this.setWater(row, col, water - waterCost[type]);
    this.inventory[type]--;
    this.updateInventoryDisplay();

    const plantEnum = (type === "potato") ? PlantType.Potato : 
                      (type === "carrot") ? PlantType.Carrot : PlantType.Cabbage;

    this.setPlantType(row, col, plantEnum);
    this.setPlantLevel(row, col, 1);
    this.updateAllTilesDisplay();
  }

  private growPlants() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const plantType = this.getPlantType(row, col);
        if (plantType === PlantType.None) continue;

        const currentLevel = this.getPlantLevel(row, col);
        if (currentLevel < 1 || currentLevel > 3) continue;

        const nextLevel = (currentLevel + 1) as PlantLevel;
        const cond = growConditions[plantType][nextLevel];
        if (!cond) continue;

        const sunlight = this.getSunlight(row, col);
        const water = this.getWater(row, col);

        if (sunlight >= cond.sunlight && water >= cond.water) {
          this.setWater(row, col, water - cond.water);
          this.setPlantLevel(row, col, nextLevel);
        }
      }
    }
    this.updateAllTilesDisplay();
  }

  private harvestFromCurrentTile() {
    if (!this.activeTile) {
      console.error("No active tile!");
      return;
    }

    const { row, col } = this.getActiveTilePosition();
    const plantType = this.getPlantType(row, col);
    const level = this.getPlantLevel(row, col);
    if (plantType === PlantType.None) {
      console.error("No plant to harvest!");
      return;
    }

    if (level < 1 || level > 3) {
      console.error("Invalid plant level.");
      return;
    }

    const plantLevel = level as PlantLevel;
    const harvestMap: Record<PlantLevel, number> = {1:1,2:2,3:4};
    const harvestAmount = harvestMap[plantLevel];

    let typeKey: "potato"|"carrot"|"cabbage" = "potato";
    if (plantType === PlantType.Carrot) typeKey = "carrot";
    if (plantType === PlantType.Cabbage) typeKey = "cabbage";

    this.inventory[typeKey] += harvestAmount;
    this.setPlantType(row, col, PlantType.None);
    this.setPlantLevel(row, col, 0);
    this.updateInventoryDisplay();
    this.updateAchievements(typeKey);
    this.updateAllTilesDisplay();
  }

  private getActiveTilePosition(): {row:number, col:number} {
    const offsetX = (this.cameras.main.width - GRID_SIZE * TILE_SIZE) / 2;
    const offsetY = (this.cameras.main.height - GRID_SIZE * TILE_SIZE) / 2;
    const gridX = Math.floor((this.player.x - offsetX) / TILE_SIZE);
    const gridY = Math.floor((this.player.y - offsetY) / TILE_SIZE);
    return { row: gridY, col: gridX };
  }

  private highlightTile(row: number, col: number) {
    if (this.activeTile) {
      this.activeTile.rectangle.setFillStyle(0x228b22);
    }

    this.activeTile = this.grid[row][col];
    this.activeTile.rectangle.setFillStyle(0x32cd32);
  }

  update(time: number, delta: number) {
    if (this.player) {
      this.player.update(delta);
      const offsetX = (this.cameras.main.width - GRID_SIZE * TILE_SIZE) / 2;
      const offsetY = (this.cameras.main.height - GRID_SIZE * TILE_SIZE) / 2;

      const gridX = Math.floor((this.player.x - offsetX) / TILE_SIZE);
      const gridY = Math.floor((this.player.y - offsetY) / TILE_SIZE);

      if (gridX >= 0 && gridX < GRID_SIZE && gridY >= 0 && gridY < GRID_SIZE) {
        this.highlightTile(gridY, gridX);
      }
    }
  }

  private getCellIndex(row: number, col: number): number {
    return (row * GRID_SIZE + col) * this.FIELDS_PER_CELL;
  }

  private getSunlight(row: number, col: number): number {
    return this.gridData[this.getCellIndex(row, col) + this.SUNLIGHT_OFFSET];
  }

  private setSunlight(row: number, col: number, value: number) {
    this.gridData[this.getCellIndex(row, col) + this.SUNLIGHT_OFFSET] = value;
  }

  private getWater(row: number, col: number): number {
    return this.gridData[this.getCellIndex(row, col) + this.WATER_OFFSET];
  }

  private setWater(row: number, col: number, value: number) {
    this.gridData[this.getCellIndex(row, col) + this.WATER_OFFSET] = value;
  }

  private getPlantType(row: number, col: number): PlantType {
    return this.gridData[this.getCellIndex(row, col) + this.PLANT_TYPE_OFFSET] as PlantType;
  }

  private setPlantType(row: number, col: number, type: PlantType) {
    this.gridData[this.getCellIndex(row, col) + this.PLANT_TYPE_OFFSET] = type;
  }

  private getPlantLevel(row: number, col: number): number {
    return this.gridData[this.getCellIndex(row, col) + this.PLANT_LEVEL_OFFSET];
  }

  private setPlantLevel(row: number, col: number, level: number) {
    this.gridData[this.getCellIndex(row, col) + this.PLANT_LEVEL_OFFSET] = level;
  }

  private saveGame(slot: number) {
    const fullData: FullSaveData = {
      currentState: this.gameStateToSaveFormat(this.copyCurrentState()),
      undoStack: this.undoStack.map(s => this.gameStateToSaveFormat(s)),
      redoStack: this.redoStack.map(s => this.gameStateToSaveFormat(s))
    };
    localStorage.setItem(`saveSlot${slot}`, JSON.stringify(fullData));
    console.log(`Game saved to slot ${slot}`);
  }

  private loadGame(slot: number) {
    const dataStr = localStorage.getItem(`saveSlot${slot}`);
    if (!dataStr) {
      console.error(`No save found in slot ${slot}`);
      return;
    }

    this.loadGameFromJSON(dataStr);
    console.log(`Game loaded from slot ${slot}`);
  }

  private loadGameFromJSON(dataStr: string) {
    const saved = JSON.parse(dataStr) as FullSaveData;

    const currentState = this.saveFormatToGameState(saved.currentState);
    this.loadFromGameState(currentState);

    this.undoStack = saved.undoStack.map(s => this.saveFormatToGameState(s));
    this.redoStack = saved.redoStack.map(s => this.saveFormatToGameState(s));

    console.log("Game loaded from JSON with undo/redo stacks restored.");
  }

  private autoSaveGame() {
    const fullData: FullSaveData = {
      currentState: this.gameStateToSaveFormat(this.copyCurrentState()),
      undoStack: this.undoStack.map(s => this.gameStateToSaveFormat(s)),
      redoStack: this.redoStack.map(s => this.gameStateToSaveFormat(s))
    };
    localStorage.setItem("autoSave", JSON.stringify(fullData));
  }

  private gameStateToSaveFormat(state: GameState): Omit<GameState,"gridData"> & {gridData:number[]} {
    return {
      dayCount: state.dayCount,
      inventory: { ...state.inventory },
      achievements: [...state.achievements],
      gridData: Array.from(state.gridData),
      playerX: state.playerX,
      playerY: state.playerY,
      actionsRemaining: state.actionsRemaining
    };
  }

  private saveFormatToGameState(obj: Omit<GameState,"gridData"> & {gridData:number[]}): GameState {
    return {
      dayCount: obj.dayCount,
      inventory: { ...obj.inventory },
      achievements: [...obj.achievements],
      gridData: new Uint8Array(obj.gridData),
      playerX: obj.playerX,
      playerY: obj.playerY,
      actionsRemaining: obj.actionsRemaining
    };
  }
}
