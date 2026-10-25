/**
 * 全服排行榜：比累计成长天数（只增不减，中断不清零）。
 * 加入需要登录；只上传昵称、天数和主页上的头像，记录内容不会离开手机。
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { z } from 'zod';

import {
  AVATAR_BUCKET,
  callFunction,
  clearRemoteAvatar,
  CloudError,
  deleteStorageFile,
  getCurrentUser,
  publicFileUrl,
  storageUploadTarget,
} from './cloud';
import { todayString } from './dates';
import { countGrowthDays, getFirstEntry } from './db';
import { getProfile, saveProfile } from './profile';
import { uploadProfileImage } from './profile-images';

const MEMBERSHIP_KEY = 'leaderboard.membership';
const AVATAR_KEY = 'leaderboard.avatar';

export type BoardRow = { rank: number; nickname: string; growthDays: number; isMe: boolean; avatarUrl: string | null };
export type Board = { rows: BoardRow[]; total: number; me: BoardRow | null };

const BoardResponse = z.array(
  z.object({
    rank: z.coerce.number(),
    nickname: z.string(),
    growth_days: z.coerce.number(),
    is_me: z.boolean(),
    total: z.coerce.number(),
    avatar_path: z.string().nullable().optional(),
  }),
);

/** 本机记得“哪个账号用什么昵称加入了排行榜”，好在记录变化时自动更新天数。 */
const MembershipSchema = z.object({ userId: z.string(), nickname: z.string() });
type Membership = z.infer<typeof MembershipSchema>;

/** 本机记得“哪张头像已经传给了哪个账号”，头像没换就不用重传。 */
const AvatarRecordSchema = z.object({ userId: z.string(), image: z.string().nullable() });
type AvatarRecord = z.infer<typeof AvatarRecordSchema>;

async function readJson<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
  const raw = await Storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: object | null): Promise<void> {
  if (value) await Storage.setItem(key, JSON.stringify(value));
  else await Storage.removeItem(key);
}

const readMembership = () => readJson(MEMBERSHIP_KEY, MembershipSchema);
const writeMembership = (membership: Membership | null) => writeJson(MEMBERSHIP_KEY, membership);
const readAvatarRecord = () => readJson(AVATAR_KEY, AvatarRecordSchema);
const writeAvatarRecord = (record: AvatarRecord | null) => writeJson(AVATAR_KEY, record);

/** 当前登录的账号已经加入排行榜时，返回账号 id 和加入时的记录 */
async function currentMember(): Promise<{ userId: string; membership: Membership } | null> {
  const [membership, user] = await Promise.all([readMembership(), getCurrentUser()]);
  if (!membership || !user || membership.userId !== user.id) return null;
  return { userId: user.id, membership };
}

async function submit(db: SQLiteDatabase, nickname: string): Promise<void> {
  const growthDays = await countGrowthDays(db);
  const firstDay = (await getFirstEntry(db))?.day ?? todayString();
  await callFunction('submit_growth', { p_nickname: nickname, p_growth_days: growthDays, p_first_day: firstDay }, true);
}

export async function joinBoard(db: SQLiteDatabase, nickname: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new CloudError('signed-out', '请先登录');
  const trimmed = nickname.trim();
  await submit(db, trimmed);
  await writeMembership({ userId: user.id, nickname: trimmed });
  // 头像传不上去不影响加入，下次打开排行榜会再试
  await syncAvatar().catch(() => undefined);
}

/**
 * 记录变化、主页改了昵称后调用：已经加入排行榜就更新天数，昵称以主页上的为准。
 * 失败了不打扰用户，下次记录或打开排行榜时会再试。
 */
export async function syncGrowth(db: SQLiteDatabase): Promise<void> {
  try {
    const member = await currentMember();
    if (!member) return;
    const nickname = (await getProfile()).nickname || member.membership.nickname;
    await submit(db, nickname);
    if (nickname !== member.membership.nickname) await writeMembership({ userId: member.userId, nickname });
  } catch {
    // 网络不好或者校验没通过，下次再试
  }
}

let avatarSync: Promise<void> = Promise.resolve();

/**
 * 已经加入排行榜时，让云端的头像和主页上的一致：换了头像就传新的、删掉旧的；
 * 主页上去掉了头像，云端的也删掉。没加入排行榜就什么都不传。
 * 连着换几次头像时一次一次地来，免得几次上传互相打架。
 */
export function syncAvatar(): Promise<void> {
  avatarSync = avatarSync.catch(() => undefined).then(syncAvatarNow);
  return avatarSync;
}

async function syncAvatarNow(): Promise<void> {
  const member = await currentMember();
  if (!member) return;
  const { avatar } = await getProfile();
  const record = await readAvatarRecord();
  if (record?.userId === member.userId && record.image === avatar) return;

  let path: string | null = null;
  if (avatar) {
    // 每次换头像都用新文件名，排行榜上不会一直显示缓存里的旧头像
    path = `${member.userId}/${Date.now()}.jpg`;
    const target = await storageUploadTarget(AVATAR_BUCKET, path, 'image/jpeg');
    const status = await uploadProfileImage(avatar, target.url, target.headers);
    if (status < 200 || status >= 300) throw new CloudError('server', `头像没有传上去（${status}）`);
  }
  const old = await callFunction('set_my_avatar', { p_path: path }, true);
  if (typeof old === 'string' && old !== path) await deleteStorageFile(AVATAR_BUCKET, old).catch(() => undefined);
  await writeAvatarRecord({ userId: member.userId, image: avatar });
}

/** 读取排行榜。以服务器为准，顺便更新本机记着的“是否已加入”。 */
export async function fetchBoard(): Promise<Board> {
  const data = BoardResponse.parse(await callFunction('growth_leaderboard', { p_limit: 20 }));
  const rows = data.map((row) => ({
    rank: row.rank,
    nickname: row.nickname,
    growthDays: row.growth_days,
    isMe: row.is_me,
    avatarUrl: row.avatar_path ? publicFileUrl(AVATAR_BUCKET, row.avatar_path) : null,
  }));
  const me = rows.find((row) => row.isMe) ?? null;

  const user = await getCurrentUser();
  if (user) {
    const membership = await readMembership();
    if (me) await writeMembership({ userId: user.id, nickname: me.nickname });
    else if (membership?.userId === user.id) await writeMembership(null);
  }
  // 主页还没起昵称的话，就用排行榜上的昵称
  if (me) {
    const profile = await getProfile();
    if (!profile.nickname) await saveProfile({ ...profile, nickname: me.nickname });
  }
  return { rows, total: data[0]?.total ?? 0, me };
}

/** 退出排行榜：排行榜上的昵称、天数和头像都删掉，账号保留。 */
export async function leaveBoard(): Promise<void> {
  await clearRemoteAvatar().catch(() => undefined);
  await callFunction('leave_growth_board', {}, true);
  await writeMembership(null);
  await writeAvatarRecord(null);
}
