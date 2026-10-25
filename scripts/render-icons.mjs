// 用 Skia（CanvasKit）画应用图标、启动画面和网页图标，写进 assets/images。
// 圣杯的形状、金色和光液跟“今天”页的大圣杯（src/components/grail-hero-canvas.tsx）一致，坐标也在同一个 120 × 150 的画布里。
// 改了圣杯的样子后重新运行：node scripts/render-icons.mjs
// 加上 --preview <文件> 会另画一张预览图：安卓各种桌面形状、各个尺寸、主题图标和启动画面。
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets/images');
const previewIndex = process.argv.indexOf('--preview');
const previewFile = previewIndex > 0 ? path.resolve(process.argv[previewIndex + 1]) : null;

const require = createRequire(import.meta.url);
const ckDir = path.join(root, 'node_modules/canvaskit-wasm/bin/full');
const CanvasKitInit = require(path.join(ckDir, 'canvaskit.js'));
const CK = await CanvasKitInit({ locateFile: (file) => path.join(ckDir, file) });

const hex = (h) => {
  const n = h.slice(1);
  const c = (i) => parseInt(n.slice(i, i + 2), 16) / 255;
  return CK.Color4f(c(0), c(2), c(4), n.length === 8 ? c(6) : 1);
};
const svg = (d) => CK.Path.MakeFromSVGString(d);

const BOWL = svg('M14 28 C14 66 34 88 60 88 C86 88 106 66 106 28 Z');
const BOWL_INSIDE = svg('M19 30 C19 64 37 83 60 83 C83 83 101 64 101 30 Z');
const BAND = svg('M17 44 C34 50 86 50 103 44');
const STEM = svg('M53 87 L67 87 L63 99 L57 99 Z M57 109 L63 109 L65 124 L55 124 Z');
const FOOT = svg('M30 137 C40 127 50 124 60 124 C70 124 80 127 90 137 L92 141 L28 141 Z');
/** 杯壁左边的一道反光 */
const SHINE = svg('M23.5 37 C24.5 54 31 67 41 75.5');
const RIM = CK.XYWHRect(14, 23, 92, 10);
const KNOT = CK.XYWHRect(50, 98, 20, 12);

const GOLD = ['#7A5418', '#E8C468', '#FFF2B8', '#D9A441', '#7A5418'].map(hex);
const GOLD_STOPS = [0, 0.3, 0.5, 0.7, 1];
const LIQUID = ['#FFF6C8', '#F7CF5A', '#C98A1C'].map(hex);
const LIQUID_TOP = 32;
const LIQUID_BOTTOM = 83;
/** 图标里光液的高度：六成满 */
const LEVEL = 0.62;
/** 落下的光点的位置，在杯口上方 */
const DROP_Y = 11;

function paint({ color, alpha, shader, stroke, blur, blend } = {}) {
  const p = new CK.Paint();
  p.setAntiAlias(true);
  if (color) p.setColor(hex(color));
  if (shader) p.setShader(shader);
  if (alpha !== undefined) p.setAlphaf(alpha);
  if (stroke) {
    p.setStyle(CK.PaintStyle.Stroke);
    p.setStrokeWidth(stroke);
    p.setStrokeCap(CK.StrokeCap.Round);
    p.setStrokeJoin(CK.StrokeJoin.Round);
  }
  if (blur) p.setMaskFilter(CK.MaskFilter.MakeBlur(CK.BlurStyle.Normal, blur, true));
  if (blend) p.setBlendMode(blend);
  return p;
}
const gold = () => CK.Shader.MakeLinearGradient([14, 0], [106, 0], GOLD, GOLD_STOPS, CK.TileMode.Clamp);

/**
 * 把圣杯画布放进 size × size 的方块：scale 是 1024 大小时每个圣杯单位多少像素，
 * 圣杯从 top 到 bottom 的这一段竖直居中，再往下挪 dy。
 */
function place(canvas, size, { scale, top, bottom, dy }) {
  const k = size / 1024;
  const s = k * scale;
  canvas.translate(size / 2 - 60 * s, size / 2 - ((top + bottom) / 2) * s + dy * k);
  canvas.scale(s, s);
}

function liquidPath(level) {
  const top = LIQUID_BOTTOM - level * (LIQUID_BOTTOM - LIQUID_TOP);
  const p = new CK.PathBuilder();
  p.moveTo(10, top);
  for (let x = 10; x <= 110; x += 2.5) p.lineTo(x, top + Math.sin(1.1 + x * 0.2) * 1.1);
  p.lineTo(110, 96);
  p.lineTo(10, 96);
  p.close();
  return { path: p.detach(), top };
}

function raysPath(count, length, spread) {
  const p = new CK.PathBuilder();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    p.moveTo(60, 58);
    p.lineTo(60 + Math.cos(angle - spread) * length, 58 + Math.sin(angle - spread) * length);
    p.lineTo(60 + Math.cos(angle + spread) * length, 58 + Math.sin(angle + spread) * length);
    p.close();
  }
  return p.detach();
}

/** 光点上方渐隐的尾迹，看得出它正在往下落 */
function streakPath(top, bottom, halfWidth) {
  const p = new CK.PathBuilder();
  p.moveTo(60, top);
  p.lineTo(60 + halfWidth, bottom);
  p.lineTo(60 - halfWidth, bottom);
  p.close();
  return p.detach();
}

/** 杯子周围固定的几颗小光点：[x, y, 半径, 不透明度] */
const SPARKS = [
  [6, 70, 1.6, 0.8], [112, 62, 1.9, 0.85], [-4, 34, 1.1, 0.6], [124, 30, 1.3, 0.65],
  [18, 104, 1.0, 0.5], [102, 100, 1.2, 0.55], [32, 6, 0.9, 0.5], [90, 10, 1.1, 0.6],
];

/** 杯子背后不动的部分：深色暖底、光芒、小光点、光晕和柔光 */
function drawGround(canvas, size, layout) {
  const ground = CK.Shader.MakeRadialGradient(
    [size / 2, size * 0.45], size * 0.75,
    ['#3E2F1C', '#241B12', '#130F0B'].map(hex), [0, 0.5, 1], CK.TileMode.Clamp);
  canvas.drawRect(CK.XYWHRect(0, 0, size, size), paint({ shader: ground }));
  canvas.save();
  place(canvas, size, layout);
  const rays = CK.Shader.MakeRadialGradient([60, 58], 128,
    ['#F3D27A', '#F3D27A66', '#F3D27A00'].map(hex), [0, 0.45, 1], CK.TileMode.Clamp);
  canvas.drawPath(raysPath(12, 150, 0.06), paint({ shader: rays, alpha: 0.3 }));
  const halo = CK.Shader.MakeRadialGradient([60, 58], 78,
    ['#FFE7A3E6', '#E9B94938', '#E9B94900'].map(hex), [0, 0.55, 1], CK.TileMode.Clamp);
  canvas.drawCircle(60, 58, 78, paint({ shader: halo, alpha: 0.75 }));
  canvas.drawCircle(60, 56, 40, paint({ color: '#F3D27A', alpha: 0.3, blur: 22 }));
  for (const [x, y, r, a] of SPARKS) canvas.drawCircle(x, y, r, paint({ color: '#FFE7A3', alpha: a * 0.75, blur: 0.9 }));
  canvas.restore();
}

/** 金色的圣杯、六成满的光液，和一颗正落进杯里的光点 */
function drawGrail(canvas) {
  canvas.drawPath(BOWL, paint({ color: '#FFFAEB', alpha: 0.12 }));
  canvas.save();
  canvas.clipPath(BOWL_INSIDE, CK.ClipOp.Intersect, true);
  const { path: liquid, top } = liquidPath(LEVEL);
  const liquidShader = CK.Shader.MakeLinearGradient([0, LIQUID_TOP], [0, LIQUID_BOTTOM], LIQUID, [0, 0.45, 1], CK.TileMode.Clamp);
  canvas.drawPath(liquid, paint({ shader: liquidShader }));
  canvas.drawOval(CK.XYWHRect(14, top - 1.6, 92, 3.2), paint({ color: '#FFFBE6', alpha: 0.55, blur: 0.8 }));
  canvas.restore();

  canvas.drawPath(SHINE, paint({ color: '#FFFFFF', alpha: 0.28, stroke: 2.2 }));
  canvas.drawPath(BOWL, paint({ shader: gold(), stroke: 3.6 }));
  canvas.drawPath(BAND, paint({ shader: gold(), stroke: 2.2, alpha: 0.85 }));
  canvas.drawOval(RIM, paint({ color: '#5A3B0E', alpha: 0.35 }));
  canvas.drawOval(RIM, paint({ shader: gold(), stroke: 3.4 }));
  canvas.drawPath(STEM, paint({ shader: gold() }));
  canvas.drawOval(KNOT, paint({ shader: gold() }));
  canvas.drawCircle(60, 104, 3.4, paint({ color: '#C81E3A' }));
  canvas.drawCircle(59, 102.8, 1.1, paint({ color: '#FFFFFF', alpha: 0.85 }));
  canvas.drawPath(FOOT, paint({ shader: gold() }));
  canvas.drawLine(31, 137.2, 89, 137.2, paint({ color: '#7A5418', alpha: 0.55, stroke: 1.1 }));

  const fade = CK.Shader.MakeLinearGradient([0, DROP_Y - 24], [0, DROP_Y], ['#FFE7A300', '#FFE7A3D9'].map(hex), [0, 1], CK.TileMode.Clamp);
  canvas.drawPath(streakPath(DROP_Y - 24, DROP_Y - 1, 2.6), paint({ shader: fade, blur: 0.9 }));
  canvas.drawCircle(60, DROP_Y, 9.5, paint({ color: '#FFE7A3', alpha: 0.6, blur: 5 }));
  canvas.drawCircle(60, DROP_Y, 4, paint({ color: '#FFFDF2' }));
}

/** 安卓 13 以后的主题图标只用一种颜色：杯身画轮廓，光液、杯脚和光点涂实 */
function drawMono(canvas) {
  const white = '#FFFFFF';
  canvas.save();
  canvas.clipPath(BOWL_INSIDE, CK.ClipOp.Intersect, true);
  canvas.drawPath(liquidPath(LEVEL).path, paint({ color: white }));
  canvas.restore();
  canvas.drawPath(BOWL, paint({ color: white, stroke: 4.6 }));
  canvas.drawOval(RIM, paint({ color: white, stroke: 4.2 }));
  canvas.drawPath(STEM, paint({ color: white }));
  canvas.drawOval(KNOT, paint({ color: white }));
  // 宝石的位置镂空
  canvas.drawCircle(60, 104, 3.2, paint({ color: white, blend: CK.BlendMode.Clear }));
  canvas.drawPath(FOOT, paint({ color: white }));
  canvas.drawCircle(60, DROP_Y, 4.8, paint({ color: white }));
  canvas.drawPath(streakPath(DROP_Y - 21, DROP_Y - 7, 2.4), paint({ color: white }));
}

// 几种用法下圣杯的大小和位置；竖直方向从尾迹顶端（-6）算到杯脚底（141）
/** iOS 和通用图标：整个方块都看得到 */
const FULL = { scale: 4.4, top: -6, bottom: 141, dy: 8 };
/** 安卓自适应图标：图层是 108dp，桌面只露出中间 72dp，圣杯要在直径 66dp 的安全圆里 */
const ADAPTIVE = { scale: 3.35, top: -6, bottom: 141, dy: 4 };
/** 启动画面：安卓 12 以后只露出中间的圆，光晕也要在圆里淡出 */
const SPLASH = { scale: 3.3, top: -6, bottom: 141, dy: 0 };

const drawFull = (canvas, size) => {
  drawGround(canvas, size, FULL);
  canvas.save();
  place(canvas, size, FULL);
  drawGrail(canvas);
  canvas.restore();
};
const drawForeground = (canvas, size) => {
  canvas.save();
  place(canvas, size, ADAPTIVE);
  drawGrail(canvas);
  canvas.restore();
};
const drawBackground = (canvas, size) => drawGround(canvas, size, ADAPTIVE);
const drawMonochrome = (canvas, size) => {
  canvas.save();
  place(canvas, size, ADAPTIVE);
  drawMono(canvas);
  canvas.restore();
};
const drawSplash = (canvas, size) => {
  canvas.save();
  place(canvas, size, SPLASH);
  const halo = CK.Shader.MakeRadialGradient([60, 62], 70,
    ['#F3D27A59', '#E9B94920', '#E9B94900'].map(hex), [0, 0.5, 1], CK.TileMode.Clamp);
  canvas.drawCircle(60, 62, 70, paint({ shader: halo }));
  drawGrail(canvas);
  canvas.restore();
};
const rounded = (draw, radius) => (canvas, size) => {
  canvas.save();
  canvas.clipRRect(CK.RRectXY(CK.XYWHRect(0, 0, size, size), size * radius, size * radius), CK.ClipOp.Intersect, true);
  draw(canvas, size);
  canvas.restore();
};

function render(size, draw) {
  const surface = CK.MakeSurface(size, size);
  draw(surface.getCanvas(), size);
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes();
  surface.delete();
  return bytes;
}

/** 不带透明通道的 PNG：App Store 不收带透明通道的图标 */
function renderOpaque(size, draw) {
  const surface = CK.MakeSurface(size, size);
  draw(surface.getCanvas(), size);
  surface.flush();
  const rgba = surface.makeImageSnapshot().readPixels(0, 0, {
    width: size, height: size, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Unpremul, colorSpace: CK.ColorSpace.SRGB,
  });
  surface.delete();
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const o = y * stride + 1 + x * 3;
      raw[o] = rgba[i];
      raw[o + 1] = rgba[i + 1];
      raw[o + 2] = rgba[i + 2];
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 每个通道 8 位
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const save = (name, bytes) => fs.writeFileSync(path.join(outDir, name), bytes);
save('icon.png', renderOpaque(1024, drawFull));
save('android-icon-foreground.png', render(1024, drawForeground));
save('android-icon-background.png', render(1024, drawBackground));
save('android-icon-monochrome.png', render(1024, drawMonochrome));
save('splash-icon.png', render(1024, drawSplash));
save('favicon.png', render(192, rounded(drawFull, 0.22)));
console.log(`图标已写进 ${path.relative(process.cwd(), outDir) || outDir}`);

if (previewFile) {
  /** 安卓桌面会把 108dp 的图层裁成各种形状，只露出中间 72dp */
  const masked = (shape) => (canvas, size) => {
    const crop = size * 1.5;
    const offset = (size - crop) / 2;
    canvas.save();
    if (shape === 'circle') {
      const p = new CK.PathBuilder();
      p.addCircle(size / 2, size / 2, size / 2);
      canvas.clipPath(p.detach(), CK.ClipOp.Intersect, true);
    } else {
      canvas.clipRRect(CK.RRectXY(CK.XYWHRect(0, 0, size, size), size * shape, size * shape), CK.ClipOp.Intersect, true);
    }
    canvas.translate(offset, offset);
    drawBackground(canvas, crop);
    drawForeground(canvas, crop);
    canvas.restore();
  };
  /** 主题图标：系统用壁纸取色，给单色图标上色 */
  const themed = (tint, ink) => (canvas, size) => {
    const crop = size * 1.5;
    const offset = (size - crop) / 2;
    canvas.drawCircle(size / 2, size / 2, size / 2, paint({ color: tint }));
    canvas.saveLayer();
    canvas.save();
    canvas.translate(offset, offset);
    drawMonochrome(canvas, crop);
    canvas.restore();
    canvas.drawRect(CK.XYWHRect(0, 0, size, size), paint({ color: ink, blend: CK.BlendMode.SrcIn }));
    canvas.restore();
  };
  const at = (canvas, x, y, size, draw) => {
    canvas.save();
    canvas.translate(x, y);
    draw(canvas, size);
    canvas.restore();
  };
  const sheet = (canvas, size) => {
    canvas.drawRect(CK.XYWHRect(0, 0, size, size), paint({ color: '#5B6470' }));
    at(canvas, 40, 40, 300, masked('circle'));
    at(canvas, 362, 40, 300, masked(0.3));
    at(canvas, 684, 40, 300, rounded(drawFull, 0.225));
    let x = 40;
    for (const w of [192, 128, 96, 72, 48, 36]) {
      at(canvas, x, 380, w, masked('circle'));
      at(canvas, x, 600, w, rounded(drawFull, 0.225));
      x += w + 28;
    }
    x = 40;
    for (const [tint, ink] of [['#D7E3F7', '#1F3760'], ['#2B3442', '#C9DAF5'], ['#F2E6D0', '#5A4524']]) {
      at(canvas, x, 830, 150, themed(tint, ink));
      x += 178;
    }
    at(canvas, x + 20, 830, 150, (c, s) => {
      c.drawRect(CK.XYWHRect(0, 0, s, s), paint({ color: '#1B1611' }));
      drawSplash(c, s);
    });
  };
  fs.writeFileSync(previewFile, render(1024, sheet));
  console.log(`预览图：${previewFile}`);
}
