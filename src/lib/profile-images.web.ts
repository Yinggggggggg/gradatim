/**
 * 网页预览版的主页图片：网页上没有 App 的文档目录，图片压缩后直接以 data URI 存进主页数据。
 * 只为了开发时能在浏览器里试，图片比手机上占地方，但很小。
 */

import * as ImagePicker from 'expo-image-picker';

import { type ImageSource, prepareProfileImage, type ProfileImageKind } from './profile-image-prepare';

/** 网页上只能从文件里选 */
export const CAMERA_SUPPORTED = false;

/** image 本身就是 data URI */
export function profileImageUri(image: string): string {
  return image;
}

export async function pickProfileImage(kind: ProfileImageKind, _source: ImageSource): Promise<string | null | 'denied'> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const prepared = await prepareProfileImage(kind, asset, true);
  return prepared.base64 ? `data:image/jpeg;base64,${prepared.base64}` : prepared.uri;
}

export function deleteProfileImage(_image: string): void {
  // 存在主页数据里，主页数据更新时就没了
}

export async function uploadProfileImage(image: string, url: string, headers: Record<string, string>): Promise<number> {
  const body = await (await fetch(image)).blob();
  const response = await fetch(url, { method: 'POST', headers, body });
  return response.status;
}
