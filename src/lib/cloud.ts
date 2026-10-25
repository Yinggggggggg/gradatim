/**
 * 云端服务（Supabase）：邮箱验证码登录，以及调用数据库函数（见 supabase/leaderboard.sql）。
 * 没配置云端地址时这些功能都不出现，其余功能照常可用。
 * 直接用 fetch 调 Supabase 的 REST 接口，不引入 supabase-js：依赖少，也好测试。
 */

import Storage from 'expo-sqlite/kv-store';
import { z } from 'zod';

import { readSecret, writeSecret } from './settings';

const BASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const API_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
const SESSION_KEY = 'cloud.session';
const REQUEST_TIMEOUT_MS = 20_000;
/** 登录凭证在过期前这么多秒就提前续期 */
const REFRESH_MARGIN_SECONDS = 60;

export type CloudUser = { id: string; email: string };

type Session = { accessToken: string; refreshToken: string; expiresAt: number; user: CloudUser };

export type CloudErrorKind = 'not-configured' | 'network' | 'invalid-code' | 'rate-limited' | 'signed-out' | 'server';

export class CloudError extends Error {
  constructor(
    readonly kind: CloudErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

export function isCloudConfigured(): boolean {
  return BASE_URL !== '' && API_KEY !== '';
}

// ---------- 登录状态变化的通知 ----------

const listeners = new Set<() => void>();

export function onAuthChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyAuthChange(): void {
  for (const listener of listeners) listener();
}

// ---------- 请求 ----------

async function request(
  path: string,
  body: object | null,
  accessToken?: string,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<Response> {
  if (!isCloudConfigured()) throw new CloudError('not-configured', '云端服务还没开通');
  const headers: Record<string, string> = { apikey: API_KEY, 'Content-Type': 'application/json' };
  // 旧版 anon key 是 JWT，要同时放进 Authorization；新版 publishable key 只放在 apikey 里
  const bearer = accessToken ?? (API_KEY.startsWith('eyJ') ? API_KEY : null);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new CloudError('network', '连不上云端服务，检查一下网络');
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 会话 ----------

const SessionResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  user: z.object({ id: z.string(), email: z.string().nullish() }),
});

const StoredSession = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  user: z.object({ id: z.string(), email: z.string() }),
});

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function readSessionResponse(response: Response, fallbackEmail: string): Promise<Session> {
  const parsed = SessionResponse.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new CloudError('server', '登录失败，请重试');
  const data = parsed.data;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: nowSeconds() + data.expires_in,
    user: { id: data.user.id, email: data.user.email ?? fallbackEmail },
  };
}

async function loadSession(): Promise<Session | null> {
  const raw = await readSecret(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = StoredSession.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function saveSession(session: Session | null): Promise<void> {
  await writeSecret(SESSION_KEY, session ? JSON.stringify(session) : null);
  notifyAuthChange();
}

async function refreshSession(session: Session): Promise<Session | null> {
  const response = await request('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refreshToken });
  if (response.status >= 400 && response.status < 500) {
    // 续期凭证已失效（比如账号被删了），就当作已经退出登录
    await saveSession(null);
    return null;
  }
  if (!response.ok) throw new CloudError('server', '登录状态续期失败，过一会儿再试');
  const next = await readSessionResponse(response, session.user.email);
  await saveSession(next);
  return next;
}

let refreshing: Promise<Session | null> | null = null;

/** 当前的登录会话，快过期时自动续期；没登录时返回 null。 */
async function getSession(): Promise<Session | null> {
  if (!isCloudConfigured()) return null;
  const session = await loadSession();
  if (!session) return null;
  if (session.expiresAt - REFRESH_MARGIN_SECONDS > nowSeconds()) return session;
  refreshing ??= refreshSession(session).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function getCurrentUser(): Promise<CloudUser | null> {
  return (await getSession())?.user ?? null;
}

// ---------- 邮箱验证码登录 ----------

export async function sendLoginCode(email: string): Promise<void> {
  const response = await request('/auth/v1/otp', { email: email.trim(), create_user: true });
  if (response.status === 429) throw new CloudError('rate-limited', '验证码发得太频繁，过一会儿再试');
  if (!response.ok) throw new CloudError('server', '验证码没有发出去，请检查邮箱地址');
}

export async function verifyLoginCode(email: string, code: string): Promise<CloudUser> {
  const response = await request('/auth/v1/verify', { type: 'email', email: email.trim(), token: code.trim() });
  if (response.status === 429) throw new CloudError('rate-limited', '尝试太频繁，过一会儿再试');
  if (response.status >= 400 && response.status < 500) throw new CloudError('invalid-code', '验证码不对，或者已经过期');
  if (!response.ok) throw new CloudError('server', '登录失败，请重试');
  const session = await readSessionResponse(response, email.trim());
  await saveSession(session);
  return session.user;
}

export async function signOut(): Promise<void> {
  const session = await loadSession();
  await saveSession(null);
  if (session) await request('/auth/v1/logout', null, session.accessToken).catch(() => undefined);
}

// ---------- 数据库函数 ----------

const FunctionError = z.object({ message: z.string() });

const SERVER_MESSAGES: Record<string, string> = {
  'not signed in': '请先登录',
  'invalid nickname': '昵称要 1 到 16 个字',
  'invalid first day': '天数没有通过校验',
  'invalid growth days': '天数没有通过校验',
  'growth too fast': '天数没有通过校验',
  'invalid avatar path': '头像没有通过校验',
};

/** 调用 supabase/leaderboard.sql 里的函数。requireSignIn 的函数在没登录时直接报错。 */
export async function callFunction(name: string, args: object, requireSignIn = false): Promise<unknown> {
  const session = await getSession();
  if (requireSignIn && !session) throw new CloudError('signed-out', '请先登录');
  const response = await request(`/rest/v1/rpc/${name}`, args, session?.accessToken);
  if (!response.ok) {
    const error = FunctionError.safeParse(await response.json().catch(() => null));
    const message = error.success ? SERVER_MESSAGES[error.data.message] : undefined;
    throw new CloudError('server', message ?? `云端服务出错了（${response.status}）`);
  }
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

/** 删除账号：服务器上的账号、排行榜数据和头像都会删掉，本机的记录不受影响。 */
export async function deleteAccount(): Promise<void> {
  // 头像文件不会跟着账号自动删掉，先删；删不掉也不耽误删账号
  await clearRemoteAvatar().catch(() => undefined);
  await callFunction('delete_my_account', {}, true);
  await saveSession(null);
}

// ---------- 文件存储（头像） ----------

/** 头像放在这个公开的存储桶里（见 supabase/leaderboard.sql） */
export const AVATAR_BUCKET = 'avatars';

/** 公开存储桶里文件的地址，不登录也能看 */
export function publicFileUrl(bucket: string, path: string): string {
  return `${BASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** 往存储桶上传文件用的地址和请求头，需要登录。上传本身由各平台自己做（见 profile-images）。 */
export async function storageUploadTarget(
  bucket: string,
  path: string,
  contentType: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const session = await getSession();
  if (!session) throw new CloudError('signed-out', '请先登录');
  return {
    url: `${BASE_URL}/storage/v1/object/${bucket}/${path}`,
    headers: { apikey: API_KEY, Authorization: `Bearer ${session.accessToken}`, 'Content-Type': contentType },
  };
}

export async function deleteStorageFile(bucket: string, path: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new CloudError('signed-out', '请先登录');
  const response = await request(`/storage/v1/object/${bucket}`, { prefixes: [path] }, session.accessToken, 'DELETE');
  if (!response.ok) throw new CloudError('server', `云端文件没有删掉（${response.status}）`);
}

/** 去掉云端的头像：先登记为空，再删掉原来的文件。 */
export async function clearRemoteAvatar(): Promise<void> {
  const old = await callFunction('set_my_avatar', { p_path: null }, true);
  if (typeof old === 'string') await deleteStorageFile(AVATAR_BUCKET, old);
}

// ---------- UID ----------

const UID_KEY = 'cloud.uid';
const StoredUid = z.object({ userId: z.string(), uid: z.number().int() });

/**
 * 自己的 7 位数字 UID（见 supabase/leaderboard.sql 里的 my_uid）。服务器第一次用到时随机分配，
 * 之后不再变，所以本机记一份，下次不联网也能显示。没登录时返回 null。
 */
export async function getMyUid(): Promise<number | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const raw = await Storage.getItem(UID_KEY);
    const cached = StoredUid.safeParse(raw ? JSON.parse(raw) : null);
    if (cached.success && cached.data.userId === user.id) return cached.data.uid;
  } catch {
    // 本机记的内容坏了，就重新向服务器要
  }
  const uid = z.number().int().safeParse(await callFunction('my_uid', {}, true));
  if (!uid.success) throw new CloudError('server', 'UID 没有取到，请重试');
  await Storage.setItem(UID_KEY, JSON.stringify({ userId: user.id, uid: uid.data }));
  return uid.data;
}
