import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { TranslationProvider } from '@roarpass/shared';

const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

interface CacheEntry {
  cache_id: string;
  message_id: string;
  target_language: string;
  translated_text: string;
  provider: TranslationProvider;
  provider_attribution: string;
  created_at: string;
  expires_at: string;
}

@Injectable()
export class TranslationCacheService {
  private readonly logger = new Logger(TranslationCacheService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private cacheKey(messageId: string, targetLang: string): string {
    // Opaque key — no message content exposed (REQ-SEC)
    return `trans:v1:${messageId}:${targetLang}`;
  }

  private indexKey(messageId: string): string {
    return `trans:idx:${messageId}`;
  }

  async get(messageId: string, targetLang: string): Promise<CacheEntry | null> {
    const key = this.cacheKey(messageId, targetLang);
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as CacheEntry;
    } catch (err) {
      this.logger.error(`Cache get error for ${key}: ${err}`);
      return null;
    }
  }

  async set(
    messageId: string,
    targetLang: string,
    translatedText: string,
    provider: TranslationProvider,
    attribution: string,
  ): Promise<void> {
    const key = this.cacheKey(messageId, targetLang);
    const indexKey = this.indexKey(messageId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_SECONDS * 1000);

    const entry: CacheEntry = {
      cache_id: uuidv4(),
      message_id: messageId,
      target_language: targetLang,
      translated_text: translatedText,
      provider,
      provider_attribution: attribution,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    const pipeline = this.redis.pipeline();
    // Cache entry
    pipeline.setex(key, CACHE_TTL_SECONDS, JSON.stringify(entry));
    // Index entry for purge-by-message-id (GDPR right to erasure)
    pipeline.sadd(indexKey, targetLang);
    pipeline.expire(indexKey, CACHE_TTL_SECONDS);
    await pipeline.exec();
  }

  /** Purge all translations for a deleted message (GDPR, REQ-TRANS-07) */
  async purgeByMessageId(messageId: string): Promise<void> {
    const indexKey = this.indexKey(messageId);
    const langs = await this.redis.smembers(indexKey);

    const pipeline = this.redis.pipeline();
    for (const lang of langs) {
      pipeline.del(this.cacheKey(messageId, lang));
    }
    pipeline.del(indexKey);
    await pipeline.exec();

    this.logger.log(`Purged ${langs.length} cache entries for message ${messageId}`);
  }

  /**
   * Cache stampede prevention: only one caller translates on miss,
   * others wait on a lock key briefly before retry.
   */
  async acquireTranslateLock(messageId: string, targetLang: string): Promise<boolean> {
    const lockKey = `trans:lock:${messageId}:${targetLang}`;
    // SET NX EX — atomic
    const result = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');
    return result === 'OK';
  }

  async releaseTranslateLock(messageId: string, targetLang: string): Promise<void> {
    const lockKey = `trans:lock:${messageId}:${targetLang}`;
    await this.redis.del(lockKey);
  }
}