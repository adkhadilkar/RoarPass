import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ITranslationProvider, TranslateResult, DetectResult } from './translation-provider.interface';

@Injectable()
export class GoogleTranslateProvider implements ITranslationProvider {
  readonly name = 'GOOGLE' as const;
  readonly attribution = 'Translated by Google';

  private readonly logger = new Logger(GoogleTranslateProvider.name);
  private readonly apiUrl = 'https://translation.googleapis.com/language/translate/v2';

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string {
    const key = this.config.get<string>('GOOGLE_TRANSLATE_API_KEY');
    if (!key) throw new Error('GOOGLE_TRANSLATE_API_KEY env var is not set');
    return key;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<TranslateResult> {
    const response = await axios.post(
      `${this.apiUrl}?key=${this.apiKey}`,
      { q: text, source: sourceLang, target: targetLang, format: 'text' },
      { timeout: 8000 },
    );

    const translated = response.data?.data?.translations?.[0]?.translatedText;
    if (!translated) throw new Error('Google Translate returned empty result');

    return { translatedText: translated };
  }

  async detectLanguage(text: string): Promise<DetectResult> {
    const response = await axios.post(
      `${this.apiUrl}/detect?key=${this.apiKey}`,
      { q: text.substring(0, 200) },
      { timeout: 4000 },
    );

    const detection = response.data?.data?.detections?.[0]?.[0];
    if (!detection) throw new Error('Google detection failed');

    return {
      detected_language: detection.language,
      confidence: detection.confidence ?? 0.5,
    };
  }
}