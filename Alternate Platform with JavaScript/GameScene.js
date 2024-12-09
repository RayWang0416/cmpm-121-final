import Phaser from "phaser"; 
import { GRID_SIZE, TILE_SIZE } from "../utils/Constants";
import Player from "../objects/Player";
import * as yaml from 'js-yaml';  

const GRID_SIZE = 10; // Example grid size
const TILE_SIZE = 32; // Example tile size

const PlantType = {
  None: 0,
  Potato: 1,
  Carrot: 2,
  Cabbage: 3,
};

const plantDefinitions = {
  [PlantType.None]: {},
  [PlantType.Potato]: {},
  [PlantType.Carrot]: {},
  [PlantType.Cabbage]: {},
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.dayCount = 1;
    this.inventory = { potato: 1, carrot: 1, cabbage: 1 };
    this.achievements = [];
    this.actionsRemaining = 10;
    this.gridData = new Uint8Array(GRID_SIZE * GRID_SIZE * 4);
    this.undoStack = [];
    this.redoStack = [];
    this.FIELDS_PER_CELL = 4;
    this.SUNLIGHT_OFFSET = 0;
    this.WATER_OFFSET = 1;
    this.PLANT_TYPE_OFFSET = 2;
    this.PLANT_LEVEL_OFFSET = 3;
  }

  async create() {
    this.gridData.fill(0); // Initialize grid data
    this.createGrid();
    this.createPlayer();
    this.createNextDayButton();
    this.createInventoryDisplay();
    this.createActionsCounter();
  }

  createPlayer() {
    this.player = new Player(this, this.scale.width / 2, this.scale.height / 2);
  }

  createGrid() {
    const offsetX = (this.scale.width - GRID_SIZE * TILE_SIZE) / 2;
    const offsetY = (this.scale.height - GRID_SIZE * TILE_SIZE) / 2;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const x = offsetX + col * TILE_SIZE;
        const y = offsetY + row * TILE_SIZE;
        this.add.rectangle(x, y, TILE_SIZE, TILE_SIZE, 0x228b22).setStrokeStyle(1, 0x000000);
      }
    }
  }

  createNextDayButton() {
    const button = this.add.text(150, 50, 'Next Day', {
      font: '20px Arial',
      backgroundColor: '#000',
      color: '#fff',
      padding: { left: 10, right: 10, top: 5, bottom: 5 },
    });
    button.setInteractive();
    button.on('pointerdown', () => {
      this.dayCount++;
      this.actionsRemaining = 10;
      console.log('Day advanced: ', this.dayCount);
    });
  }

  createInventoryDisplay() {
    this.inventoryText = this.add.text(10, 100, this.getInventoryString(), {
      font: '16px Arial',
      color: '#fff',
    });
  }

  createActionsCounter() {
    this.actionsText = this.add.text(10, 200, `Actions Remaining: ${this.actionsRemaining}`, {
      font: '16px Arial',
      color: '#fff',
    });
  }

  getInventoryString() {
    return `Inventory:\nPotato: ${this.inventory.potato}\nCarrot: ${this.inventory.carrot}\nCabbage: ${this.inventory.cabbage}`;
  }

  update(time, delta) {
    if (this.player) {
      this.player.update(delta);
    }
  }
}
