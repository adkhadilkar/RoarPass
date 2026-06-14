import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { CommunityEntity } from './entities/community.entity';
import { CommunityChannelEntity } from './entities/community-channel.entity';
import { CommunityMemberEntity } from './entities/community-member.entity';
import { AffinityTagEntity } from './entities/affinity-tag.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityEntity,
      CommunityChannelEntity,
      CommunityMemberEntity,
      AffinityTagEntity,
    ]),
  ],
  controllers: [
    CommunitiesController,
    ChannelsController,
    MembershipsController,
  ],
  providers: [CommunitiesService, ChannelsService, MembershipsService],
  exports: [CommunitiesService, ChannelsService, MembershipsService],
})
export class CommunitiesModule {}