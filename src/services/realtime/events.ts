/**
 * Shared realtime event contract.
 * Conflict resolution: main defined presence events; incoming branch defined
 * messaging events in a duplicate `events.ts`. Unified into one enum + payload
 * map so both handler groups type-check against a single source of truth.
 */
export enum RealtimeEvent {
  // Presence (from main)
  PresenceUpdate = 'presence:update',
  PresenceSync = 'presence:sync',
  // Messaging (incoming chunk)
  MessageSend = 'message:send',
  MessageNew = 'message:new',
  MessageRead = 'message:read',
  MessageError = 'message:error',
  TypingStart = 'typing:start',
  TypingStop = 'typing:stop',
}

export interface MessageSendPayload {
  conversationId: string;
  body: string;
  clientMessageId: string;
}

export interface MessageNewPayload {
  conversationId: string;
  messageId: string;
  senderFanProfileId: string;
  body: string;
  createdAt: string;
}

export interface MessageReadPayload {
  conversationId: string;
  lastReadMessageId: string;
}

export interface TypingPayload {
  conversationId: string;
  fanProfileId: string;
}

export interface PresenceUpdatePayload {
  fanProfileId: string;
  status: 'online' | 'away' | 'offline';
  lastSeenAt: string;
}