// 日別予約表示テーブルコンポーネント
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { 
  Room, 
  Reservation,
  createDateTimeFromPeriod,
  reservationsService
} from '../firebase/firestore';
import { useReservationDataContext } from '../contexts/ReservationDataContext';
import { useMonthlyReservations } from '../contexts/MonthlyReservationsContext';
import { dayRange, toDateStr } from '../utils/dateRange';
import { Timestamp } from 'firebase/firestore';
import './DailyReservationTable.css';
import { formatPeriodDisplay, displayLabel } from '../utils/periodLabel'; // 追加
import { getPeriodOrderForDate } from '../utils/periods';
import { authService } from '../firebase/auth';
import { useAuth } from '../hooks/useAuth';
import { systemSettingsService } from '../firebase/settings';
import PasscodeModal from './PasscodeModal';
import { isPasscodeDeletableRoom } from '../utils/passcodeDeletableRooms';

interface DailyReservationTableProps {
  selectedDate?: string;
  showWhenEmpty?: boolean; // 追加: 空でも表示
  onDateChange?: (dateStr: string) => void;
  filterMine?: boolean;
  onFilterMineChange?: (v: boolean) => void;
}

interface RoomReservationStatus {
  room: Room;
  reservations: Reservation[];
  isEmpty: boolean;
}

export const DailyReservationTable: React.FC<DailyReservationTableProps> = ({
  selectedDate,
  showWhenEmpty = false,
  onDateChange,
  filterMine: propFilterMine,
  onFilterMineChange
}) => {
  const { isAdmin } = useAuth();
  const { rooms, reservations: reservationsFromCtx } = useReservationDataContext();
  const { reservations: monthlyReservations, refetch: refetchMonthly } = useMonthlyReservations();
  const [roomStatuses, setRoomStatuses] = useState<RoomReservationStatus[]>([]);
  const [sortedReservations, setSortedReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [filterRoomId, setFilterRoomId] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const filterMine = propFilterMine ?? false;
  const [activeTab, setActiveTab] = useState<'reserved'|'available'>('reserved');
  const [availableRows, setAvailableRows] = useState<Array<{roomId:string; roomName:string; period:string; periodName:string; start:Date; end:Date}>>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // パスコード関連の状態
  const [meetingRoomPasscode, setMeetingRoomPasscode] = useState<string | null>(null);
  const [passcodeLoading, setPasscodeLoading] = useState(true);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeTargetReservation, setPasscodeTargetReservation] = useState<Reservation | null>(null);
  // 教室リストのソート（useMemoで最適化）
  const sortedRooms = React.useMemo(() => {
    const customOrder = [
      'サテライト',
      '会議室',
      '図書館',
      '社会科教室',
      'グローバル教室①',
      'グローバル教室②',
      'LL教室',
      '小演習室1',
      '小演習室2',
      '小演習室3',
      '小演習室4',
      '小演習室5',
      '小演習室6',
      '大演習室1',
      '大演習室2',
      '大演習室3',
      '大演習室4',
      'モノラボ',
      '視聴覚教室',
      '多目的室'
    ];
    return [...rooms].sort((a,b)=>{
      const ia = customOrder.indexOf(a.name);
      const ib = customOrder.indexOf(b.name);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [rooms]);

  // 会議室・図書館削除用パスコードを取得
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setPasscodeLoading(true);
        const settings = await systemSettingsService.get();
        if (!mounted) return;
        setMeetingRoomPasscode(settings?.meetingRoomDeletePasscode || null);
      } catch (e) {
        console.error('パスコード取得エラー:', e);
      } finally {
        if (mounted) setPasscodeLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const selectedDateInputValue = React.useMemo(() => {
    if (!selectedDate) return '';
    const v = String(selectedDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    try {
      return toDateStr(new Date(v));
    } catch {
      return v.slice(0, 10);
    }
  }, [selectedDate]);

  // rooms はコンテキストから供給される
  const dateFieldId = React.useId();
  const roomFieldId = React.useId();
  const periodFieldId = React.useId();
  const mineCheckboxId = React.useId();
  const filtersActive = filterRoomId !== 'all' || filterPeriod !== 'all' || filterMine;

  const handleResetFilters = useCallback(() => {
    setFilterRoomId('all');
    setFilterPeriod('all');
    if (onFilterMineChange) {
      onFilterMineChange(false);
    }
  }, [onFilterMineChange]);

  const activeFilterChips = React.useMemo(() => {
    const chips: string[] = [];
    if (filterRoomId !== 'all') {
      const targetRoom = sortedRooms.find(r => String(r.id) === String(filterRoomId));
      chips.push(`教室: ${targetRoom?.name || '指定'}`);
    }
    if (filterPeriod !== 'all') {
      chips.push(`時限: ${displayLabel(String(filterPeriod))}`);
    }
    if (filterMine) {
      chips.push('自分の予約のみ');
    }
    return chips;
  }, [filterRoomId, filterPeriod, filterMine, sortedRooms]);

  // 当日の最新を即時再構築（削除直後の反映用）
  const refreshDayNow = useCallback(async () => {
    if (!selectedDate || rooms.length === 0) return;
    try {
      const list = await reservationsService.getDayReservations(new Date(selectedDate));
      // mapWithOrder とフィルタは下のエフェクトと同等に適用
      const mapWithOrder = (reservation: Reservation) => {
        const room = rooms.find(r => r.id === reservation.roomId);
        let periodOrder = 0;
        if (reservation.period === 'lunch') {
          periodOrder = 4.5;
        } else if (reservation.period === 'after') {
          periodOrder = 999;
        } else {
          periodOrder = parseInt(reservation.period) || 0;
        }
        return { ...reservation, roomName: room?.name || '不明', periodOrder } as any;
      };
      const combined0 = list.map(mapWithOrder);
      const periodMatches = (reservationPeriod: string, target: string): boolean => {
        if (target === 'all') return true;
        const p = String(reservationPeriod || '');
        const t = String(target);
        if (p === t) return true;
        if (p.includes(',')) {
          const arr = p.split(',').map(s => s.trim()).filter(Boolean);
          return arr.includes(t);
        }
        if (/^\d+\s*-\s*\d+$/.test(p)) {
          const [a,b] = p.split('-').map(s=>parseInt(s.trim(),10));
          const x = parseInt(t,10);
          if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(x)) {
            const min = Math.min(a,b); const max = Math.max(a,b);
            return x >= min && x <= max;
          }
        }
        return false;
      };
      const current = authService.getCurrentUser();
      let combined = combined0.filter(r =>
        (filterRoomId === 'all' || r.roomId === filterRoomId) &&
        periodMatches(String(r.period), String(filterPeriod)) &&
        (!filterMine || (current && r.createdBy === current.uid))
      );
      combined.sort((a,b)=>{
        if (a.periodOrder !== b.periodOrder) return a.periodOrder - b.periodOrder;
        return a.roomName.localeCompare(b.roomName);
      });
      const statuses: RoomReservationStatus[] = [];
      rooms.forEach(room => {
        const rs = combined.filter(res => res.roomId === room.id);
        if (rs.length > 0) statuses.push({ room, reservations: rs as Reservation[], isEmpty: false });
      });
      statuses.sort((a,b)=>a.room.name.localeCompare(b.room.name));
      setRoomStatuses(statuses);
      setSortedReservations(combined);
      // availableRows は次のエフェクトの再実行で再計算される
    } catch {}
  }, [selectedDate, rooms, filterRoomId, filterPeriod, filterMine]);

  // 選択日の予約データを取得（予約本体のみ）
  useEffect(() => {
    if (!selectedDate || rooms.length === 0) {
      setRoomStatuses([]);
      return;
    }

    let cancelled = false;
    const loadDayReservations = async () => {
      // タイムアウト設定（15秒）
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          setLoading(false);
          setError('データの読み込みがタイムアウトしました。画面を更新してください。');
        }
      }, 15000);
      
      try {
        setLoading(true);
        setError('');
        
        // まずはキャッシュ由来で表示し、直後に当日だけFirestoreから最新取得で上書き
        const sourceDaily = Array.isArray(reservationsFromCtx) && reservationsFromCtx.length > 0
          ? reservationsFromCtx
          : Array.isArray(monthlyReservations) ? monthlyReservations : [];
        const { start: startOfDay, end: endOfDay } = dayRange(selectedDate);
        let allReservations = sourceDaily.filter(r => {
          const st = (r.startTime as any)?.toDate?.() || new Date(r.startTime as any);
          return st >= startOfDay && st <= endOfDay;
        });
        try {
          const list = await reservationsService.getDayReservations(new Date(selectedDate));
          allReservations = list;
        } catch {}
        if (cancelled) {
          clearTimeout(timeoutId);
          return;
        }

        // 教室名付与と時限順のための補助を統一的に付与（予約＋ロック）
        const mapWithOrder = (reservation: Reservation) => {
          const room = rooms.find(r => r.id === reservation.roomId);
          // 時限の並び順を数値化
          let periodOrder = 0;
          if (reservation.period === 'lunch') {
            periodOrder = 4.5; // 4限と5限の間
          } else if (reservation.period === 'after') {
            periodOrder = 999; // 最後
          } else {
            periodOrder = parseInt(reservation.period) || 0;
          }
          return {
            ...reservation,
            roomName: room?.name || '不明',
            periodOrder
          } as any;
        };

        // 予約（本体）のみ
        let combined = allReservations.map(mapWithOrder);

        // 単一/複数/範囲(ハイフン)を考慮して時限一致判定
        const periodMatches = (reservationPeriod: string, target: string): boolean => {
          if (target === 'all') return true;
          const p = String(reservationPeriod || '');
          const t = String(target);
          if (p === t) return true;
          // カンマ区切り
          if (p.includes(',')) {
            const list = p.split(',').map(s => s.trim()).filter(Boolean);
            return list.includes(t);
          }
          // ハイフン範囲 (例: 5-6)
          if (/^\d+\s*-\s*\d+$/.test(p)) {
            const [a, b] = p.split('-').map(s => parseInt(s.trim(), 10));
            const x = parseInt(t, 10);
            if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(x)) {
              const min = Math.min(a, b);
              const max = Math.max(a, b);
              return x >= min && x <= max;
            }
          }
          return false;
        };

        // 自分の予約のみ（reserved タブにのみ適用）
        const current = authService.getCurrentUser();

        // フィルター適用
        combined = combined.filter(r =>
          (filterRoomId === 'all' || r.roomId === filterRoomId) &&
          periodMatches(String(r.period), String(filterPeriod)) &&
          (!filterMine || (current && r.createdBy === current.uid))
        );

        // 時限順でソート
        combined.sort((a, b) => {
          if (a.periodOrder !== b.periodOrder) {
            return a.periodOrder - b.periodOrder;
          }
          // 同じ時限の場合は教室名でソート
          return a.roomName.localeCompare(b.roomName);
        });

        // 教室ごとの予約状況
        const statuses: RoomReservationStatus[] = [];
        rooms.forEach(room => {
          const roomReservations = combined.filter(res => res.roomId === room.id);
          if (roomReservations.length > 0) {
            statuses.push({ room, reservations: roomReservations as Reservation[], isEmpty: false });
          }
        });

        // 教室名でソート
        statuses.sort((a, b) => a.room.name.localeCompare(b.room.name));

        setRoomStatuses(statuses);
        // 時限順ソート済み（予約）の予約リストも保存
        setSortedReservations(combined);

        // 空き状況の計算（room × period ベース）
        const expand = (raw: string): string[] => {
          const p = String(raw || '');
          if (p.includes(',')) return p.split(',').map(s => s.trim()).filter(Boolean);
          if (/^\d+\s*-\s*\d+$/.test(p)) {
            const [a,b] = p.split('-').map(s=>parseInt(s.trim(),10));
            if (!Number.isNaN(a) && !Number.isNaN(b)) {
              const min = Math.min(a,b); const max = Math.max(a,b);
              const nums = [] as string[]; for (let x=min; x<=max; x++) nums.push(String(x));
              return nums;
            }
          }
          return [p];
        };

        const free: Array<{roomId:string; roomName:string; period:string; periodName:string; start:Date; end:Date}> = [];
        const baseDateStr = toDateStr(new Date(selectedDate));
        const periodList = getPeriodOrderForDate(baseDateStr) as readonly string[];
        for (const room of rooms) {
          if (filterRoomId !== 'all' && room.id !== filterRoomId) continue;
          for (const p of periodList) {
            if (filterPeriod !== 'all' && String(filterPeriod) !== String(p)) {
              // ただしフィルター時、available でも単一一致のみ対象
              continue;
            }
            const reservedHere = combined.some(r => r.roomId === room.id && expand(r.period).includes(String(p)));
            if (!reservedHere) {
              const dt = createDateTimeFromPeriod(baseDateStr, String(p));
              const startD = dt?.start || new Date(`${selectedDate}T00:00:00`);
              const endD = dt?.end || new Date(`${selectedDate}T23:59:59`);
              free.push({ roomId: String(room.id), roomName: room.name, period: String(p), periodName: dt?.periodName || displayLabel(String(p)), start: startD, end: endD });
            }
          }
        }
        // 並び替え: 時限→教室
        free.sort((a,b)=>{
          const ao = periodList.indexOf(a.period as any);
          const bo = periodList.indexOf(b.period as any);
          if (ao !== bo) return ao - bo;
          return a.roomName.localeCompare(b.roomName);
        });
        setAvailableRows(free);
      } catch (error) {
        console.error('予約データ取得エラー:', error);
        setError('予約データの取得に失敗しました');
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    };

    loadDayReservations();
    return () => { cancelled = true; if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, rooms, filterRoomId, filterPeriod, filterMine, refreshKey]);
  // reservationsFromCtx, monthlyReservationsは依存から除外（無限ループ防止）

  // 日付フォーマット
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  // 時刻フォーマット
  const formatTime = (timestamp: Timestamp): string => {
    const date = timestamp.toDate();
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const currentUser = authService.getCurrentUser();
  // 仕様変更（要望に合わせて更新）: 管理者（super/regular 共通）は誰の予約でも削除可
  // 会議室・図書館の場合、パスコードを知っている人も削除可能
  const canDeleteDirectly = (r: Reservation) => {
    if (isAdmin) return true;
    return currentUser && r.createdBy === currentUser.uid;
  };
  
  // パスコード削除が可能か
  const canDeleteWithPasscode = (r: Reservation) => {
    return !!currentUser && isPasscodeDeletableRoom(r.roomName) && !!meetingRoomPasscode && !passcodeLoading;
  };
  
  // 削除可能（直接削除またはパスコード削除）
  const canDeleteReservation = (r: Reservation) => {
    return canDeleteDirectly(r) || canDeleteWithPasscode(r);
  };
  
  // パスコード削除が必要かどうか
  const needsPasscodeForDelete = (r: Reservation) => {
    return !canDeleteDirectly(r) && canDeleteWithPasscode(r);
  };

  const handleInlineDelete = async (r: Reservation) => {
    if (!r.id) return;
    try {
      // まずUIから即時に除去（ネット待ちによるタイムラグを解消）
      setConfirmingId(null);
      const removedId = String(r.id);
      setSortedReservations(prev => prev.filter(x => String(x.id) !== removedId));
      setRoomStatuses(prev => {
        const next = prev.map(st => ({
          room: st.room,
          reservations: st.reservations.filter(x => String(x.id) !== removedId) as Reservation[],
          isEmpty: false
        })).filter(st => st.reservations.length > 0);
        return next.map(st => ({ ...st, isEmpty: st.reservations.length === 0 }));
      });

      // サーバー削除（整合のための正式処理）
      setLoading(true);
      await reservationsService.deleteReservation(r.id);
      // 月次キャッシュも更新
      try { await refetchMonthly(); } catch {}
      // 即時に当日の最新で再構築（確実即時反映）
      await refreshDayNow();
      // デバウンス付きの正式再読込（連続削除をまとめる）
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        setRefreshKey(v => v + 1);
      }, 500);
    } catch (e) {
      console.error('インライン削除失敗', e);
      toast.error('削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedDate) {
    return null;
  }
  if (roomStatuses.length === 0 && !showWhenEmpty) {
    return null; // 従来挙動
  }

  return (
    <div className="daily-reservation-table">
      <div className="table-header">
        <h4>📋 {formatDate(selectedDate)} の予約</h4>
        {/* フィルター（ヘッダー右側） */}
        <div className="filters" role="group" aria-label="予約フィルター">
          <div className="filter-field">
            <label htmlFor={dateFieldId}>日付</label>
            <input
              id={dateFieldId}
              type="date"
              value={selectedDateInputValue}
              onChange={e => onDateChange && onDateChange(e.target.value)}
            />
          </div>
          <div className="filter-field">
            <label htmlFor={roomFieldId}>教室</label>
            <select
              id={roomFieldId}
              value={filterRoomId}
              onChange={e => setFilterRoomId(e.target.value)}
            >
              <option value="all">すべて</option>
              {sortedRooms.map(r => (
                <option key={String(r.id)} value={String(r.id)}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label htmlFor={periodFieldId}>時限</label>
            <select
              id={periodFieldId}
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)}
            >
              <option value="all">すべて</option>
              {getPeriodOrderForDate(selectedDate).map(p => (
                <option key={String(p)} value={String(p)}>{displayLabel(String(p))}</option>
              ))}
            </select>
          </div>
          <div className="filter-checkbox">
            <input
              id={mineCheckboxId}
              className="filter-checkbox-input"
              type="checkbox"
              checked={filterMine}
              onChange={e => onFilterMineChange && onFilterMineChange(e.target.checked)}
            />
            <label htmlFor={mineCheckboxId}>自分の予約のみ</label>
          </div>
          <button
            type="button"
            className="filters-reset"
            onClick={handleResetFilters}
            disabled={!filtersActive}
          >
            フィルターをリセット
          </button>
        </div>
      </div>

      {filtersActive && (
        <div className="active-filters" role="status" aria-live="polite">
          {activeFilterChips.map((chip, index) => (
            <span key={`${chip}-${index}`} className="filter-chip">{chip}</span>
          ))}
        </div>
      )}

      {/* タブ */}
      <div className="subtabs tabs-padding">
        <button className={activeTab==='reserved'?'tab active':'tab'} onClick={()=>setActiveTab('reserved')}>予約状況</button>
        <button className={activeTab==='available'?'tab active':'tab'} onClick={()=>setActiveTab('available')}>空き状況</button>
      </div>

      {/* メッセージ行 */}
      {loading && <div className="loading-inline">読み込み中...</div>}
      {error && <div className="error-inline">{error}</div>}
      {!loading && !error && roomStatuses.length === 0 && (
        <div className="no-reservations-inline">予約はありません</div>
      )}

      <div className="table-scroll-container">
        <div className="table-wrapper">
          <table className="excel-table">
            <thead>
              <tr>
                <th className="col-period">時限</th>
                <th className="col-room">教室</th>
                <th className="col-time">時間</th>
                {activeTab==='reserved' && <th className="col-title">予約内容</th>}
                {activeTab==='reserved' && <th className="col-user">予約者</th>}
                {activeTab==='reserved' && <th className="col-actions">操作</th>}
              </tr>
            </thead>
            <tbody>
              {activeTab==='reserved' && sortedReservations.map((reservation, index) => {
                const timeStart = formatTime(reservation.startTime);
                const timeEnd = formatTime(reservation.endTime);
                const isMine = canDeleteReservation(reservation);
                const isConfirming = confirmingId === reservation.id;
                return (
                  <tr key={`${reservation.roomId}-${reservation.id || index}`}>
                    <td className="col-period"><span className="period-badge">{formatPeriodDisplay(reservation.period, reservation.periodName)}</span></td>
                    <td className="col-room"><div className="room-name">{reservation.roomName}</div></td>
                    <td className="col-time"><div className="time-range">{timeStart}-{timeEnd}</div></td>
                    <td className="col-title"><div className="reservation-title">{reservation.title}</div></td>
                    <td className="col-user"><div className="reservation-user">{reservation.reservationName}</div></td>
                    <td className="col-actions">
                      {isMine && !isConfirming && (
                        <button 
                          className="inline-delete-btn" 
                          onClick={() => {
                            if (needsPasscodeForDelete(reservation)) {
                              // パスコードが必要な場合はパスコードモーダルを表示
                              setPasscodeTargetReservation(reservation);
                              setShowPasscodeModal(true);
                            } else {
                              // 直接削除可能な場合は確認状態へ
                              setConfirmingId(reservation.id!);
                            }
                          }}
                        >
                          削除{needsPasscodeForDelete(reservation) ? '🔑' : ''}
                        </button>
                      )}
                      {isMine && isConfirming && (
                        <div className="inline-confirm">
                          <button className="confirm" onClick={()=>handleInlineDelete(reservation)}>確定</button>
                          <button className="cancel" onClick={()=>setConfirmingId(null)}>取消</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {activeTab==='available' && availableRows.map((row, idx) => {
                const timeStart = row.start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                const timeEnd = row.end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                return (
                  <tr key={`${row.roomId}-${row.period}-${idx}`}>
                    <td className="col-period"><span className="period-badge">{formatPeriodDisplay(row.period, row.periodName)}</span></td>
                    <td className="col-room"><div className="room-name">{row.roomName}</div></td>
                    <td className="col-time"><div className="time-range">{timeStart}-{timeEnd}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* パスコード入力モーダル */}
      <PasscodeModal
        isOpen={showPasscodeModal}
        onClose={() => {
          setShowPasscodeModal(false);
          setPasscodeTargetReservation(null);
        }}
        onSuccess={() => {
          setShowPasscodeModal(false);
          if (passcodeTargetReservation) {
            // パスコード認証成功後、確認状態へ移行
            setConfirmingId(passcodeTargetReservation.id!);
          }
          setPasscodeTargetReservation(null);
        }}
        correctPasscode={meetingRoomPasscode || ''}
        roomName={passcodeTargetReservation?.roomName}
      />
    </div>
  );
};

export default DailyReservationTable;
