// src/localizationManager.ts

import Phaser from "phaser";

interface LocalizationData {
  [key: string]: string;
}

export default class LocalizationManager {
  private currentLanguage: string = "en";
  private localizationData: LocalizationData = {};
  private scene: Phaser.Scene;

  private textsToUpdate: Phaser.GameObjects.Text[] = [];
  private localizationCache: Record<string, LocalizationData> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.loadLocalization(this.currentLanguage);
  }

  public async setLanguage(lang: string) {
    if (lang === this.currentLanguage) return;
    await this.loadLocalization(lang);
    this.currentLanguage = lang;
    this.updateAllTexts();
    this.updateTextDirection();
  }

  private async loadLocalization(lang: string) {
    if (this.localizationCache[lang]) {
      this.localizationData = this.localizationCache[lang];
      return;
    }
    try {
      const response = await fetch(`./dist/lang/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load localization file: ${lang}.json`);
      }
      const data = await response.json();
      this.localizationData = data;
      this.localizationCache[lang] = data;
    } catch (error) {
      console.error(error);
    }
  }

  public getString(key: string, variables?: Record<string, any>): string {
    let str = this.localizationData[key] || key;
    if (variables) {
      for (const [varKey, varValue] of Object.entries(variables)) {
        str = str.replace(`{${varKey}}`, varValue);
      }
    }
    return str;
  }

  public registerText(textObject: Phaser.GameObjects.Text, key: string) {
    (textObject as any).localizationKey = key;
    (textObject as any).localizationVariables = {};
    this.textsToUpdate.push(textObject);
    // 设置初始文本
    textObject.setText(this.getString(key, (textObject as any).localizationVariables));
  }

  public updateTextVariables(textObject: Phaser.GameObjects.Text, variables: Record<string, any>) {
    (textObject as any).localizationVariables = variables;
    const key = (textObject as any).localizationKey;
    if (key) {
      textObject.setText(this.getString(key, variables));
    }
  }

  private updateAllTexts() {
    this.textsToUpdate.forEach((textObj) => {
      const key = (textObj as any).localizationKey;
      const variables = (textObj as any).localizationVariables || {};
      if (key) {
        textObj.setText(this.getString(key, variables));
      }
    });
  }

  private updateTextDirection() {
    const rtlLanguages = ["he"]; // Hebrew is RTL
    if (rtlLanguages.includes(this.currentLanguage)) {
      // 设置文本对齐方式为右对齐
      this.textsToUpdate.forEach((textObj) => {
        textObj.setOrigin(1, textObj.originY); // 右对齐
        textObj.setAlign("right");
      });
    } else {
      // 设置为左对齐
      this.textsToUpdate.forEach((textObj) => {
        textObj.setOrigin(0, textObj.originY); // 左对齐
        textObj.setAlign("left");
      });
    }
  }
}
