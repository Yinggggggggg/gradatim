/**
 * “我的”页顶部的个人主页：昵称、箴言、目标、背景和头像，只存在这台手机上。
 * 加入排行榜后，昵称和头像会上传，用来在排行榜上显示（见 leaderboard.ts）。
 */

import Storage from 'expo-sqlite/kv-store';
import { z } from 'zod';

export const NICKNAME_MAX = 16;
export const MOTTO_MAX = 40;
export const GOAL_MAX = 40;
export const MAX_GOALS = 3;

export const BACKGROUND_PRESETS = ['dawn', 'parchment', 'night', 'forest', 'sea', 'dusk'] as const;
export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];

const BackgroundSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), preset: z.enum(BACKGROUND_PRESETS) }),
  // image 是本机图片的引用，见 profile-images
  z.object({ kind: z.literal('photo'), image: z.string() }),
]);
export type ProfileBackground = z.infer<typeof BackgroundSchema>;

const ProfileSchema = z.object({
  nickname: z.string().catch(''),
  motto: z.string().catch(''),
  goals: z.array(z.string()).catch([]),
  avatar: z.string().nullable().catch(null),
  background: BackgroundSchema.catch({ kind: 'preset', preset: 'dawn' }),
});
export type Profile = z.infer<typeof ProfileSchema>;

const KEY = 'profile';

export const EMPTY_PROFILE: Profile = {
  nickname: '',
  motto: '',
  goals: [],
  avatar: null,
  background: { kind: 'preset', preset: 'dawn' },
};

export async function getProfile(): Promise<Profile> {
  const raw = await Storage.getItem(KEY);
  if (!raw) return EMPTY_PROFILE;
  try {
    return ProfileSchema.parse(JSON.parse(raw));
  } catch {
    return EMPTY_PROFILE;
  }
}

/** 存之前去掉首尾空格、截断超长的内容，空目标不留。 */
export async function saveProfile(profile: Profile): Promise<Profile> {
  const cleaned: Profile = {
    ...profile,
    nickname: profile.nickname.trim().slice(0, NICKNAME_MAX),
    motto: profile.motto.trim().slice(0, MOTTO_MAX),
    goals: profile.goals
      .map((goal) => goal.trim().slice(0, GOAL_MAX))
      .filter(Boolean)
      .slice(0, MAX_GOALS),
  };
  await Storage.setItem(KEY, JSON.stringify(cleaned));
  return cleaned;
}
