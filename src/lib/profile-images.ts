/**
 * 主页上的头像和背景照片：从相册选或者直接拍，裁剪压缩后存在 App 自己的文档目录里。
 * 头像在加入排行榜后会上传（见 leaderboard.ts），背景照片只留在手机上。
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { type ImageSource, PICKER_ASPECT, prepareProfileImage, type ProfileImageKind } from './profile-image-prepare';

/** 手机上能拍照 */
export const CAMERA_SUPPORTED = true;

function profileDirectory(): Directory {
  const directory = new Directory(Paths.document, 'profile');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

/** image 是 pickProfileImage 返回的文件名 */
export function profileImageUri(image: string): string {
  return new File(profileDirectory(), image).uri;
}

/** 选一张图并存好，返回文件名；取消了返回 null，没有相机权限返回 'denied'。 */
export async function pickProfileImage(kind: ProfileImageKind, source: ImageSource): Promise<string | null | 'denied'> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: PICKER_ASPECT[kind],
    quality: 1,
  };
  if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return 'denied';
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const prepared = await prepareProfileImage(kind, asset, false);
  const name = `${kind}-${Date.now()}.jpg`;
  await new File(prepared.uri).move(new File(profileDirectory(), name));
  return name;
}

export function deleteProfileImage(image: string): void {
  const file = new File(profileDirectory(), image);
  if (file.exists) file.delete();
}

/** 把图片原样上传到 url，返回 HTTP 状态码。 */
export async function uploadProfileImage(image: string, url: string, headers: Record<string, string>): Promise<number> {
  const result = await new File(profileDirectory(), image).upload(url, { httpMethod: 'POST', headers, mimeType: 'image/jpeg' });
  return result.status;
}
