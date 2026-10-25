import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { View } from 'react-native';

import type { GrailHeroProps } from './grail-hero-types';

async function loadCanvas() {
  const { GrailHeroCanvas } = await import('./grail-hero-canvas');
  return { default: GrailHeroCanvas };
}

/** 网页预览：先加载 CanvasKit（public/canvaskit.wasm），再引入用 Skia 画的圣杯。 */
export function GrailHero(props: GrailHeroProps) {
  return (
    <WithSkiaWeb<GrailHeroProps>
      opts={{ locateFile: (file: string) => `/${file}` }}
      getComponent={loadCanvas}
      componentProps={props}
      fallback={<View style={{ width: props.width, height: props.height }} />}
    />
  );
}
