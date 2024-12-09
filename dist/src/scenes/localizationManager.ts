import en from './en.json';
import he from './he.json';
import zh from './zh.json';

type Locale = 'en' | 'he' | 'zh';

class LocalizationManager {
  private static instance: LocalizationManager;
  private locale: Locale = 'en';
  private translations: Record<string, string> = {};

  private constructor() {
    this.loadLocale(this.locale);
  }

  public static getInstance(): LocalizationManager {
    if (!LocalizationManager.instance) {
      LocalizationManager.instance = new LocalizationManager();
    }
    return LocalizationManager.instance;
  }

  public setLocale(locale: Locale) {
    this.locale = locale;
    this.loadLocale(locale);
  }

  public getLocale(): Locale {
    return this.locale;
  }

  private loadLocale(locale: Locale) {
    switch (locale) {
      case 'en':
        this.translations = en;
        break;
      case 'he':
        this.translations = he;
        break;
      case 'zh':
        this.translations = zh;
        break;
      default:
        this.translations = zh;
    }
  }

  public translate(key: string, variables?: Record<string, any>): string {
    let text = this.translations[key] || key;
    if (variables) {
      for (const [varKey, varValue] of Object.entries(variables)) {
        text = text.replace(`{${varKey}}`, String(varValue));
      }
    }
    return text;
  }
}

export default LocalizationManager;
