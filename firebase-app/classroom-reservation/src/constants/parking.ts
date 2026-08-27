/** 駐車場枠（固定ID。管理画面の「枠を登録」でのみ Firestore に書く） */
export const PARKING_SPOTS = [
  { id: 'parking-east-1', name: '東門駐車場①', description: '東門駐車場 1' },
  { id: 'parking-east-2', name: '東門駐車場②', description: '東門駐車場 2' },
  { id: 'parking-west-1', name: '西門駐車場①', description: '西門駐車場 1' },
  { id: 'parking-west-2', name: '西門駐車場②', description: '西門駐車場 2' }
] as const;

export const PARKING_SPOT_ORDER = PARKING_SPOTS.map(s => s.id);

export type ParkingAccessMode = 'group' | 'public';
