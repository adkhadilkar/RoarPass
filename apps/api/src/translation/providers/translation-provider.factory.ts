import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepLProvider } from './deepl.provider';
import { GoogleTranslateProvider } from './google-translate.provider';
import { ITranslationProvider } from './translation-provider.interface';

@Injectable()
export class TranslationProviderFactory {
  private readonly providers: ITranslationProvider[];

  constructor(
    private readonly deepl: DeepLProvider,
    private readonly google: GoogleTranslateProvider,
    private readonly config: ConfigService,
  ) {
    // Order defines fallback chain: DeepL → Google (REQ-TRANS NFR 7.7)
    this.providers = [this.deepl, this.google];
  }

  getPrimary(): ITranslationProvider {
    return this.providers[0];
  }

  getOrderedProviders(): ITranslationProvider[] {
    return this.providers;
  }
}