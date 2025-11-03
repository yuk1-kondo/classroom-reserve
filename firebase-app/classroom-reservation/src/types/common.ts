// 共通の型定義

import { Timestamp } from 'firebase/firestore';

/**
 * 教室の型定義
 */
export interface Room {
  id?: string;
  name: string;
  description?: string;
  capacity?: number;
  createdAt?: Timestamp;
}

/**
 * 予約の型定義
 */
export interface Reservation {
  id?: string;
  roomId: string;
  roomName: string;
  title: string;
  reservationName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  period: string;
  periodName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

/**
 * 予約スロットの型（予約本体 or テンプレートロック）
 */
export interface ReservationSlot {
  roomId: string;
  date: string; // yyyy-mm-dd
  period: string; // '1','2','lunch','after' など
  reservationId?: string | null; // 予約本体がある場合
  type?: string; // 'template-lock' など
  templateId?: string | null;
}

/**
 * 時限の型定義
 */
export type Period = '1' | '2' | '3' | '4' | '5' | '6' | '7' | 'lunch' | 'after';

/**
 * 時限情報
 */
export interface PeriodInfo {
  label: string;
  start: string; // HH:mm形式
  end: string;   // HH:mm形式
}

/**
 * 日付範囲
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * 日付範囲（文字列版）
 */
export interface DateRangeString {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

/**
 * ユーザー情報（簡易版）
 */
export interface UserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * エラー情報
 */
export interface ErrorInfo {
  code?: string;
  message: string;
  context?: string;
}

