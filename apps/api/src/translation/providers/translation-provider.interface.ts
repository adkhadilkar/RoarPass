import { TranslationProvider } from '@roarpass/shared';

export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

export interface DetectResult {
  detected_language: string;
  confidence: number;
}

export interface ITranslationProvider {
  readonly name: TranslationProvider;
  readonly attribution: string;
  translate(text: string, sourceLang: string, targetLang: string): Promise<TranslateResult>;
  detectLanguage(text: string): Promise<DetectResult>;
}