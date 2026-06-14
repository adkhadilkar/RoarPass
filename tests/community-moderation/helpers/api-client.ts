import axios, { AxiosInstance, AxiosResponse } from 'axios';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

export type TokenEnvKey =
  | 'TEST_ADMIN_TOKEN'
  | 'TEST_MOD_TOKEN'
  | 'TEST_MOD2_TOKEN'
  | 'TEST_MEMBER_TOKEN'
  | 'TEST_HELPER_TOKEN'
  | 'TEST_ANON_TOKEN';

function getToken(key: TokenEnvKey): string {
  const t = process.env[key];
  if (!t) throw new Error(`Env var ${key} is not set`);
  return t;
}

export function createClient(tokenKey: TokenEnvKey): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${getToken(tokenKey)}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US',
    },
    validateStatus: () => true, // never throw on HTTP errors — let tests assert
  });
  return client;
}

export function createUnauthenticatedClient(): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
  });
}

// Typed wrappers for common RoarPass endpoints

export const API = {
  // Communities
  getCommunity: (client: AxiosInstance, communityId: string) =>
    client.get(`/v1/communities/${communityId}`),

  // Moderator roles
  assignModerator: (client: AxiosInstance, communityId: string, userId: string) =>
    client.post(`/v1/communities/${communityId}/moderators`, { user_id: userId }),

  removeModerator: (client: AxiosInstance, communityId: string, userId: string) =>
    client.delete(`/v1/communities/${communityId}/moderators/${userId}`),

  getModeratorList: (client: AxiosInstance, communityId: string) =>
    client.get(`/v1/communities/${communityId}/moderators`),

  // Posts
  createPost: (client: AxiosInstance, communityId: string, payload: object) =>
    client.post(`/v1/communities/${communityId}/posts`, payload),

  getPost: (client: AxiosInstance, communityId: string, postId: string) =>
    client.get(`/v1/communities/${communityId}/posts/${postId}`),

  deletePost: (client: AxiosInstance, communityId: string, postId: string) =>
    client.delete(`/v1/communities/${communityId}/posts/${postId}`),

  editPost: (client: AxiosInstance, communityId: string, postId: string, payload: object) =>
    client.patch(`/v1/communities/${communityId}/posts/${postId}`, payload),

  // Pinned guides & announcements
  pinPost: (client: AxiosInstance, communityId: string, postId: string) =>
    client.post(`/v1/communities/${communityId}/posts/${postId}/pin`),

  unpinPost: (client: AxiosInstance, communityId: string, postId: string) =>
    client.delete(`/v1/communities/${communityId}/posts/${postId}/pin`),

  createAnnouncement: (client: AxiosInstance, communityId: string, payload: object) =>
    client.post(`/v1/communities/${communityId}/announcements`, payload),

  listPinnedPosts: (client: AxiosInstance, communityId: string) =>
    client.get(`/v1/communities/${communityId}/posts?type=pinned_guide`),

  listAnnouncements: (client: AxiosInstance, communityId: string) =>
    client.get(`/v1/communities/${communityId}/announcements`),

  // Reporting & blocking
  reportPost: (client: AxiosInstance, communityId: string, postId: string, payload: object) =>
    client.post(`/v1/communities/${communityId}/posts/${postId}/reports`, payload),

  reportUser: (client: AxiosInstance, targetUserId: string, payload: object) =>
    client.post(`/v1/users/${targetUserId}/reports`, payload),

  blockUser: (client: AxiosInstance, targetUserId: string) =>
    client.post(`/v1/users/${targetUserId}/block`),

  unblockUser: (client: AxiosInstance, targetUserId: string) =>
    client.delete(`/v1/users/${targetUserId}/block`),

  getBlockedUsers: (client: AxiosInstance) =>
    client.get('/v1/users/me/blocked'),

  // Moderation queue
  getModerationQueue: (client: AxiosInstance, communityId: string, params?: object) =>
    client.get(`/v1/communities/${communityId}/moderation/queue`, { params }),

  getModerationQueueItem: (client: AxiosInstance, communityId: string, itemId: string) =>
    client.get(`/v1/communities/${communityId}/moderation/queue/${itemId}`),

  resolveQueueItem: (
    client: AxiosInstance,
    communityId: string,
    itemId: string,
    payload: object,
  ) => client.post(`/v1/communities/${communityId}/moderation/queue/${itemId}/resolve`, payload),

  bulkResolveQueue: (client: AxiosInstance, communityId: string, payload: object) =>
    client.post(`/v1/communities/${communityId}/moderation/queue/bulk-resolve`, payload),

  // Auto-moderation rules
  getAutoModRules: (client: AxiosInstance, communityId: string) =>
    client.get(`/v1/communities/${communityId}/moderation/rules`),

  createAutoModRule: (client: AxiosInstance, communityId: string, payload: object) =>
    client.post(`/v1/communities/${communityId}/moderation/rules`, payload),

  updateAutoModRule: (
    client: AxiosInstance,
    communityId: string,
    ruleId: string,
    payload: object,
  ) => client.patch(`/v1/communities/${communityId}/moderation/rules/${ruleId}`, payload),

  deleteAutoModRule: (client: AxiosInstance, communityId: string, ruleId: string) =>
    client.delete(`/v1/communities/${communityId}/moderation/rules/${ruleId}`),

  // Audit log
  getAuditLog: (client: AxiosInstance, communityId: string, params?: object) =>
    client.get(`/v1/communities/${communityId}/moderation/audit`, { params }),

  // User bans
  banUser: (client: AxiosInstance, communityId: string, userId: string, payload: object) =>
    client.post(`/v1/communities/${communityId}/members/${userId}/ban`, payload),

  unbanUser: (client: AxiosInstance, communityId: string, userId: string) =>
    client.delete(`/v1/communities/${communityId}/members/${userId}/ban`),

  getBannedUsers: (client: AxiosInstance, communityId: string) =>
    client.get(`/v1/communities/${communityId}/members?status=banned`),

  // Mute / slow-mode
  muteUser: (
    client: AxiosInstance,
    communityId: string,
    userId: string,
    durationMinutes: number,
  ) =>
    client.post(`/v1/communities/${communityId}/members/${userId}/mute`, {
      duration_minutes: durationMinutes,
    }),
};