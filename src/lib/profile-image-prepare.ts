/**
 * 主页图片的裁剪和压缩，手机和网页预览版共用。
 */

import { type ImageResult, ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type ProfileImageKind = 'avatar' | 'background';
export type ImageSource = 'library' | 'camera';

/** 头像存成这么大的正方形，排行榜和主页上都够清楚 */
const AVATAR_SIZE = 256;
/** 背景照片最宽这么多像素 */
const BACKGROUND_WIDTH = 1200;
const JPEG_QUALITY = 0.82;

/** 头像在选图时就按 1:1 裁，背景按 16:9 裁 */
export const PICKER_ASPECT: Record<ProfileImageKind, [number, number]> = {
  avatar: [1, 1],
  background: [16, 9],
};

/** 头像裁成居中的正方形再缩小；背景只在太宽时缩小。 */
export async function prepareProfileImage(
  kind: ProfileImageKind,
  image: { uri: string; width: number; height: number },
  base64: boolean,
): Promise<ImageResult> {
  const context = ImageManipulator.manipulate(image.uri);
  if (kind === 'avatar') {
    const side = Math.min(image.width, image.height);
    if (image.width !== image.height) {
      context.crop({
        originX: Math.floor((image.width - side) / 2),
        originY: Math.floor((image.height - side) / 2),
        width: side,
        height: side,
      });
    }
    context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  } else if (image.width > BACKGROUND_WIDTH) {
    context.resize({ width: BACKGROUND_WIDTH });
  }
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64 });
}
