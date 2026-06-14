import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AssistantSessionEntity } from './entities/assistant-session.entity';
import { AssistantTurnEntity } from './entities/assistant-turn.entity';
import { AssistantFeedbackEntity } from './entities/assistant-feedback.entity';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ContextAssemblerService } from './context-assembler.service';
import { AiGatewayService } from './ai-gateway.service';
import { ContentSafetyService } from './content-safety.service';
import { PremiumGuard } from './guards/premium.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssistantSessionEntity,
      AssistantTurnEntity,
      AssistantFeedbackEntity,
    ]),
    ThrottlerModule.forRoot([
      {
        name: 'assistant',
        ttl: 3600_000, // 1 hour in ms
        limit: 100,
      },
    ]),
  ],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    ContextAssemblerService,
    AiGatewayService,
    ContentSafetyService,
    PremiumGuard,
    RateLimitGuard,
  ],
  exports: [AssistantService],
})
export class AiAssistantModule {}