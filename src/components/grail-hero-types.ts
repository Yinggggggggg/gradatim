/** 一次“光点落进圣杯”：from 是落下前的成长天数，to 是落下后的。id 每次不同，同一次不会重放。 */
export type GrailDrop = { id: number; from: number; to: number };

export type GrailHeroProps = {
  width: number;
  height: number;
  days: number;
  drop: GrailDrop | null;
  /** 页面不在前台时停下平时的动画，省电 */
  active: boolean;
  /** 光点落进液面的那一刻 */
  onDropLanded?: () => void;
};
