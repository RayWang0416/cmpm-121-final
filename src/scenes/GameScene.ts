import Phaser from "phaser"; 
import { GRID_SIZE, TILE_SIZE } from "../utils/Constants";
import Player from "../objects/Player";
import * as yaml from 'js-yaml';  
import LocalizationManager from "./localizationManager";

enum PlantType {
  None = 0,
  Potato = 1,
  Carrot = 2,
  Cabbage = 3
}

type PlantLevel = 1 | 2 | 3;

interface NeighborCondition {
  requiredNeighbors: Partial<Record<PlantType, number>>;
}

interface GrowthCondition {
  sunlight: number;
  water: number;
  neighbors?: NeighborCondition;
}

// 使用Partial允许阶段配置为空
type GrowthMap = Partial<Record<PlantLevel, GrowthCondition>>;

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

interface SceneConfig {
  initial?: {
    dayCount?: number;
    inventory?: {
      potato?: number;
      carrot?: number;
      cabbage?: number;
    };
    actionsRemaining?: number;
    achievements?: string[];
  };
  gridOverrides?: {
    row: number;
    col: number;
    sunlight?: number;
    water?: number;
    plantType?: "potato" | "carrot" | "cabbage";
    plantLevel?: number;
  }[];
}

interface PlantLevelConfig {
  level: number;
  sunlight: number;
  water: number;
  neighbors?: {
    requiredNeighbors: {
      potato?: number;
      carrot?: number;
      cabbage?: number;
    };
  };
}

interface PlantsYAML {
  plants: {
    potato?: PlantLevelConfig[];
    carrot?: PlantLevelConfig[];
    cabbage?: PlantLevelConfig[];
  }
}

class PlantBuilder {
  private conditions: GrowthMap = {};

  growthStage(level: PlantLevel, sunlight: number, water: number): PlantBuilder {
    if (!this.conditions[level]) {
      this.conditions[level] = { sunlight, water };
    } else {
      this.conditions[level]!.sunlight = sunlight;
      this.conditions[level]!.water = water;
    }
    return this;
  }

  neighborsCondition(level: PlantLevel, requiredNeighbors: Partial<Record<PlantType, number>>): PlantBuilder {
    if (!this.conditions[level]) {
      this.conditions[level] = { sunlight: 0, water: 0 };
    }
    this.conditions[level]!.neighbors = { requiredNeighbors };
    return this;
  }

  build(): GrowthMap {
    return this.conditions;
  }
}

const plantDefinitions: Record<PlantType, GrowthMap> = {
  [PlantType.None]: {},
  [PlantType.Potato]: {},
  [PlantType.Carrot]: {},
  [PlantType.Cabbage]: {}
};

function definePlant(type: PlantType, definition: (b: PlantBuilder) => void) {
  const builder = new PlantBuilder();
  definition(builder);
  plantDefinitions[type] = builder.build();
}

export default class GameScene extends Phaser.Scene {
  private localization: LocalizationManager;
  private player!: Player;
  private grid: {rectangle: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text;}[][] = [];
  private activeTile: {rectangle: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text;} | null = null; 

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
    this.localization = LocalizationManager.getInstance();
  }

  async create() {
    this.gridData = new Uint8Array(GRID_SIZE * GRID_SIZE * this.FIELDS_PER_CELL);
    await this.initNewGame();
    
    this.createMobileControls();
    this.createLanguageSwitcher(); // 创建语言切换按钮

    const autoSaveData = localStorage.getItem("autoSave");
    if (autoSaveData) {
      const loadFromAutoSave = window.confirm(this.localization.translate("autosaveFound"));
      if (loadFromAutoSave) {
        this.loadGameFromJSON(autoSaveData);
      }
    }

    if (this.input && this.input.keyboard) {
      this.input.keyboard.on("keydown-P", () => this.performAction(() => this.plantOnCurrentTile("potato")));
      this.input.keyboard.on("keydown-C", () => this.performAction(() => this.plantOnCurrentTile("carrot")));
      this.input.keyboard.on("keydown-B", () => this.performAction(() => this.plantOnCurrentTile("cabbage")));
      this.input.keyboard.on("keydown-H", () => this.performAction(() => this.harvestFromCurrentTile()));

      this.input.keyboard.on("keydown-S", () => {
        this.actionsRemaining++;
        this.performAction(() => {
          const slotStr = window.prompt(this.localization.translate("savePrompt"));
          if (slotStr) {
            const slot = parseInt(slotStr, 10);
            if (!isNaN(slot)) {
              this.saveGame(slot);
            }
          }
          return true; 
        });
      });

      this.input.keyboard.on("keydown-L", () => {
        this.actionsRemaining++;
        this.performAction(() => {
          const slotStr = window.prompt(this.localization.translate("loadPrompt"));
          if (slotStr) {
            const slot = parseInt(slotStr, 10);
            if (!isNaN(slot)) {
              this.loadGame(slot);
            }
          }
          return true; 
        });
      });

      // Undo and Redo do not decrement actionsRemaining
      this.input.keyboard.on("keydown-U", () => {
        this.undo();
      });

      this.input.keyboard.on("keydown-R", () => {
        this.redo();
      });
    } else {
      console.error("Keyboard input plugin is not initialized.");
    }
  }

  // 创建语言切换按钮
  private createLanguageSwitcher() {
    const languages = [
      { code: 'en', label: 'EN' },
      { code: 'he', label: 'HE' },
      { code: 'zh', label: 'ZH' },
    ];
    const buttonWidth = 50;
    const buttonHeight = 30;
    const padding = 10;
    const startX = this.cameras.main.width - buttonWidth - padding;
    const startY = padding;

    languages.forEach((lang, index) => {
      const button = this.add.rectangle(
        startX,
        startY + index * (buttonHeight + padding),
        buttonWidth,
        buttonHeight,
        0x000000,
        0.7
      ).setOrigin(0, 0).setInteractive();

      const buttonText = this.add.text(
        startX + buttonWidth / 2,
        startY + index * (buttonHeight + padding) + buttonHeight / 2,
        lang.label,
        {
          font: "16px Arial",
          color: "#ffffff",
        }
      ).setOrigin(0.5, 0.5);

      button.on("pointerdown", () => {
        this.localization.setLocale(lang.code as 'en' | 'he' | 'zh');
        this.updateAllLocalizedTexts();
      });
    });
  }

  private updateAllLocalizedTexts() {
    const currentLocale = this.localization.getLocale();

    // 更新控制说明
    this.controlsText.setText(this.localization.translate("controls"));
    this.controlsText.setStyle({
      align: currentLocale === 'he' ? 'right' : 'left',
    });

    // 更新日计数
    this.updateDayCounter();
    
    // 更新库存显示
    this.updateInventoryDisplay();

    // 更新成就显示
    this.updateAchievementsDisplay();

    // 更新行动计数
    this.updateActionsCounter();

    // 更新所有格子显示
    this.updateAllTilesDisplay();
  }

  private async loadSceneConfigFromYAML(): Promise<any> {
    try {
      const response = await fetch('dist/scenes.yaml'); 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      const data = yaml.load(text);
      return data;
    } catch (error) {
      console.error("Error loading scenes.yaml:", error);
      return null;
    }
  }

  private async loadPlantDefinitionsFromYAML(): Promise<void> {
    try {
      const response = await fetch('dist/plants.yaml');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      const data = yaml.load(text) as PlantsYAML;

      const plantTypes: PlantType[] = [PlantType.Potato, PlantType.Carrot, PlantType.Cabbage];
      for (const type of plantTypes) {
        const typeName = PlantType[type].toLowerCase();
        const plantConfigs = data.plants[typeName as keyof PlantsYAML['plants']] as PlantLevelConfig[] | undefined;
        if (plantConfigs) {
          definePlant(type, b => {
            for (const cfg of plantConfigs) {
              b.growthStage(cfg.level as PlantLevel, cfg.sunlight, cfg.water);
              if (cfg.neighbors && cfg.neighbors.requiredNeighbors) {
                const requiredNeighbors: Partial<Record<PlantType, number>> = {};
                for (const [plantName, count] of Object.entries(cfg.neighbors.requiredNeighbors)) {
                  switch (plantName) {
                    case "potato":
                      requiredNeighbors[PlantType.Potato] = count;
                      break;
                    case "carrot":
                      requiredNeighbors[PlantType.Carrot] = count;
                      break;
                    case "cabbage":
                      requiredNeighbors[PlantType.Cabbage] = count;
                      break;
                    default:
                      console.warn(`Unknown plant type in neighbors: ${plantName}`);
                  }
                }
                b.neighborsCondition(cfg.level as PlantLevel, requiredNeighbors);
              }
            }
          });
        }
      }

    } catch (error) {
      console.error("Error loading plants.yaml:", error);
    }
  }

  private async initNewGame() {
    this.undoStack = [];
    this.redoStack = [];

    await this.loadPlantDefinitionsFromYAML();
    const yamlData = await this.loadSceneConfigFromYAML();

    if (yamlData && yamlData.initial) {
      const initial = yamlData.initial;
      if (typeof initial.dayCount === "number") {
        this.dayCount = initial.dayCount;
      }
      if (initial.inventory) {
        this.inventory = {
          potato: initial.inventory.potato ?? this.inventory.potato,
          carrot: initial.inventory.carrot ?? this.inventory.carrot,
          cabbage: initial.inventory.cabbage ?? this.inventory.cabbage,
        };
      }
      if (typeof initial.actionsRemaining === "number") {
        this.actionsRemaining = initial.actionsRemaining;
      }
      if (Array.isArray(initial.achievements)) {
        this.achievements = [...initial.achievements];
      }
    }

    this.createGrid();

    if (yamlData && Array.isArray(yamlData.gridOverrides)) {
      for (const cell of yamlData.gridOverrides) {
        const { row, col, sunlight, water, plantType, plantLevel } = cell;
        if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
          if (typeof sunlight === "number") this.setSunlight(row, col, sunlight);
          if (typeof water === "number") this.setWater(row, col, water);

          if (plantType) {
            let pType = PlantType.None;
            if (plantType === "potato") pType = PlantType.Potato;
            else if (plantType === "carrot") pType = PlantType.Carrot;
            else if (plantType === "cabbage") pType = PlantType.Cabbage;
            this.setPlantType(row, col, pType);
          }

          if (typeof plantLevel === "number") {
            this.setPlantLevel(row, col, plantLevel);
          }
        }
      }
    }

    this.createPlayer();
    this.createNextDayButton();
    this.updateDayCounter();
    this.createInventoryDisplay();
    this.createAchievementsDisplay();
    this.createControlsDisplay();
    this.createActionsCounter();
    this.updateActionsCounter();
    this.updateAllTilesDisplay();
  }

  private createActionsCounter() {
    this.actionsText = this.add.text(10, 200, this.localization.translate("actionsRemaining", { actions: this.actionsRemaining }), {
      font: "16px Arial",
      color: "#ffffff",
    });
  }

  private updateActionsCounter() {
    this.actionsText.setText(this.localization.translate("actionsRemaining", { actionsRemaining: this.actionsRemaining }));
  }

  private performAction(action: () => boolean, countAsAction: boolean = true) {
    if (countAsAction && this.actionsRemaining <= 0) {
      console.error(this.localization.translate("noActionsRemaining"));
      return;
    }
  
    this.pushCurrentStateToUndo();
    const actionSucceeded = action();
    this.redoStack = [];
  
    if (actionSucceeded) {
      if (countAsAction) {
        this.actionsRemaining = Math.max(0, this.actionsRemaining - 1);
        this.updateActionsCounter();
      }
    } else {
      const prevState = this.undoStack.pop();
      if (prevState) {
        this.loadFromGameState(prevState);
      }
    }
  
    this.autoSaveGame();
  }

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

    this.dayText.setText(this.localization.translate("day", { day: this.dayCount }));
    this.updateInventoryDisplay();
    this.updateAchievementsDisplay();
    this.updateAllTilesDisplay();
    this.updateActionsCounter();
  }

  private undo() {
    if (this.undoStack.length > 0) {
      this.redoStack.push(this.copyCurrentState());
      const prevState = this.undoStack.pop()!;
      this.loadFromGameState(prevState);
      this.autoSaveGame();
    } else {
      console.log(this.localization.translate("undoUnavailable"));
    }
  }

  private redo() {
    if (this.redoStack.length > 0) {
      this.undoStack.push(this.copyCurrentState());
      const nextState = this.redoStack.pop()!;
      this.loadFromGameState(nextState);
      this.autoSaveGame();
    } else {
      console.log(this.localization.translate("redoUnavailable"));
    }
  }

  private createControlsDisplay() {
    const text = this.localization.translate("controls");
    this.controlsText = this.add.text(
      this.cameras.main.width - 200,
      50,
      text,
      {
        font: "16px Arial",
        color: "#ffffff",
        align: this.localization.getLocale() === 'he' ? 'right' : 'left',
      }
    );
    this.controlsText.setOrigin(0, 0);
  }

  private createAchievementsDisplay() {
    this.achievementsText = this.add.text(10, 250, this.localization.translate("achievements", { achievements: this.achievements.join("\n") }), {
      font: "16px Arial",
      color: "#ffffff",
      align: this.localization.getLocale() === 'he' ? 'right' : 'left',
      wordWrap: { width: 180, useAdvancedWrap: true }
    });
  }

  private updateAchievements(type?: "potato" | "carrot" | "cabbage") {
    const thresholds = [
      { count: 10, title: `${type} master` },
      { count: 15, title: `${type} god` },
      { count: 20, title: `${type} legend` },
    ];

    if (type) {
      for (const threshold of thresholds) {
        if (this.inventory[type] >= threshold.count && !this.achievements.includes(threshold.title)) {
          this.achievements.push(threshold.title);
          this.showAchievement(threshold.title);
        }
      }
    }

    this.updateAchievementsDisplay();
  }

  private showAchievement(title: string) {
    const achievementText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.localization.translate("achievementUnlocked", { title }),
      {
        font: "20px Arial",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { left: 10, right: 10, top: 5, bottom: 5 },
        align: this.localization.getLocale() === 'he' ? 'right' : 'left',
      }
    );
    achievementText.setOrigin(0.5, 0.5);

    this.time.delayedCall(2000, () => {
      achievementText.destroy();
    });
  }

  private updateAchievementsDisplay() {
    this.achievementsText.setText(this.localization.translate("achievements", { achievements: this.achievements.join("\n") }));
    this.achievementsText.setStyle({
      align: this.localization.getLocale() === 'he' ? 'right' : 'left',
    });
  }

  private createGrid() {
    const offsetX = (this.cameras.main.width - GRID_SIZE * TILE_SIZE) / 2;
    const offsetY = (this.cameras.main.height - GRID_SIZE * TILE_SIZE) / 2;

    for (let row = 0; row < GRID_SIZE; row++) {
      const gridRow: {rectangle: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text;}[] = [];
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
        const tileInfo = this.getTileInfoString(row, col);
        const text = this.add.text(textX, textY, tileInfo, {
          font: "14px Arial",
          color: "#ffffff",
          align: this.localization.getLocale() === 'he' ? 'right' : 'left',
          wordWrap: { width: TILE_SIZE - 10, useAdvancedWrap: true }
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
    const button = this.add.text(150, 50, this.localization.translate("nextDay"), {
      font: "20px Arial",
      backgroundColor: "#000000",
      color: "#ffffff",
      padding: { left: 10, right: 10, top: 5, bottom: 5 },
      align: this.localization.getLocale() === 'he' ? 'right' : 'left',
    });

    button.setInteractive();
    button.on("pointerdown", () => {
      this.performAction(() => {
        this.dayCount++;
        this.actionsRemaining = 10;
        this.updateActionsCounter();
        this.dayText.setText(this.localization.translate("day", { day: this.dayCount }));
        this.growPlants();
        this.updateGridProperties();
        return true; 
      }, false);
    });
  }

  private updateDayCounter() {
    if (!this.dayText) {
      this.dayText = this.add.text(10, 50, "", {
        font: "20px Arial",
        color: "#ffffff",
      });
    }
  
    this.dayText.setText(this.localization.translate("day", { day: this.dayCount }));
    this.dayText.setStyle({
      align: this.localization.getLocale() === 'he' ? 'right' : 'left',
    });
  }
  

  private createInventoryDisplay() {
    this.inventoryText = this.add.text(10, 100, this.localization.translate("inventory", this.getInventoryVariables()), {
      font: "16px Arial",
      color: "#ffffff",
      align: this.localization.getLocale() === 'he' ? 'right' : 'left',
      wordWrap: { width: 180, useAdvancedWrap: true }
    });
  }

  private getInventoryVariables(): Record<string, any> {
    return {
      potato: this.inventory.potato,
      carrot: this.inventory.carrot,
      cabbage: this.inventory.cabbage
    };
  }

  private updateInventoryDisplay() {
    this.inventoryText.setText(this.localization.translate("inventory", this.getInventoryVariables()));
    this.inventoryText.setStyle({
      align: this.localization.getLocale() === 'he' ? 'right' : 'left',
    });
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
      const typeStr = (plantType === PlantType.Potato) ? this.localization.translate("Potato") :
                      (plantType === PlantType.Carrot) ? this.localization.translate("Carrot") : this.localization.translate("Cabbage");
      str += `\n🌱 ${typeStr} L${plantLevel}`;

      const growthCondition = plantDefinitions[plantType][plantLevel as PlantLevel];
      if (growthCondition && growthCondition.neighbors && growthCondition.neighbors.requiredNeighbors) {
        const neighborConditions = Object.entries(growthCondition.neighbors.requiredNeighbors)
          .map(([t, count]) => `${this.getPlantTypeString(Number(t) as PlantType)}: ${count}`)
          .join(", ");
        str += `\n🔗 ${neighborConditions}`;
      }
    }
    return str;
  }

  private getPlantTypeString(type: PlantType): string {
    switch (type) {
      case PlantType.Potato:
        return this.localization.translate("Potato");
      case PlantType.Carrot:
        return this.localization.translate("Carrot");
      case PlantType.Cabbage:
        return this.localization.translate("Cabbage");
      default:
        return this.localization.translate("None");
    }
  }

  private updateAllTilesDisplay() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const tileInfo = this.getTileInfoString(row, col);
        this.grid[row][col].text.setText(tileInfo);
        this.grid[row][col].text.setStyle({
          align: this.localization.getLocale() === 'he' ? 'right' : 'left',
        });
      }
    }
  }

  private plantOnCurrentTile(type: "potato" | "carrot" | "cabbage"): boolean {
    if (!this.activeTile) return false;
  
    const { row, col } = this.getActiveTilePosition();
    const water = this.getWater(row, col);

    if (this.getPlantType(row, col) !== PlantType.None) {
      console.error(this.localization.translate("noPlantHere"));
      return false;
    }

    const conditions: Record<"potato"|"carrot"|"cabbage", boolean> = {
      potato: water >= 20,
      carrot: water >= 20,
      cabbage: water >= 70,
    };

    if (!conditions[type]) {
      console.error(this.localization.translate("conditionsNotMet"));
      return false;
    }

    const plantTypeEnum = (type === "potato") ? PlantType.Potato : 
                          (type === "carrot") ? PlantType.Carrot : PlantType.Cabbage;
    
    const plantGrowthMap = plantDefinitions[plantTypeEnum];
    const currentLevel = 1 as PlantLevel;
    const growthCondition = plantGrowthMap[currentLevel];
    
    if (growthCondition && growthCondition.neighbors && growthCondition.neighbors.requiredNeighbors) {
      const { requiredNeighbors } = growthCondition.neighbors;
      let canPlant = true;

      const directions = [
        {dr: -1, dc: 0},
        {dr: 1, dc: 0},
        {dr: 0, dc: -1},
        {dr: 0, dc: 1},
        {dr: -1, dc: -1},
        {dr: -1, dc: 1},
        {dr: 1, dc: -1},
        {dr: 1, dc: 1},
      ];

      for (const [neighborType, requiredCount] of Object.entries(requiredNeighbors)) {
        const typeEnum = Number(neighborType) as PlantType;
        let count = 0;
        for (const dir of directions) {
          const newRow = row + dir.dr;
          const newCol = col + dir.dc;
          if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
            const neighborPlantType = this.getPlantType(newRow, newCol);
            if (neighborPlantType === typeEnum) {
              count++;
              if (count >= requiredCount) break;
            }
          }
        }

        if (count < requiredCount) {
          canPlant = false;
          console.error(this.localization.translate("insufficientNeighbors", { type, count: requiredCount, plant: this.getPlantTypeString(typeEnum) }));
          break;
        }
      }

      if (!canPlant) return false;
    }

    if (this.inventory[type] <= 0) {
      console.error(this.localization.translate("noInventory", { type }));
      return false;
    }

    const waterCost = { potato: 20, carrot: 20, cabbage: 70 };
    this.setWater(row, col, water - waterCost[type]);
    this.inventory[type]--;
    this.updateInventoryDisplay();

    const plantEnum = plantTypeEnum;
    this.setPlantType(row, col, plantEnum);
    this.setPlantLevel(row, col, 1);
    this.updateAllTilesDisplay();

    return true; 
  }  

  private growPlants() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const plantType = this.getPlantType(row, col);
        if (plantType === PlantType.None) continue;

        const currentLevel = this.getPlantLevel(row, col);
        if (currentLevel < 1 || currentLevel > 3) continue;

        const nextLevel = (currentLevel + 1) as PlantLevel;
        const cond = plantDefinitions[plantType][nextLevel];
        if (!cond) continue;

        if (cond.neighbors && cond.neighbors.requiredNeighbors) {
          const { requiredNeighbors } = cond.neighbors;
          let canGrow = true;

          const directions = [
            {dr: -1, dc: 0},
            {dr: 1, dc: 0},
            {dr: 0, dc: -1},
            {dr: 0, dc: 1},
            {dr: -1, dc: -1},
            {dr: -1, dc: 1},
            {dr: 1, dc: -1},
            {dr: 1, dc: 1},
          ];

          for (const [neighborType, requiredCount] of Object.entries(requiredNeighbors)) {
            const typeEnum = Number(neighborType) as PlantType;
            let count = 0;
            for (const dir of directions) {
              const newRow = row + dir.dr;
              const newCol = col + dir.dc;
              if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
                const neighborPlantType = this.getPlantType(newRow, newCol);
                if (neighborPlantType === typeEnum) {
                  count++;
                  if (count >= requiredCount) break;
                }
              }
            }

            if (count < requiredCount) {
              canGrow = false;
              console.log(this.localization.translate("plantCannotGrow", { row, col, level: nextLevel, plant: this.getPlantTypeString(typeEnum) }));
              break;
            }
          }

          if (!canGrow) {
            continue;
          }
        }

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

  private harvestFromCurrentTile(): boolean {
    if (!this.activeTile) {
      console.error(this.localization.translate("noActiveTile"));
      return false;
    }
  
    const { row, col } = this.getActiveTilePosition();
    const plantType = this.getPlantType(row, col);
    const level = this.getPlantLevel(row, col);
    if (plantType === PlantType.None) {
      console.error(this.localization.translate("noPlantToHarvest"));
      return false;
    }
  
    if (level < 1 || level > 3) {
      console.error(this.localization.translate("invalidPlantLevel"));
      return false;
    }
  
    const harvestMap: Record<PlantLevel, number> = {1:1,2:2,3:4};
    const harvestAmount = harvestMap[level as PlantLevel];
  
    let typeKey: "potato"|"carrot"|"cabbage" = "potato";
    if (plantType === PlantType.Carrot) typeKey = "carrot";
    if (plantType === PlantType.Cabbage) typeKey = "cabbage";
  
    this.inventory[typeKey] += harvestAmount;
    this.setPlantType(row, col, PlantType.None);
    this.setPlantLevel(row, col, 0);
    this.updateInventoryDisplay();
    this.updateAchievements(typeKey);
    this.updateAllTilesDisplay();
  
    return true; 
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
    console.log(this.localization.translate("gameSaved", { slot }));
  }

  private loadGame(slot: number) {
    const dataStr = localStorage.getItem(`saveSlot${slot}`);
    if (!dataStr) {
      console.error(this.localization.translate("noSaveFound", { slot }));
      return;
    }

    this.loadGameFromJSON(dataStr);
    console.log(this.localization.translate("gameLoaded", { slot }));
  }

  private loadGameFromJSON(dataStr: string) {
    const saved = JSON.parse(dataStr) as FullSaveData;

    const currentState = this.saveFormatToGameState(saved.currentState);
    this.loadFromGameState(currentState);

    this.undoStack = saved.undoStack.map(s => this.saveFormatToGameState(s));
    this.redoStack = saved.redoStack.map(s => this.saveFormatToGameState(s));

    console.log(this.localization.translate("gameLoadedWithUndoRedo"));
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

  private createMobileControls() {
    const buttonStyle = {
    font: "16px Arial",
    backgroundColor: "#000000",
    color: "#ffffff",
    padding: { left: 10, right: 10, top: 5, bottom: 5 }
    };
  
    const plantPotatoBtn = this.add.text(10, 500, "Plant Potato", buttonStyle).setInteractive();
    plantPotatoBtn.on("pointerdown", () => {
    this.performAction(() => this.plantOnCurrentTile("potato"));
     });
     
    const plantCarrotBtn = this.add.text(10, 530, "Plant Carrot", buttonStyle).setInteractive();
    plantCarrotBtn.on("pointerdown", () => {
    this.performAction(() => this.plantOnCurrentTile("carrot"));
    });
    
    const plantCabbageBtn = this.add.text(10, 560, "Plant Cabbage", buttonStyle).setInteractive();
    plantCabbageBtn.on("pointerdown", () => {
    this.performAction(() => this.plantOnCurrentTile("cabbage"));
    });
    
    const harvestBtn = this.add.text(10, 590, "Harvest", buttonStyle).setInteractive();
    harvestBtn.on("pointerdown", () => {
    this.performAction(() => this.harvestFromCurrentTile());
    });
  
    const saveBtn = this.add.text(10, 620, "Save", buttonStyle).setInteractive();
    saveBtn.on("pointerdown", () => {
    this.actionsRemaining++;
    this.performAction(() => {
    const slotStr = window.prompt("Enter save slot number (e.g. 1, 2, 3):");
    if (slotStr) {
    const slot = parseInt(slotStr, 10);
    if (!isNaN(slot)) {
    this.saveGame(slot);
    }
    }
    return true;
    });
    });

    const loadBtn = this.add.text(10, 650, "Load", buttonStyle).setInteractive();
    loadBtn.on("pointerdown", () => {
    this.actionsRemaining++;
    this.performAction(() => {
    const slotStr = window.prompt("Enter load slot number (e.g. 1, 2, 3):");
    if (slotStr) {
    const slot = parseInt(slotStr, 10);
    if (!isNaN(slot)) {
    this.loadGame(slot);
    }
    }
    return true;
   });
  });
    const undoBtn = this.add.text(10, 680, "Undo", buttonStyle).setInteractive();
    undoBtn.on("pointerdown", () => {
    this.undo();
    });
    
    const redoBtn = this.add.text(10, 710, "Redo", buttonStyle).setInteractive();
    redoBtn.on("pointerdown", () => {
      this.redo();
    });
    
    const moveDistance = TILE_SIZE;  
    const upBtn = this.add.text(60, 800, "↑", buttonStyle).setInteractive();
    upBtn.on("pointerdown", () => {
      if (this.player) {
        this.player.y -= moveDistance;
      }
    });

    const downBtn = this.add.text(60, 860, "↓", buttonStyle).setInteractive();
    downBtn.on("pointerdown", () => {
    if (this.player) {
    this.player.y += moveDistance;
    }
    });

    const leftBtn = this.add.text(20, 830, "←", buttonStyle).setInteractive();
    leftBtn.on("pointerdown", () => {
    if (this.player) {
    this.player.x -= moveDistance;
    }
    });

    const rightBtn = this.add.text(100, 830, "→", buttonStyle).setInteractive();
    rightBtn.on("pointerdown", () => {
    if (this.player) {
    this.player.x += moveDistance;
    }
    });
  }
}

