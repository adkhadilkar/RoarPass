import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  IsNull,
  In,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import {
  TripEntity,
  TripItemEntity,
  TripMemberEntity,
  CommunityTripEntity,
  CommunityTripMemberEntity,
  ItineraryVoteProposalEntity,
  VoteCastEntity,
} from './trip-itinerary.entities';
import {
  CreateTripInput,
  UpdateTripInput,
  CreateTripItemInput,
  UpdateTripItemInput,
  InviteTripMemberInput,
  TripRole,
  CreateCommunityTripInput,
  CreateVoteProposalInput,
  CastVoteInput,
  VoteOption,
} from '@roarpass/shared';

@Injectable()
export class TripItineraryRepository {
  private readonly logger = new Logger(TripItineraryRepository.name);

  constructor(
    @InjectRepository(TripEntity)
    private readonly tripRepo: Repository<TripEntity>,
    @InjectRepository(TripItemEntity)
    private readonly itemRepo: Repository<TripItemEntity>,
    @InjectRepository(TripMemberEntity)
    private readonly memberRepo: Repository<TripMemberEntity>,
    @InjectRepository(CommunityTripEntity)
    private readonly communityTripRepo: Repository<CommunityTripEntity>,
    @InjectRepository(CommunityTripMemberEntity)
    private readonly communityMemberRepo: Repository<CommunityTripMemberEntity>,
    @InjectRepository(ItineraryVoteProposalEntity)
    private readonly proposalRepo: Repository<ItineraryVoteProposalEntity>,
    @InjectRepository(VoteCastEntity)
    private readonly voteRepo: Repository<VoteCastEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------------------
  // Personal Trip CRUD
  // -------------------------------------------------------------------------

  async createTrip(
    ownerId: string,
    input: CreateTripInput,
  ): Promise<TripEntity> {
    const trip = this.tripRepo.create({
      owner_id: ownerId,
      ...input,
    });
    return this.tripRepo.save(trip);
  }

  async findTripById(
    tripId: string,
    includeDeleted = false,
  ): Promise<TripEntity | null> {
    return this.tripRepo.findOne({
      where: {
        trip_id: tripId,
        ...(includeDeleted ? {} : { is_deleted: false }),
      },
    });
  }

  async findTripsByOwner(
    ownerId: string,
    eventId?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ trips: TripEntity[]; total: number }> {
    const where: Record<string, unknown> = {
      owner_id: ownerId,
      is_deleted: false,
    };
    if (eventId) where['event_id'] = eventId;

    const [trips, total] = await this.tripRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { trips, total };
  }

  /**
   * Find trips where user is a member (group trips)
   * Avoids N+1 by using a single JOIN query.
   */
  async findGroupTripsByMember(
    userId: string,
    eventId?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ trips: TripEntity[]; total: number }> {
    const qb = this.tripRepo
      .createQueryBuilder('trip')
      .innerJoin(
        TripMemberEntity,
        'member',
        'member.trip_id = trip.trip_id AND member.user_id = :userId',
        { userId },
      )
      .where('trip.is_deleted = false AND trip.is_group_trip = true');

    if (eventId) {
      qb.andWhere('trip.event_id = :eventId', { eventId });
    }

    const [trips, total] = await qb
      .orderBy('trip.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { trips, total };
  }

  async updateTrip(
    tripId: string,
    input: UpdateTripInput,
  ): Promise<TripEntity | null> {
    await this.tripRepo.update({ trip_id: tripId }, { ...input });
    return this.findTripById(tripId);
  }

  async softDeleteTrip(tripId: string): Promise<void> {
    await this.tripRepo.update({ trip_id: tripId }, { is_deleted: true });
  }

  // -------------------------------------------------------------------------
  // Trip Items — batch load to prevent N+1
  // -------------------------------------------------------------------------

  async createTripItem(
    tripId: string,
    createdBy: string,
    input: CreateTripItemInput,
  ): Promise<TripItemEntity> {
    const item = this.itemRepo.create({
      trip_id: tripId,
      created_by: createdBy,
      ...input,
    });
    return this.itemRepo.save(item);
  }

  async findItemsByTripIds(
    tripIds: string[],
  ): Promise<Map<string, TripItemEntity[]>> {
    if (!tripIds.length) return new Map();

    const items = await this.itemRepo.find({
      where: { trip_id: In(tripIds), is_deleted: false },
      order: { start_time: 'ASC' },
    });

    const map = new Map<string, TripItemEntity[]>();
    for (const item of items) {
      if (!map.has(item.trip_id)) map.set(item.trip_id, []);
      map.get(item.trip_id)!.push(item);
    }
    return map;
  }

  async findItemsByTripId(tripId: string): Promise<TripItemEntity[]> {
    return this.itemRepo.find({
      where: { trip_id: tripId, is_deleted: false },
      order: { start_time: 'ASC' },
    });
  }

  async findItemById(itemId: string): Promise<TripItemEntity | null> {
    return this.itemRepo.findOne({
      where: { item_id: itemId, is_deleted: false },
    });
  }

  async updateTripItem(
    itemId: string,
    input: UpdateTripItemInput,
  ): Promise<TripItemEntity | null> {
    await this.itemRepo.update({ item_id: itemId }, { ...input });
    return this.findItemById(itemId);
  }

  async softDeleteTripItem(itemId: string): Promise<void> {
    await this.itemRepo.update({ item_id: itemId }, { is_deleted: true });
  }

  // -------------------------------------------------------------------------
  // Trip Members
  // -------------------------------------------------------------------------

  async addTripMember(
    tripId: string,
    invitedBy: string,
    input: InviteTripMemberInput,
  ): Promise<TripMemberEntity> {
    const existing = await this.memberRepo.findOne({
      where: { trip_id: tripId, user_id: input.user_id },
    });
    if (existing) {
      // Upsert role
      await this.memberRepo.update(
        { member_id: existing.member_id },
        { role: input.role },
      );
      return { ...existing, role: input.role };
    }

    const member = this.memberRepo.create({
      trip_id: tripId,
      user_id: input.user_id,
      role: input.role,
      invited_by: invitedBy,
    });
    return this.memberRepo.save(member);
  }

  async findTripMember(
    tripId: string,
    userId: string,
  ): Promise<TripMemberEntity | null> {
    return this.memberRepo.findOne({ where: { trip_id: tripId, user_id: userId } });
  }

  async findTripMembers(tripId: string): Promise<TripMemberEntity[]> {
    return this.memberRepo.find({ where: { trip_id: tripId } });
  }

  async removeTripMember(tripId: string, userId: string): Promise<void> {
    await this.memberRepo.delete({ trip_id: tripId, user_id: userId });
  }

  async updateMemberRole(
    tripId: string,
    userId: string,
    role: TripRole,
  ): Promise<void> {
    await this.memberRepo.update({ trip_id: tripId, user_id: userId }, { role });
  }

  // -------------------------------------------------------------------------
  // Community Trips
  // -------------------------------------------------------------------------

  async createCommunityTrip(
    ownerId: string,
    input: CreateCommunityTripInput,
    chatChannelId?: string,
  ): Promise<CommunityTripEntity> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      const trip = em.create(CommunityTripEntity, {
        owner_id: ownerId,
        chat_channel_id: chatChannelId ?? null,
        participant_count: 1,
        ...input,
      });
      const saved = await em.save(trip);

      // Auto-add owner as OWNER member
      const member = em.create(CommunityTripMemberEntity, {
        community_trip_id: saved.community_trip_id,
        user_id: ownerId,
        role: 'OWNER',
      });
      await em.save(member);

      return saved;
    });
  }

  async findCommunityTripById(
    communityTripId: string,
  ): Promise<CommunityTripEntity | null> {
    return this.communityTripRepo.findOne({
      where: { community_trip_id: communityTripId, is_deleted: false },
    });
  }

  async findCommunityTripsByEvent(
    eventId: string,
    communityId?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ trips: CommunityTripEntity[]; total: number }> {
    const where: Record<string, unknown> = { event_id: eventId, is_deleted: false };
    if (communityId) where['community_id'] = communityId;

    const [trips, total] = await this.communityTripRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { trips, total };
  }

  async joinCommunityTrip(
    communityTripId: string,
    userId: string,
  ): Promise<CommunityTripMemberEntity> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      const trip = await em.findOne(CommunityTripEntity, {
        where: { community_trip_id: communityTripId, is_deleted: false },
        lock: { mode: 'pessimistic_write' },
      });

      if (!trip) throw new Error('COMMUNITY_TRIP_NOT_FOUND');
      if (!trip.is_open) throw new Error('COMMUNITY_TRIP_CLOSED');
      if (trip.max_participants && trip.participant_count >= trip.max_participants) {
        throw new Error('COMMUNITY_TRIP_FULL');
      }

      const existing = await em.findOne(CommunityTripMemberEntity, {
        where: { community_trip_id: communityTripId, user_id: userId },
      });
      if (existing) return existing;

      const member = em.create(CommunityTripMemberEntity, {
        community_trip_id: communityTripId,
        user_id: userId,
        role: 'VIEWER',
      });
      const saved = await em.save(member);
      await em.update(
        CommunityTripEntity,
        { community_trip_id: communityTripId },
        { participant_count: () => 'participant_count + 1' },
      );
      return saved;
    });
  }

  async leaveCommunityTrip(
    communityTripId: string,
    userId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (em: EntityManager) => {
      await em.delete(CommunityTripMemberEntity, {
        community_trip_id: communityTripId,
        user_id: userId,
      });
      await em.update(
        CommunityTripEntity,
        { community_trip_id: communityTripId },
        { participant_count: () => 'GREATEST(participant_count - 1, 0)' },
      );
    });
  }

  async findCommunityTripMember(
    communityTripId: string,
    userId: string,
  ): Promise<CommunityTripMemberEntity | null> {
    return this.communityMemberRepo.findOne({
      where: { community_trip_id: communityTripId, user_id: userId },
    });
  }

  async findCommunityTripMembers(
    communityTripId: string,
  ): Promise<CommunityTripMemberEntity[]> {
    return this.communityMemberRepo.find({
      where: { community_trip_id: communityTripId },
    });
  }

  async updateCommunityTripMemberRole(
    communityTripId: string,
    userId: string,
    role: TripRole,
  ): Promise<void> {
    await this.communityMemberRepo.update(
      { community_trip_id: communityTripId, user_id: userId },
      { role },
    );
  }

  // -------------------------------------------------------------------------
  // Vote Proposals
  // -------------------------------------------------------------------------

  async createVoteProposal(
    tripId: string,
    proposedBy: string,
    input: CreateVoteProposalInput,
  ): Promise<ItineraryVoteProposalEntity> {
    const proposal = this.proposalRepo.create({
      trip_id: tripId,
      proposed_by: proposedBy,
      ...input,
    });
    return this.proposalRepo.save(proposal);
  }

  async findProposalById(
    proposalId: string,
  ): Promise<ItineraryVoteProposalEntity | null> {
    return this.proposalRepo.findOne({ where: { proposal_id: proposalId } });
  }

  async findProposalsByTrip(
    tripId: string,
  ): Promise<ItineraryVoteProposalEntity[]> {
    return this.proposalRepo.find({
      where: { trip_id: tripId },
      order: { created_at: 'DESC' },
    });
  }

  async castVote(
    proposalId: string,
    userId: string,
    input: CastVoteInput,
  ): Promise<VoteCastEntity> {
    return this.dataSource.transaction(async (em: EntityManager) => {
      // Upsert vote
      const existing = await em.findOne(VoteCastEntity, {
        where: { proposal_id: proposalId, user_id: userId },
      });

      if (existing) {
        // Decrement old vote counter
        await em.update(
          ItineraryVoteProposalEntity,
          { proposal_id: proposalId },
          { [`${existing.vote.toLowerCase()}_count`]: () => `${existing.vote.toLowerCase()}_count - 1` },
        );
        await em.update(
          VoteCastEntity,
          { vote_id: existing.vote_id },
          { vote: input.vote, comment: input.comment ?? null },
        );
        await em.update(
          ItineraryVoteProposalEntity,
          { proposal_id: proposalId },
          { [`${input.vote.toLowerCase()}_count`]: () => `${input.vote.toLowerCase()}_count + 1` },
        );
        return { ...existing, vote: input.vote, comment: input.comment ?? null };
      }

      const vote = em.create(VoteCastEntity, {
        proposal_id: proposalId,
        user_id: userId,
        vote: input.vote,
        comment: input.comment ?? null,
      });
      const saved = await em.save(vote);
      await em.update(
        ItineraryVoteProposalEntity,
        { proposal_id: proposalId },
        { [`${input.vote.toLowerCase()}_count`]: () => `${input.vote.toLowerCase()}_count + 1` },
      );
      return saved;
    });
  }

  async resolveProposal(
    proposalId: string,
    resolution: 'APPROVED' | 'REJECTED' | 'EXPIRED',
  ): Promise<void> {
    await this.proposalRepo.update(
      { proposal_id: proposalId },
      { is_resolved: true, resolution },
    );
  }

  async findExpiredOpenProposals(): Promise<ItineraryVoteProposalEntity[]> {
    return this.proposalRepo.find({
      where: {
        is_resolved: false,
        closes_at: LessThanOrEqual(new Date().toISOString()),
      },
    });
  }
}