// 予約データのみを削除するスクリプト（教室データは保持）
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from './config';

// 予約データのみを削除する関数
export const deleteAllReservations = async () => {
  try {
    console.log('🗑️ 予約データの削除を開始...');
    
    // 予約コレクションを取得
    const reservationsSnapshot = await getDocs(collection(db, 'reservations'));
    
    if (reservationsSnapshot.empty) {
      console.log('📭 削除する予約データがありません');
      return { success: true, message: '予約データは存在しません' };
    }
    
    console.log(`📋 ${reservationsSnapshot.size}件の予約データを発見`);
    
    // 各予約を削除
    let deletedCount = 0;
    for (const reservationDoc of reservationsSnapshot.docs) {
      try {
        await deleteDoc(doc(db, 'reservations', reservationDoc.id));
        const data = reservationDoc.data();
        console.log(`✅ 予約削除: ${data.title || '無題'} (${data.roomName || '不明な教室'})`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ 予約削除エラー [${reservationDoc.id}]:`, error);
      }
    }
    
    console.log(`🎉 予約データ削除完了！ ${deletedCount}件削除`);
    return { 
      success: true, 
      message: `${deletedCount}件の予約データを削除しました`,
      deletedCount 
    };
    
  } catch (error) {
    console.error('❌ 予約データ削除エラー:', error);
    return { success: false, error };
  }
};

// 教室データの存在確認（削除しないことを確認）
export const checkRoomsData = async () => {
  try {
    const roomsSnapshot = await getDocs(collection(db, 'rooms'));
    console.log(`📚 教室データ確認: ${roomsSnapshot.size}件の教室が存在`);
    
    roomsSnapshot.docs.forEach(roomDoc => {
      const data = roomDoc.data();
      console.log(`🏫 教室: ${data.name} (${data.description})`);
    });
    
    return { success: true, roomCount: roomsSnapshot.size };
  } catch (error) {
    console.error('❌ 教室データ確認エラー:', error);
    return { success: false, error };
  }
};

// 安全な削除実行（教室データ保護付き）
export const safeDeleteReservations = async () => {
  try {
    console.log('🔒 安全な予約削除を開始...');
    
    // 1. 教室データの存在確認
    const roomCheck = await checkRoomsData();
    if (!roomCheck.success) {
      throw new Error('教室データの確認に失敗しました');
    }
    
    // 2. 予約データのみ削除
    const deleteResult = await deleteAllReservations();
    
    // 3. 削除後の教室データ確認
    const roomCheckAfter = await checkRoomsData();
    if (!roomCheckAfter.success || roomCheckAfter.roomCount === 0) {
      console.error('⚠️ 警告: 教室データが削除された可能性があります！');
    }
    
    return deleteResult;
    
  } catch (error) {
    console.error('❌ 安全削除エラー:', error);
    return { success: false, error };
  }
};

// 手動実行用
export const executeReservationCleanup = () => {
  console.log('🧹 予約データクリーンアップを実行...');
  safeDeleteReservations();
};
