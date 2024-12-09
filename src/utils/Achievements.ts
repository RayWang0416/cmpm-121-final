export default class AchievementsManager {
    private scene: Phaser.Scene;
    private achievements: string[] = [];
    private achievementsText: Phaser.GameObjects.Text;
  
    constructor(scene: Phaser.Scene) {
      this.scene = scene;
      this.achievementsText = this.scene.add.text(10, 250, "Achievements:\n", {
        font: "16px Arial",
        color: "#ffffff",
      });
    }
  
    // Check and unlock achievements based on thresholds
    checkAndUpdate(type: "potato" | "carrot" | "cabbage", count: number): void {
      const thresholds = [
        { count: 10, title: `${type} master` },
        { count: 15, title: `${type} god` },
        { count: 20, title: `${type} legend` },
      ];
  
      thresholds.forEach((threshold) => {
        if (count >= threshold.count && !this.achievements.includes(threshold.title)) {
          this.achievements.push(threshold.title);
          this.displayAchievement(threshold.title);
        }
      });
  
      this.updateAchievementsDisplay();
    }
  
    // Display an achievement popup
    private displayAchievement(title: string): void {
      const popup = this.scene.add.text(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height / 2,
        `Achievement Unlocked!\n${title}`,
        {
          font: "20px Arial",
          color: "#ffffff",
          backgroundColor: "#000000",
          padding: { left: 10, right: 10, top: 5, bottom: 5 },
        }
      );
      popup.setOrigin(0.5, 0.5);
  
      this.scene.time.delayedCall(2000, () => {
        popup.destroy();
      });
    }
  
    // Update the achievements display
    private updateAchievementsDisplay(): void {
      this.achievementsText.setText(
        `Achievements:\n${this.achievements.join("\n")}`
      );
    }
  }
  