export type Unit = 'reps' | 'km' | 'min' | 'h';

export interface Goal {
  id: string;
  title: string;
  targetValue: number;
  unit: Unit;
  createdAt: string;
  deadline: string;
}

export const UNIT_LABELS: Record<Unit, string> = {
  reps: 'répétitions',
  km: 'km',
  min: 'minutes',
  h: 'heures',
};
