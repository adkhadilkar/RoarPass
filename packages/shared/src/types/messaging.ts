import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ChannelType {
  DIRECT_MESSAGE = 'DIRECT_MESSAGE',
  GROUP_CHAT = 'GROUP_CHAT',
  COMMUNITY_CHANNEL = 'COMMUNITY_CHANNEL',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  MATCH_DAY_LIVE = 'MATCH_DAY_LIVE',
}

export enum MessageType {
  TEXT = 'TEXT',
  VOICE_NOTE = 'VOICE_NOTE',
  SYSTEM = 'SYSTEM',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

export enum MessageStatus {
  SENDING = 'SENDING',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

export enum ParticipantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
  READONLY = 'READONLY',
}

export enum VoiceNoteStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
}

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Channel {
  id: string;
  type: ChannelType;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  isArchived: boolean;
  isReadOnly: boolean; // for ANNOUNCEMENT channels
  metadata: ChannelMetadata;
  participantCount: number;
  unreadCount?: number;
  lastMessage?: MessageSummary;
}

export interface ChannelMetadata {
  // For COMMUNITY_CHANNEL
  communityId?: string;
  countryCode?: string;
  communityDefaultLanguage?: string;
  // For MATCH_DAY_LIVE
  matchId?: string;
  eventId?: string;
  matchKickoffAt?: string;
  matchEndAt?: string;
  // For GROUP_CHAT
  groupName?: string;
  tripId?: string;
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
  type: MessageType;
  status: MessageStatus;
  content: string | null; // null for VOICE_NOTE until transcription
  encryptedContent: string | null; // for DM E2E encryption
  isEncrypted: boolean;
  isOfficial: boolean; // moderator announcement — suppresses translation
  isEdited: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  threadParentId: string | null; // for threaded replies
  replyCount: number;
  reactions: MessageReaction[];
  voiceNote: VoiceNoteAttachment | null;
  translationMetadata: MessageTranslationMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageSummary {
  id: string;
  senderId: string;
  senderDisplayName: string;
  type: MessageType;
  content: string | null;
  createdAt: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[]; // trimmed to first 3 for preview + "and N more"
  reactedByMe: boolean;
}

export interface VoiceNoteAttachment {
  id: string;
  messageId: string;
  audioUrl: string;
  durationSeconds: number;
  waveformData: number[]; // amplitude samples for visualization
  transcription: string | null;
  transcriptionLanguage: string | null; // ISO 639-1
  status: VoiceNoteStatus;
  createdAt: string;
}

export interface MessageTranslationMetadata {
  messageId: string;
  detectedLanguage: string | null; // ISO 639-1
  detectionConfidence: number | null; // 0-1
  isOfficial: boolean;
  detectedAt: string | null;
}

export interface ChannelParticipant {
  channelId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: ParticipantRole;
  joinedAt: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
  isMuted: boolean;
  notificationsEnabled: boolean;
}

export interface ChannelMembership {
  channelId: string;
  userId: string;
  role: ParticipantRole;
  joinedAt: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
  isMuted: boolean;
  notificationsEnabled: boolean;
}

// ─── Request/Response DTOs ────────────────────────────────────────────────────

export interface CreateDirectMessageChannelRequest {
  recipientUserId: string;
}

export interface CreateGroupChatRequest {
  name: string;
  participantUserIds: string[]; // max 50
  tripId?: string;
}

export interface SendMessageRequest {
  content?: string;
  type: MessageType;
  threadParentId?: string;
  isOfficial?: boolean; // moderators only
  clientMessageId?: string; // idempotency key
}

export interface SendVoiceNoteRequest {
  audioBase64: string; // max 5 MB
  durationSeconds: number;
  mimeType: 'audio/ogg' | 'audio/mp4' | 'audio/webm';
}

export interface EditMessageRequest {
  content: string;
}

export interface UpdateMembershipRequest {
  isMuted?: boolean;
  notificationsEnabled?: boolean;
}

export interface UpdateParticipantRoleRequest {
  role: ParticipantRole;
}

export interface MarkReadRequest {
  messageId: string; // last read message
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
  prevCursor: string | null;
  total: number;
}

export interface ChannelPage {
  channels: Channel[];
  nextCursor: string | null;
  total: number;
}

export interface ThreadPage {
  parentMessage: Message;
  replies: Message[];
  nextCursor: string | null;
  total: number;
}

// ─── Real-Time WebSocket Events ───────────────────────────────────────────────

export enum WSEventType {
  // Client → Server
  JOIN_CHANNEL = 'JOIN_CHANNEL',
  LEAVE_CHANNEL = 'LEAVE_CHANNEL',
  TYPING_START = 'TYPING_START',
  TYPING_STOP = 'TYPING_STOP',
  MARK_READ = 'MARK_READ',
  // Server → Client
  MESSAGE_NEW = 'MESSAGE_NEW',
  MESSAGE_UPDATED = 'MESSAGE_UPDATED',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  REACTION_UPDATED = 'REACTION_UPDATED',
  CHANNEL_UPDATED = 'CHANNEL_UPDATED',
  PARTICIPANT_JOINED = 'PARTICIPANT_JOINED',
  PARTICIPANT_LEFT = 'PARTICIPANT_LEFT',
  TYPING_INDICATOR = 'TYPING_INDICATOR',
  UNREAD_COUNT_UPDATED = 'UNREAD_COUNT_UPDATED',
  VOICE_NOTE_READY = 'VOICE_NOTE_READY',
  ERROR = 'ERROR',
  CONNECTED = 'CONNECTED',
}

export interface WSMessage<T = unknown> {
  event: WSEventType;
  channelId?: string;
  payload: T;
  timestamp: string;
}

export interface TypingIndicatorPayload {
  userId: string;
  displayName: string;
  channelId: string;
  isTyping: boolean;
}

export interface UnreadCountPayload {
  channelId: string;
  unreadCount: number;
  mentionCount: number;
}

// ─── Encryption Types (E2E for DMs) ──────────────────────────────────────────

export interface E2EPublicKeyBundle {
  userId: string;
  identityKey: string; // base64 X25519 public key
  signedPreKey: string;
  signedPreKeySignature: string;
  oneTimePreKeys: string[];
  updatedAt: string;
}

export interface EncryptedMessageEnvelope {
  recipientUserId: string;
  ciphertext: string; // base64
  ephemeralKey: string; // base64
  mac: string; // base64 HMAC-SHA256
}

// ─── Zod Validation Schemas ───────────────────────────────────────────────────

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  type: z.nativeEnum(MessageType),
  threadParentId: z.string().uuid().optional(),
  isOfficial: z.boolean().optional(),
  clientMessageId: z.string().uuid().optional(),
});

export const SendVoiceNoteSchema = z.object({
  audioBase64: z.string().max(7_000_000), // ~5 MB base64
  durationSeconds: z.number().min(0.5).max(300),
  mimeType: z.enum(['audio/ogg', 'audio/mp4', 'audio/webm']),
});

export const CreateGroupChatSchema = z.object({
  name: z.string().min(1).max(100),
  participantUserIds: z.array(z.string().uuid()).min(1).max(49),
  tripId: z.string().uuid().optional(),
});

export const CreateDMSchema = z.object({
  recipientUserId: z.string().uuid(),
});

export const EditMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const MarkReadSchema = z.object({
  messageId: z.string().uuid(),
});