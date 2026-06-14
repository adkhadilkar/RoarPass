import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonalItineraryController } from './controllers/personal-itinerary.controller';
import { GroupTripController } from './controllers/group-trip.controller';
import { CalendarExportController } from './controllers/calendar-export.controller';
import { PersonalItineraryService } from './services/personal-itinerary.service';
import { GroupTripService } from './services/group-trip.service';
import { CalendarExportService } from './services/calendar-export.service';
import { ConflictDetectionService } from './services/conflict-detection.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { PersonalItineraryEntity } from './entities/personal-itinerary.entity';
import { TripItemEntity } from './entities/trip-item.entity';
import { GroupTripEntity } from './entities/group-trip.entity';
import { GroupTripMemberEntity } from './entities/group-trip-member.entity';
import { GroupPollEntity } from './entities/group-poll.entity';
import { PollVoteEntity } from './entities/poll-vote.entity';
import { VoteChoiceEntity } from './entities/vote-choice.entity';
import { GroupTripGateway } from './gateways/group-trip.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersonalItineraryEntity,
      TripItemEntity,
      GroupTripEntity,
      GroupTripMemberEntity,
      GroupPollEntity,
      PollVoteEntity,
      VoteChoiceEntity,
    ]),
  ],
  controllers: [
    PersonalItineraryController,
    GroupTripController,
    CalendarExportController,
  ],
  providers: [
    PersonalItineraryService,
    GroupTripService,
    CalendarExportService,
    ConflictDetectionService,
    OfflineSyncService,
    GroupTripGateway,
  ],
  exports: [
    PersonalItineraryService,
    GroupTripService,
    ConflictDetectionService,
  ],
})
export class TripItineraryModule {}