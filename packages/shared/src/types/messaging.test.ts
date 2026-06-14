import { describe, it, expect } from 'vitest';
import {
  MessageSchema,
  ChannelSchema,
  SendMessageRequestSchema,
  CreateChannelRequestSchema,
  WSEventSchema,
  ChannelTypeSchema,
} from './messaging';

describe('MessageSchema', () => {
  const base = {
    message_id: '11111111-1111-1111-1111-111111111111',
    channel_id: '22222222-2222-2222-2222-222222222222',
    thread_id: null,
    sender_id: '33333333-3333-3333-3333-333333333333',
    message_type: 'TEXT' as const,
    channel_type: 'DIRECT_MESSAGE' as const,
    content: 'Hello!',
    is_official: false,
    is_deleted: false,
    voice_note_url: null,
    voice_note_duration_seconds: null,
    voice_transcription: null,
    transcription_status: 'NONE' as const,
    detected_language: null,
    detection_confidence: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    read_by: {},
  };

  it('parses valid message', () => {
    expect(() => MessageSchema.parse(base)).not.toThrow();
  });

  it('rejects content exceeding 10000 chars', () => {
    expect(() =>
      MessageSchema.parse({ ...base, content: 'x'.repeat(10_001) })
    ).toThrow();
  });

  it('rejects invalid detection_confidence > 1', () => {
    expect(() =>
      MessageSchema.parse({ ...base, detection_confidence: 1.5 })
    ).toThrow();
  });

  it('accepts voice note fields', () => {
    const msg = MessageSchema.parse({
      ...base,
      message_type: 'VOICE_NOTE',
      voice_note_url: 'https://cdn.example.com/audio.mp3',
      voice_note_duration_seconds: 30,
      transcription_status: 'PENDING',
    });
    expect(msg.message_type).toBe('VOICE_NOTE');
  });
});

describe('SendMessageRequestSchema', () => {
  it('rejects empty content', () => {
    expect(() =>
      SendMessageRequestSchema.parse({ channel_id: '11111111-1111-1111-1111-111111111111', content: '' })
    ).toThrow();
  });

  it('rejects voice_note_duration_seconds > 300', () => {
    expect(() =>
      SendMessageRequestSchema.parse({
        channel_id: '11111111-1111-1111-1111-111111111111',
        content: 'Voice',
        voice_note_duration_seconds: 301,
      })
    ).toThrow();
  });
});

describe('ChannelTypeSchema', () => {
  it('accepts all valid types', () => {
    const types = ['DIRECT_MESSAGE', 'GROUP_CHAT', 'COMMUNITY_CHANNEL', 'MATCH_DAY_LIVE', 'ANNOUNCEMENT'];
    types.forEach((t) => expect(() => ChannelTypeSchema.parse(t)).not.toThrow());
  });
});

describe('WSEventSchema', () => {
  it('parses MESSAGE_NEW', () => {
    const event = {
      type: 'MESSAGE_NEW',
      channel_id: '22222222-2222-2222-2222-222222222222',
      message: {
        message_id: '11111111-1111-1111-1111-111111111111',
        channel_id: '22222222-2222-2222-2222-222222222222',
        thread_id: null,
        sender_id: '33333333-3333-3333-3333-333333333333',
        message_type: 'TEXT',
        channel_type: 'DIRECT_MESSAGE',
        content: 'Hey',
        is_official: false,
        is_deleted: false,
        voice_note_url: null,
        voice_note_duration_seconds: null,
        voice_transcription: null,
        transcription_status: 'NONE',
        detected_language: null,
        detection_confidence: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        read_by: {},
      },
    };
    expect(() => WSEventSchema.parse(event)).not.toThrow();
  });
});