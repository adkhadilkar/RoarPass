import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { MessagingGateway } from './messaging.gateway';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { VoiceNoteService } from './voice-note.service';
import { ChannelEntity } from './entities/channel.entity';
import { MessageEntity } from './entities/message.entity';
import { ChannelMemberEntity } from './entities/channel-member.entity';
import { VoiceTranscriptionProcessor } from './processors/voice-transcription.processor';
import { LanguageDetectionProcessor } from './processors/language-detection.processor';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelEntity, MessageEntity, ChannelMemberEntity]),
    BullModule.registerQueue(
      { name: 'voice-transcription' },
      { name: 'language-detection' },
    ),
    AuthModule,
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    VoiceNoteService,
    MessagingGateway,
    VoiceTranscriptionProcessor,
    LanguageDetectionProcessor,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}