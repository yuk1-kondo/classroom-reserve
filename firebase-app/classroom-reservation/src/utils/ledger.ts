// 台帳ビュー用のユーティリティ関数

import { Reservation, Room } from '../firebase/firestore';
import { authService } from '../firebase/auth';
import { toDateStr } from './dateRange';
import { ROOM_DISPLAY_ORDER, ROOM_CATEGORIES, ROOM_CATEGORY_CLASSES } from '../constants/rooms';
import type { LedgerCellReservation } from '../types/ledger';

/**
 * 日付文字列を正規化
 */
export function normalizeDateInput(dateStr: string): string {
  if (!dateStr) {
    const today = new Date();
    return toDateStr(today);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  try {
    return toDateStr(new Date(dateStr));
  } catch {
    return dateStr.slice(0, 10);
  }
}

/**
 * 時限文字列を展開（例: "1-3" → ["1", "2", "3"]）
 */
export function expandPeriod(raw: string): string[] {
  const p = String(raw || '');
  if (p.includes(',')) {
    return p.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (/^\d+\s*-\s*\d+$/.test(p)) {
    const [a, b] = p.split('-').map(s => parseInt(s.trim(), 10));
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const list: string[] = [];
      for (let x = min; x <= max; x += 1) list.push(String(x));
      return list;
    }
  }
  return [p];
}

/**
 * 教室名からCSSクラス名を取得
 */
export function classifyRoom(roomName: string): string {
  if (!roomName) return ROOM_CATEGORY_CLASSES.DEFAULT;
  if (ROOM_CATEGORIES.SMALL_SEMINAR.test(roomName)) return ROOM_CATEGORY_CLASSES.SMALL_SEMINAR;
  if (ROOM_CATEGORIES.LARGE_SEMINAR.test(roomName)) return ROOM_CATEGORY_CLASSES.LARGE_SEMINAR;
  if (ROOM_CATEGORIES.PURPLE.test(roomName)) return ROOM_CATEGORY_CLASSES.PURPLE;
  if (ROOM_CATEGORIES.BLUE.test(roomName)) return ROOM_CATEGORY_CLASSES.BLUE;
  if (ROOM_CATEGORIES.RED.test(roomName)) return ROOM_CATEGORY_CLASSES.RED;
  return ROOM_CATEGORY_CLASSES.DEFAULT;
}

/**
 * 教室を指定順序でソート
 */
export function sortRoomsWithOrder(rooms: Room[]): Room[] {
  const orderMap = new Map<string, number>();
  ROOM_DISPLAY_ORDER.forEach((name, index) => orderMap.set(name, index));
  return [...rooms].sort((a, b) => {
    const aOrder = orderMap.has(a.name) ? orderMap.get(a.name)! : Number.MAX_SAFE_INTEGER;
    const bOrder = orderMap.has(b.name) ? orderMap.get(b.name)! : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name, 'ja');
  });
}

/**
 * 予約データを台帳のセルマップに変換
 */
export function mapReservationsToCells(
  reservations: Reservation[],
  rooms: Room[],
  filterMine: boolean
): Map<string, Map<string, LedgerCellReservation[]>> {
  const cellMap = new Map<string, Map<string, LedgerCellReservation[]>>();
  const currentUser = authService.getCurrentUser();

  const allowReservation = (reservation: Reservation) => {
    if (!filterMine) return true;
    if (!currentUser) return false;
    return reservation.createdBy === currentUser.uid;
  };

  reservations.forEach(reservation => {
    if (!reservation.roomId || !allowReservation(reservation)) return;
    const periods = expandPeriod(reservation.period);
    periods.forEach(period => {
      const periodKey = String(period);
      if (!cellMap.has(reservation.roomId)) {
        cellMap.set(reservation.roomId, new Map());
      }
      const periodMap = cellMap.get(reservation.roomId)!;
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, []);
      }
      const list = periodMap.get(periodKey)!;
      list.push({
        id: reservation.id || `${reservation.roomId}-${period}-${list.length}`,
        title: reservation.title,
        reservationName: reservation.reservationName,
        period: periodKey,
        roomId: reservation.roomId
      });
    });
  });

  const sortCellReservations = (items: LedgerCellReservation[]): LedgerCellReservation[] => {
    return [...items].sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  };

  cellMap.forEach(periodMap => {
    periodMap.forEach((items, key) => {
      periodMap.set(key, sortCellReservations(items));
    });
  });

  return cellMap;
}

