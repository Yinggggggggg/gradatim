/**
 * 记录里的图片：从相册选或者直接拍，压缩后存在 App 自己的文档目录里，不上传。
 */

import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { SQLiteDatabase } from 'expo-sqlite';

import { type Attachment, deleteEntry, insertAttachment, listAttachments } from './db';

/** 每条记录最多几张图片 */
export const MAX_IMAGES_PER_ENTRY = 4;
/** 长边超过这个像素就缩小，手机照片动辄几 MB，缩小后一般只有几百 KB */
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

export type PickedImage = { uri: string; width: number; height: number };

function attachmentsDirectory(): Directory {
  const directory = new Directory(Paths.document, 'attachments');
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

export function attachmentUri(attachment: Pick<Attachment, 'file'>): string {
  return new File(attachmentsDirectory(), attachment.file).uri;
}

function toPicked(result: ImagePicker.ImagePickerResult): PickedImage[] {
  if (result.canceled) return [];
  return result.assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height }));
}

export async function pickFromLibrary(limit: number): Promise<PickedImage[]> {
  if (limit <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 1,
  });
  return toPicked(result).slice(0, limit);
}

/** 拍一张照片；没有相机权限时返回 'denied'。 */
export async function takePhoto(): Promise<PickedImage[] | 'denied'> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return 'denied';
  return toPicked(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
}

async function compress(image: PickedImage): Promise<PickedImage> {
  const context = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > MAX_SIDE) {
    context.resize(image.width >= image.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** 把选好的图片压缩后存进附件目录，并记到这条记录名下。 */
export async function saveAttachments(db: SQLiteDatabase, entryId: number, images: PickedImage[]): Promise<void> {
  const createdAt = new Date().toISOString();
  for (const [index, image] of images.entries()) {
    const compressed = await compress(image);
    const name = `${entryId}-${Date.now()}-${index}.jpg`;
    await new File(compressed.uri).move(new File(attachmentsDirectory(), name));
    await insertAttachment(db, { entryId, file: name, width: compressed.width, height: compressed.height, createdAt });
  }
}

/** 删除记录，连同它的图片文件。 */
export async function deleteEntryAndAttachments(db: SQLiteDatabase, entryId: number): Promise<void> {
  const attachments = await listAttachments(db, entryId);
  await deleteEntry(db, entryId);
  for (const attachment of attachments) {
    const file = new File(attachmentsDirectory(), attachment.file);
    if (file.exists) file.delete();
  }
}
