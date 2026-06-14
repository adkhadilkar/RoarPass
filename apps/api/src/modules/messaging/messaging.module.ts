import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ChannelController } from './controllers/channel.controller';
import { MessageController } from './controllers/message.controller';
import { VoiceNoteController } from './controllers/voice-note.controller';
import { E2EKeyController } from './controllers/e2e-key.controller';
import { ChannelService } from './services/channel.service';
import { MessageService } from './services/message.service';
import { VoiceNoteService } from './services/voice-note.service';
import { PresenceService } from './services/presence.service';
import { E2EEncryptionService } from './services/e2e-encryption.service';
import { MessagingGateway } from './gateways/messaging.gateway';
import { Channel } from './entities/channel.entity';
import { Message } from './entities/message.entity';
import { ChannelParticipant } from './entities/channel-participant.entity';
import { VoiceNote } from './entities/voice-note.entity';
import { E2EPublicKeyBundle } from './entities/e2e-public-key-bundle.entity';
import { MessageTranslationMeta } from './entities/message-translation-meta.entity';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Channel,
      Message,
      ChannelParticipant,
      VoiceNote,
      E2EPublicKeyBundle,
      MessageTranslationMeta,
    ]),
    BullModule.registerQueue(
      { name: 'voice-transcription' },
      { name: 'translation-detect' },
    ),
    AuthModule,
    StorageModule,
  ],
  controllers: [
    ChannelController,
    MessageController,
    VoiceNoteController,
    E2EKeyController,
  ],
  providers: [
    ChannelService,
    MessageService,
    VoiceNoteService,
    PresenceService,
    E2EEncryptionService,
    MessagingGateway,
  ],
  exports: [ChannelService, MessageService],
})
export class MessagingModule {}