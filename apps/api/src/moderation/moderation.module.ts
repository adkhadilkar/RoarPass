import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { AutoModerationService } from './auto-moderation.service';
import { AuditLogService } from './audit-log.service';
import { ContentReportEntity } from './entities/content-report.entity';
import { ModerationDecisionEntity } from './entities/moderation-decision.entity';
import { ModeratorAssignmentEntity } from './entities/moderator-assignment.entity';
import { CommunityGuideEntity } from './entities/community-guide.entity';
import { CommunityAnnouncementEntity } from './entities/community-announcement.entity';
import { AutoModRuleEntity } from './entities/auto-mod-rule.entity';
import { AutoModLogEntity } from './entities/auto-mod-log.entity';
import { BlockRelationshipEntity } from './entities/block-relationship.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentReportEntity,
      ModerationDecisionEntity,
      ModeratorAssignmentEntity,
      CommunityGuideEntity,
      CommunityAnnouncementEntity,
      AutoModRuleEntity,
      AutoModLogEntity,
      BlockRelationshipEntity,
      AuditLogEntity,
    ]),
    NotificationsModule,
  ],
  controllers: [ModerationController],
  providers: [ModerationService, AutoModerationService, AuditLogService],
  exports: [ModerationService, AutoModerationService, AuditLogService],
})
export class ModerationModule {}