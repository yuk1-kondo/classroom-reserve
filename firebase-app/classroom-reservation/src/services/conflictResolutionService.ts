// 固定予約の競合解決サービス
import { 
  collection, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../constants/collections';
import { 
  WeeklyTemplate, 
  ConflictInfo, 
  ConflictResolutionOptions 
} from '../types/templates';
import { reservationsService } from '../firebase/firestore';
import { toDateStr } from '../utils/dateRange';
import { displayLabel } from '../utils/periodLabel';

export interface ConflictResolutionResult {
  success: boolean;
  action: 'overridden' | 'relocated' | 'skipped' | 'notified';
  conflicts: ConflictInfo[];
  newLocation?: {
    roomId: string;
    roomName: string;
    period: string;
  };
  error?: string;
}

export class ConflictResolutionService {
  
  /**
   * テンプレートと既存予約の競合を解決
   */
  static async resolveTemplateConflicts(
    template: WeeklyTemplate,
    existingReservations: any[],
    options: ConflictResolutionOptions = {}
  ): Promise<ConflictResolutionResult> {
    try {
      const priority = template.priority || 'normal';
      
      switch (priority) {
        case 'critical':
          // 最重要: 既存予約を強制上書き
          return await this.forceOverride(template, existingReservations);
          
        case 'high':
          // 高優先: 既存予約を移動または削除
          return await this.relocateOrRemove(template, existingReservations);
          
        case 'normal':
        default:
          // 通常: 競合があればスキップ
          return await this.skipIfConflict(template, existingReservations);
      }
    } catch (error) {
      console.error('競合解決エラー:', error);
      return {
        success: false,
        action: 'skipped',
        conflicts: [],
        error: error instanceof Error ? error.message : '不明なエラー'
      };
    }
  }

  /**
   * 既存予約を強制上書き
   */
  private static async forceOverride(
    template: WeeklyTemplate,
    conflicts: any[]
  ): Promise<ConflictResolutionResult> {
    const conflictInfos: ConflictInfo[] = [];
    
    for (const conflict of conflicts) {
      try {
        // 既存予約を削除
        if (conflict.id) {
          await reservationsService.deleteReservation(conflict.id);
        }
        
        conflictInfos.push({
          date: toDateStr(conflict.startTime.toDate()),
          roomId: conflict.roomId,
          roomName: conflict.roomName,
          period: conflict.period,
          periodName: conflict.periodName,
          existingReservation: {
            id: conflict.id || '',
            title: conflict.title,
            reservationName: conflict.reservationName,
            createdBy: conflict.createdBy || ''
          },
          template: {
            id: template.id || '',
            name: template.name,
            roomId: template.roomId,
            weekday: template.weekday,
            periods: template.periods,
            startDate: template.startDate,
            endDate: template.endDate,
            enabled: template.enabled,
            priority: template.priority || 'normal',
            category: template.category || 'other',
            createdBy: template.createdBy,
            description: template.description,
            teacherName: template.teacherName,
            studentCount: template.studentCount,
            forceOverride: template.forceOverride
          },
          action: 'overridden'
        });
      } catch (error) {
        console.error('予約削除エラー:', error);
      }
    }
    
    return {
      success: true,
      action: 'overridden',
      conflicts: conflictInfos
    };
  }

  /**
   * 既存予約を別の教室・時限に移動
   */
  private static async relocateOrRemove(
    template: WeeklyTemplate,
    conflicts: any[]
  ): Promise<ConflictResolutionResult> {
    const conflictInfos: ConflictInfo[] = [];
    
    for (const conflict of conflicts) {
      try {
        // 空いている教室・時限を探す
        const alternativeLocation = await this.findAlternativeLocation(
          conflict.startTime.toDate(),
          conflict.period,
          template.roomId
        );
        
        if (alternativeLocation) {
          // 移動可能な場合は移動
          await this.moveReservation(conflict, alternativeLocation);
          
          conflictInfos.push({
            date: toDateStr(conflict.startTime.toDate()),
            roomId: conflict.roomId,
            roomName: conflict.roomName,
            period: conflict.period,
            periodName: conflict.periodName,
            existingReservation: {
              id: conflict.id || '',
              title: conflict.title,
              reservationName: conflict.reservationName,
              createdBy: conflict.createdBy || ''
            },
            template: {
              id: template.id || '',
              name: template.name,
              roomId: template.roomId,
              weekday: template.weekday,
              periods: template.periods,
              startDate: template.startDate,
              endDate: template.endDate,
              enabled: template.enabled,
              priority: template.priority || 'normal',
              category: template.category || 'other',
              createdBy: template.createdBy,
              description: template.description,
              teacherName: template.teacherName,
              studentCount: template.studentCount,
              forceOverride: template.forceOverride
            },
            action: 'relocated',
            newLocation: alternativeLocation
          });
        } else {
          // 移動不可能な場合は削除
          if (conflict.id) {
            await reservationsService.deleteReservation(conflict.id);
          }
          
          conflictInfos.push({
            date: toDateStr(conflict.startTime.toDate()),
            roomId: conflict.roomId,
            roomName: conflict.roomName,
            period: conflict.period,
            periodName: conflict.periodName,
            existingReservation: {
              id: conflict.id || '',
              title: conflict.title,
              reservationName: conflict.reservationName,
              createdBy: conflict.createdBy || ''
            },
            template: {
              id: template.id || '',
              name: template.name,
              roomId: template.roomId,
              weekday: template.weekday,
              periods: template.periods,
              startDate: template.startDate,
              endDate: template.endDate,
              enabled: template.enabled,
              priority: template.priority || 'normal',
              category: template.category || 'other',
              createdBy: template.createdBy,
              description: template.description,
              teacherName: template.teacherName,
              studentCount: template.studentCount,
              forceOverride: template.forceOverride
            },
            action: 'overridden'
          });
        }
      } catch (error) {
        console.error('予約移動エラー:', error);
      }
    }
    
    return {
      success: true,
      action: 'relocated',
      conflicts: conflictInfos
    };
  }

  /**
   * 競合があればスキップ
   */
  private static async skipIfConflict(
    template: WeeklyTemplate,
    conflicts: any[]
  ): Promise<ConflictResolutionResult> {
    const conflictInfos: ConflictInfo[] = conflicts.map(conflict => ({
      date: toDateStr(conflict.startTime.toDate()),
      roomId: conflict.roomId,
      roomName: conflict.roomName,
      period: conflict.period,
      periodName: conflict.periodName,
      existingReservation: {
        id: conflict.id || '',
        title: conflict.title,
        reservationName: conflict.reservationName,
        createdBy: conflict.createdBy || ''
      },
      template: {
        id: template.id || '',
        name: template.name,
        roomId: template.roomId,
        weekday: template.weekday,
        periods: template.periods,
        startDate: template.startDate,
        endDate: template.endDate,
        enabled: template.enabled,
        priority: template.priority || 'normal',
        category: template.category || 'other',
        createdBy: template.createdBy,
        description: template.description,
        teacherName: template.teacherName,
        studentCount: template.studentCount,
        forceOverride: template.forceOverride
      },
      action: 'skipped'
    }));
    
    return {
      success: conflicts.length === 0,
      action: 'skipped',
      conflicts: conflictInfos
    };
  }

  /**
   * 代替の教室・時限を探す
   */
  private static async findAlternativeLocation(
    date: Date,
    period: string,
    excludeRoomId: string
  ): Promise<{ roomId: string; roomName: string; period: string } | null> {
    try {
      // 全教室を取得
      const roomsSnapshot = await getDocs(collection(db, COLLECTIONS.ROOMS));
      const rooms = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '不明な教室',
        ...doc.data()
      })) as { id: string; name: string; [key: string]: any }[];
      
      // 指定された教室以外で利用可能な教室を探す
      for (const room of rooms) {
        if (room.id === excludeRoomId) continue;
        
        // その教室・時限が利用可能かチェック
        const isAvailable = await this.isPeriodAvailable(
          toDateStr(date),
          room.id,
          period
        );
        
        if (isAvailable) {
          return {
            roomId: room.id,
            roomName: room.name,
            period
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('代替場所検索エラー:', error);
      return null;
    }
  }

  /**
   * 指定された教室・時限が利用可能かチェック
   */
  private static async isPeriodAvailable(
    dateStr: string,
    roomId: string,
    period: string
  ): Promise<boolean> {
    try {
      const slotSnap = await getDocs(query(
        collection(db, COLLECTIONS.RESERVATION_SLOTS),
        where('roomId', '==', roomId),
        where('date', '==', dateStr),
        where('period', '==', period)
      ));
      
      return slotSnap.empty;
    } catch (error) {
      console.error('利用可能性チェックエラー:', error);
      return false;
    }
  }

  /**
   * 予約を移動
   */
  private static async moveReservation(
    reservation: any,
    newLocation: { roomId: string; roomName: string; period: string }
  ): Promise<void> {
    try {
      // 既存予約を更新
      if (reservation.id) {
        await reservationsService.updateReservation(reservation.id, {
          roomId: newLocation.roomId,
          roomName: newLocation.roomName,
          period: newLocation.period,
          periodName: displayLabel(newLocation.period)
        });
      }
    } catch (error) {
      console.error('予約移動エラー:', error);
      throw error;
    }
  }
}
