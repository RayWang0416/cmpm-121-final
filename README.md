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


## How we satisfied the software requirements

### F0
- f0.a: The player can control a yellow square as the character, using arrow keys to move over a 5*5 2D grid.
- f0.b: The player can clicked the 'next day' button to start the next day. For each day, the player has 10 actions(Plant or Harvest will use an action).
- f0.c: When the player steps on a grid, then the grid the highlighted and he can interact with that grid.
- f0.d: The grid will show it's sun and water level. For each day the sun and water will randomly generated. The sun level will can not accumulate, but the water level can.(Sun: 0-100, Water(Current level + 0-30).
- f0.e: There is 3 crops, potato, carrot, and cabbage. Each of them has 3 growth level.
- f0.f: If the sun and water level of current grid fit the requirement of growth, the plant will grow, upgrade to next level.
- f0.g: The player will unlock achievements if he get a decent number of crops.

## Reflection
We found that Phaser is enough for our needs, so there is no big changes. However, we somehow changed our roles. Hengyang Ye did the overall design of the game, and I Implement most of the code.
