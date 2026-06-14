import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ITranslationProvider, TranslateResult, DetectResult } from './translation-provider.interface';

@Injectable()
export class DeepLProvider implements ITranslationProvider {
  readonly name = 'DEEPL' as const;
  readonly attribution = 'Translated by DeepL';

  private readonly logger = new Logger(DeepLProvider.name);
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    // API key is NEVER embedded — retrieved from env var only
    this.apiUrl = config.get<string>('DEEPL_API_URL', 'https://api-free.deepl.com/v2');
  }

  private get apiKey(): string {
    const key = this.config.get<string>('DEEPL_API_KEY');
    if (!key) throw new Error('DEEPL_API_KEY env var is not set');
    return key;
  }

  async translate(text: string, _sourceLang: string, targetLang: string): Promise<TranslateResult> {
    const response = await axios.post(
      `${this.apiUrl}/translate`,
      {
        text: [text],
        target_lang: targetLang.toUpperCase(),
      },
      {
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      },
    );

    const translation = response.data?.translations?.[0];
    if (!translation) throw new Error('DeepL returned empty translation');

    return {
      translatedText: translation.text,
      detectedSourceLanguage: translation.detected_source_language?.toLowerCase(),
    };
  }

  async detectLanguage(text: string): Promise<DetectResult> {
    // DeepL detect: translate to EN and read detected_source_language
    const response = await axios.post(
      `${this.apiUrl}/translate`,
      { text: [text.substring(0, 200)], target_lang: 'EN' },
      {
        headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}` },
        timeout: 4000,
      },
    );

    const translation = response.data?.translations?.[0];
    if (!translation) throw new Error('DeepL detection failed');

    return {
      detected_language: translation.detected_source_language?.toLowerCase() ?? 'und',
      confidence: 0.9, // DeepL does not expose confidence; use high default
    };
  }
}