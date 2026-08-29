// Firestore データ初期化とマイグレーション用スクリプト
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from './config';
import { Room, roomsService } from './firestore';

// GASのスプレッドシートデータをFirebaseに移行するための初期データ
export const initialRoomsData: Omit<Room, 'id' | 'createdAt'>[] = [
  { name: '小演習室1', description: '小規模演習室' },
  { name: '小演習室2', description: '小規模演習室' },
  { name: '小演習室3', description: '小規模演習室' },
  { name: '小演習室4', description: '小規模演習室' },
  { name: '小演習室5', description: '小規模演習室' },
  { name: '小演習室6', description: '小規模演習室' },
  { name: '大演習室1', description: '大規模演習室' },
  { name: '大演習室2', description: '大規模演習室' },
  { name: '大演習室3', description: '大規模演習室' },
  { name: '大演習室4', description: '大規模演習室' },
  { name: '大演習室5', description: '大規模演習室' },
  { name: '大演習室6', description: '大規模演習室' },
  { name: 'サテライト', description: 'サテライト教室' },
  { name: '会議室', description: '会議室' },
  { name: '社会科教室', description: '社会科専用教室' },
  { name: 'グローバル教室①', description: 'グローバル教育用教室' },
  { name: 'グローバル教室②', description: 'グローバル教育用教室' },
  { name: 'LL教室', description: 'Language Laboratory' },
  { name: 'モノラボ', description: 'ものづくりラボラトリー' },
  { name: '視聴覚教室', description: '視聴覚設備完備教室' },
  { name: '多目的室', description: '多目的利用可能' }
];

/** 理科グループ専用として追加する実験室（Step 3）。既存教室と同名なら scienceGroupOnly を付与する */
export const SCIENCE_LAB_ROOMS: Omit<Room, 'id' | 'createdAt'>[] = [
  { name: '生物実験室', description: '生物実験用（理科グループ専用）', scienceGroupOnly: true },
  { name: '化学実験室', description: '化学実験用（理科グループ専用）', scienceGroupOnly: true },
  { name: '物理実験室', description: '物理実験用（理科グループ専用）', scienceGroupOnly: true }
];

// データ移行サービス
export const migrationService = {
  /**
   * 生物・化学・物理実験室を追加（同名教室があれば scienceGroupOnly 等を付与）。
   * 既に理科専用として登録済みの場合はスキップ。
   */
  async ensureScienceLabRooms(): Promise<{ added: string[]; updated: string[]; skipped: string[] }> {
    const added: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];
    const existing = await roomsService.getAllRooms();
    for (const template of SCIENCE_LAB_ROOMS) {
      const hit = existing.find(r => r.name === template.name);
      if (hit?.id) {
        if (hit.scienceGroupOnly === true) {
          skipped.push(template.name);
        } else {
          await updateDoc(doc(db, 'rooms', hit.id), {
            scienceGroupOnly: true,
            description: template.description,
            capacity: deleteField()
          });
          updated.push(template.name);
        }
      } else {
        await roomsService.addRoom(template);
        added.push(template.name);
      }
    }
    roomsService.clearRoomsCache();
    return { added, updated, skipped };
  }
};
