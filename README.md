# Devlog Entry - [2024/11/22]

## Introducing the Team
**Tools Lead**: **Hengyang Ye**


**Engine Lead**: **Hengyang Ye**, **Ray Wang**


**Design Lead**: **Ray Wang**

---

## Tools and Materials

### Engines, Libraries, Frameworks, and Platforms:
-Phaser3, Typescript, Html5

We Choose to use Phaser3 framework because it is more familiar to us. 

We Choose Typescript instead of Javascript because TS is a superset of JS.

### Programming and Data Languages:
- Our project will primarily use **TypeScript** for the game logic. For styling, we will use **CSS**. JSON may be used for data storage and exchange between systems.  

### Authoring Tools:
- **Visual Studio Code (VS Code)**: Our IDE for coding.  
- **Git**: Version control to manage our code and collaborate effectively.    

### Alternate Platform:
- If Phaser3 does not work well in the project, We will use Godot instead.

---

## Outlook
- We wish to learn the implementation of a SAVE & LOAD system for game, and the Internal and External DSLs.


**#For somehow if I missed the time to upload the video in canvas, I will provide the video links below in each devlog!**


# Devlog F0

F0 Video:

https://drive.google.com/file/d/1J96qmZidWx0OivmfSuT5HXZSIu3bYhP_/view?usp=sharing

## How we satisfied the software requirements
- f0.a: The player can control a yellow square as the character, using arrow keys to move over a 5*5 2D grid.
- f0.b: The player can clicked the 'next day' button to start the next day. For each day, the player has 10 actions(Plant or Harvest will use an action).
- f0.c: When the player steps on a grid, then the grid the highlighted and he can interact with that grid.
- f0.d: The grid will show it's sun and water level. For each day the sun and water will randomly generated. The sun level will can not accumulate, but the water level can.(Sun: 0-100, Water(Current level + 0-30).
- f0.e: There is 3 crops, potato, carrot, and cabbage. Each of them has 3 growth level.
- f0.f: If the sun and water level of current grid fit the requirement of growth, the plant will grow, upgrade to next level.
- f0.g: The player will unlock achievements if he get a decent number of crops.

## Reflection
For F0 We found that Phaser is enough for our needs, so there is no big changes. However, we somehow changed our roles. Hengyang did the overall design of the game, and Ray Implement most of the code.


# Devlog F1

F1 Video:

https://drive.google.com/file/d/1m4p1aQEZEnVLRRoUsHuiLvaJGGHnDOLp/view?usp=sharing

## How we satisfied the software requirements

### F0+F1
- f0.a: same as last week
- f0.b: same as last week
- f0.c: same as last week
- f0.d: same as last week
- f0.e: same as last week
- f0.f: If the sun and water level of current grid fit the requirement of growth, and the plant has correct neighbors, it will grow, upgrade to next level.
- f0.g: same as last week
  
- f1.a: The game's grid state is stored in a single contiguous byte array.
  We implemented this using an Array of Structures (AoS) format. Each cell is represented by 4 bytes:

  Byte 0: Sunlight (0–100)
  
  Byte 1: Water (0–100)
  
  Byte 2: Plant Type (0 = none, 1 = potato, 2 = carrot, 3 = cabbage)
  
  Byte 3: Plant Level (0–3, 0 means no plant)
  
  This yields a layout like this:
    [Cell0:Sun,Water,Type,Level][Cell1:Sun,Water,Type,Level]...[CellN:Sun,Water,Type,Level]

  ![F1.a data structure diagram](./memory.png)

  Thus, (row * GRID_SIZE + col)*4 gives the starting index for a cell. We chose AoS because it keeps all data for a single tile adjacent, making it straightforward to update and display each tile.
  
- f1.b: We serialize dayCount, inventory, achievements, actionsRemaining, gridData, and now also undoStack/redoStack into JSON and store them in localStorage. The player can choose a slot to save and load from.

- f1.c: After major actions (e.g. end of day, planting, harvesting), we auto-save the current state into localStorage under a special autoSave key. On next startup, if autoSave is found, the player can choose to continue from that state.

- f1.d: We maintain two stacks: undoStack and redoStack. Before any major state change, we push the current state onto undoStack. Undo pops from undoStack and pushes onto redoStack, reverting to a previous state. Redo pops from redoStack and pushes to undoStack, moving forward again. These stacks are also saved and loaded, so after loading a game, the player can still undo/redo previous actions.

## Reflection
Implementing F1 made us consider how the player's interaction with the game’s timeline evolves. Previously, we only tracked current state, but now we manage historical states for undo/redo. We needed a more careful approach to serialization, ensuring undoStack and redoStack were saved and restored properly.

# Devlog F2

F2 Video:

https://drive.google.com/file/d/1ksac5CYxnAPZCAF2ghV6FxyjbiZW76sM/view?usp=sharing

## How we satisfied the software requirements

### F0+F1
- No major changes were made

### External DSL for Scenario Design
For our external DSL, we decided to use YAML as the underlying data representation. Designers can write YAML files to define initial conditions, inventory, achievements, and specific overrides for certain grid cells.

```Typescript

initial: // Change the initial game state
  dayCount: 5 
  inventory:
    potato: 2
    carrot: 5
    cabbage: 0
  actionsRemaining: 12
  achievements: ["Overnight Farmer"]


gridOverrides: // override the initial state of a grid
  - row: 1
    col: 2
    sunlight: 80
    water: 10
    plantType: carrot
    plantLevel: 2
```
- On Day 1, you start at dayCount=5, meaning the scenario begins on Day 5 of the simulation.
- Your starting inventory includes 2 potatoes, 5 carrots, and no cabbages. You have 12 actions to use this day, and have already earned an achievement called "Overnight Farmer".
- One specific grid cell at position (1,2) is overridden to have very high sunlight (80) and low water (10), and it already has a carrot plant at level 2, making it easier for that plant to potentially grow further if conditions are met.


### Internal DSL for Plants and Growth Conditions
For our internal DSL, we chose to express plant growth conditions using TypeScript as the host language. We introduced a PlantBuilder class and a definePlant function that allows defining complex growth rules using a fluent API. This internal DSL leverages host language features like type-checking, enums, and function composition.

```Typescript
// Host language: TypeScript

definePlant(PlantType.Carrot, b => {
  b.growthStage(2, 60, 40)
   .neighborsCondition(2, { [PlantType.Potato]: 1 })
   .growthStage(3, 45, 20)
   .neighborsCondition(3, { [PlantType.Potato]: 1, [PlantType.Cabbage]: 1 });

  /* ...other plant definitions... */
});

```

This code defines a carrot plant type with two additional growth stages beyond the base level (levels 2 and 3). To reach level 2, a carrot needs at least 60 sunlight, 40 water, and at least 1 potato plant nearby. To grow to level 3, it needs 45 sunlight, 20 water, and it must be near at least 1 potato and 1 cabbage. Using TypeScript, we can easily add conditions, integrate enums for plant types, and even dynamically compute values if needed. These host-language features would be more difficult to implement in a purely external DSL, and allow our internal DSL to be more expressive and powerful.

### Switch to Alternate Platform
For our alternate platform, we decided to move from TypeScript + Phaser to a JavaScript still using Phaser. By removing the TypeScript layer and working directly in JavaScript, we tested how the absence of static typing and compile-time checks would impact our ability to maintain the DSL-driven design.

What carried over:

The external scenario definitions in YAML and the internal DSL for plant growth conditions remained almost entirely unchanged. We can still load and parse the YAML scenario files and interpret plant definitions the same way. The logic that was previously expressed in TypeScript still transfers directly into JavaScript because JavaScript is the underlying runtime. Our DSL structures—objects, arrays, and higher-order functions—are all compatible since they rely on language features present in both TypeScript and JavaScript.

What changed:

With TypeScript removed, we lose compile-time type checks and editor-level type hints. This means less direct guidance when writing DSL code and scenario interpretation logic. While the DSL code looks similar (the definePlant calls and YAML parsing remain the same), any type-specific safeguards we had are gone, making runtime validation and careful testing even more important.

The Phaser API usage itself remains the same since we are still using Phaser as the game engine. The scene and input handling work as they did before, just without TypeScript declarations. We still have this.add.text(), this.add.rectangle(), and Phaser’s scene lifecycle methods. The main difference is that these calls no longer benefit from TypeScript's intellisense and strict type checking.

Choice of new platform:

We chose JavaScript + Phaser because it allowed us to focus on removing the type-checking layer without changing the engine framework. 


## Reflection
Looking back on implementing F2, we realized that building the DSLs and separating scenario data from the code gave us greater flexibility. Initially, we tied many features directly into the engine-specific code, but now that we've moved logic into external (YAML) and internal (TypeScript fluent API) DSLs, it's easier to adjust behaviors and conditions without rewriting core logic.
We also reconsidered our Tools and Materials. The addition of YAML parsing and building an internal DSL forced us to invest time in documentation and in making the DSL intuitive.


# Devlog F3

## How we satisfied the software requirements

### F0+F1+F2

- No major changes were made

### Internationalization

We introduced a LocalizationManager to manage all translatable strings in the game. Strings displayed to the player were removed from the main game logic and placed into separate JSON files (en.json, zh.json, he.json). This ensures that all player-facing text is centralized, making it easier to manage and extend.

The game now loads translations dynamically based on the selected language, with default fallbacks to English for untranslated keys. When adding a new language or a translatable string, developers only need to update the relevant JSON file and ensure that the LocalizationManager can access it.

To ensure correctness, we used TypeScript's type system to enforce the presence of translation keys in each language file. This helped catch missing translations during development.

### Localization

The game supports three languages:

English (en): The default language.
Chinese (zh): Localization was completed using existing knowledge within the team and verified for accuracy.
Hebrew (he): As a right-to-left script, this required adjustments for text alignment. We used ChatGPT for translations, providing the system with specific phrases and contexts from our game. For example, prompts included: "Translate 'Next Day' in the context of a farming simulation game."
Language selection is implemented via three buttons displayed on the right side of the screen, labeled with the language name. Players can click a button to switch the language instantly during gameplay.

### Mobile Installation

To make the game installable on a smartphone-class mobile device, we utilized Capacitor. We followed Capacitor’s tutorials (https://www.youtube.com/watch?v=rlNms8xoLXo) for integrating a Phaser game into an Android project. 

### Mobile Play (Offline)

We ensured offline play by bundling all game assets (e.g., images, YAML files) directly into the app during the build process. This was achieved by ensuring that Phaser loaded all assets from local paths rather than relying on external URLs. The dist/ directory was structured to include all necessary files, including language JSON files, images, and audio.

## Reflection

Implementing F3 requirements significantly impacted our development process. We had to reconsider the structure of our assets and game logic to support localization and mobile deployment. For example:

Tools and Materials: We introduced Capacitor for mobile packaging and deployment, which was not part of our initial plan.
Localization: Designing for multiple languages forced us to rethink how text was handled in the game, leading to cleaner and more modular code.
Looking forward, these changes provide a solid foundation for future features, such as more advanced feedback systems and expanded localization support. Our team gained experience in cross-platform development and accessibility considerations.

