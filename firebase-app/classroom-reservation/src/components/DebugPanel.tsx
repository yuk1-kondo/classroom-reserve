// デバッグ用コンポーネント - Firebaseデータ確認・初期化
import React, { useState, useEffect } from 'react';
import { roomsService, reservationsService } from '../firebase/firestore';
import { migrationService } from '../firebase/migration';
import { simpleInitializeRooms, testFirebaseConnection } from '../firebase/simpleInit';

export const DebugPanel: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // データを取得
  const loadData = async () => {
    setLoading(true);
    try {
      console.log('🔍 データ確認開始...');
      
      // 教室データ取得
      const roomsData = await roomsService.getAllRooms();
      setRooms(roomsData);
      console.log('📚 教室データ:', roomsData);
      
      // 予約データ取得（今月）
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const reservationsData = await reservationsService.getReservations(startOfMonth, endOfMonth);
      setReservations(reservationsData);
      console.log('📅 予約データ:', reservationsData);
      
      setStatus(`✅ データ取得完了: 教室${roomsData.length}件、予約${reservationsData.length}件`);
    } catch (error) {
      console.error('❌ データ取得エラー:', error);
      setStatus('❌ データ取得エラー: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 初期化
  const initializeData = async () => {
    if (!window.confirm('データを初期化しますか？（既存データは削除されます）')) {
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔄 データ初期化開始...');
      await migrationService.fullInitialization();
      setStatus('✅ データ初期化完了');
      
      // データを再取得
      await loadData();
    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      setStatus('❌ 初期化エラー: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 全予約データ削除
  const deleteAllReservations = async () => {
    if (!window.confirm('全ての予約データを削除しますか？\n（この操作は取り消せません）')) {
      return;
    }
    
    setLoading(true);
    setStatus('🗑️ 全予約削除中...');
    try {
      console.log('🗑️ 全予約データ削除開始...');
      
      await migrationService.deleteAllReservations();
      
      setStatus('✅ 全予約データ削除完了');
      
      // データを再取得
      await loadData();
    } catch (error) {
      console.error('❌ 予約削除エラー:', error);
      const errorMessage = '❌ 予約削除エラー: ' + (error as Error).message;
      setStatus(errorMessage);
      
      alert(`予約削除エラー:\n${(error as Error).message}\n\nブラウザのコンソール（F12）でより詳細なエラーを確認できます。`);
    } finally {
      setLoading(false);
    }
  };

  // 完全リセット（教室+予約）
  const fullReset = async () => {
    if (!window.confirm('全データ（教室・予約）を完全にリセットしますか？\n教室は新しい21室で初期化されます。\n（この操作は取り消せません）')) {
      return;
    }
    
    setLoading(true);
    setStatus('🔄 完全リセット中...');
    try {
      console.log('🔄 完全リセット開始...');
      
      await migrationService.fullReset();
      
      setStatus('✅ 完全リセット完了（教室21室・予約0件）');
      
      // データを再取得
      await loadData();
    } catch (error) {
      console.error('❌ 完全リセットエラー:', error);
      const errorMessage = '❌ 完全リセットエラー: ' + (error as Error).message;
      setStatus(errorMessage);
      
      alert(`完全リセットエラー:\n${(error as Error).message}\n\nブラウザのコンソール（F12）でより詳細なエラーを確認できます。`);
    } finally {
      setLoading(false);
    }
  };

  // 教室データリセット・再初期化
  const resetRooms = async () => {
    if (!window.confirm('教室データを完全にリセットして、新しい21室のデータで初期化しますか？\n（既存の教室データは全て削除されます）')) {
      return;
    }
    
    setLoading(true);
    setStatus('🏫 教室データリセット中...');
    try {
      console.log('🏫 教室データリセット・再初期化開始...');
      
      // リセット・再初期化実行
      await migrationService.resetAndInitializeRooms();
      
      setStatus('✅ 教室データリセット・再初期化完了（21室）');
      
      // データを再取得
      await loadData();
    } catch (error) {
      console.error('❌ 教室リセットエラー:', error);
      const errorMessage = '❌ 教室リセットエラー: ' + (error as Error).message;
      setStatus(errorMessage);
      
      alert(`教室リセットエラー:\n${(error as Error).message}\n\nブラウザのコンソール（F12）でより詳細なエラーを確認できます。`);
    } finally {
      setLoading(false);
    }
  };

  // 教室のみ初期化
  const initializeRooms = async () => {
    setLoading(true);
    setStatus('🏫 教室データ初期化中...');
    try {
      console.log('🏫 教室データ初期化開始...');
      
      // Firebase接続テスト
      console.log('🔥 Firebase接続テスト...');
      await roomsService.getAllRooms();
      console.log('✅ Firebase接続確認完了');
      
      // 初期化実行
      console.log('📋 Migration Service呼び出し...');
      await migrationService.initializeRooms();
      console.log('✅ Migration Service完了');
      
      setStatus('✅ 教室データ初期化完了');
      
      // データを再取得
      await loadData();
    } catch (error) {
      console.error('❌ 教室初期化エラー:', error);
      const errorMessage = '❌ 教室初期化エラー: ' + (error as Error).message;
      setStatus(errorMessage);
      
      // エラーの詳細をアラートで表示
      alert(`教室初期化エラー:\n${(error as Error).message}\n\nブラウザのコンソール（F12）でより詳細なエラーを確認できます。`);
    } finally {
      setLoading(false);
    }
  };

  // 簡単初期化
  const simpleInit = async () => {
    setLoading(true);
    setStatus('🚀 簡単初期化中...');
    try {
      console.log('🚀 簡単初期化開始...');
      
      // Firebase接続テスト
      const connectionTest = await testFirebaseConnection();
      if (!connectionTest.success) {
        throw new Error('Firebase接続エラー: ' + connectionTest.error);
      }
      console.log('✅ Firebase接続確認:', connectionTest.count + '件の既存データ');
      
      // 簡単教室初期化
      const roomCount = await simpleInitializeRooms();
      console.log('✅ 簡単初期化完了:', roomCount + '件の教室を追加');
      
      setStatus(`✅ 簡単初期化完了: ${roomCount}件の教室を追加`);
      
      // データを再取得
      await loadData();
      
      alert('🎉 簡単初期化が完了しました！5つの教室が追加されました。');
    } catch (error) {
      console.error('❌ 簡単初期化エラー:', error);
      const errorMessage = '❌ 簡単初期化エラー: ' + (error as Error).message;
      setStatus(errorMessage);
      
      alert(`簡単初期化エラー:\n${(error as Error).message}\n\nFirebase設定を確認してください。`);
    } finally {
      setLoading(false);
    }
  };

  // Firebase接続テストのみ
  const testConnection = async () => {
    setLoading(true);
    setStatus('🔥 Firebase接続テスト中...');
    try {
      const result = await testFirebaseConnection();
      if (result.success) {
        setStatus(`✅ Firebase接続成功: ${result.count}件のデータ確認`);
      } else {
        setStatus(`❌ Firebase接続失敗: ${result.error}`);
      }
    } catch (error) {
      setStatus('❌ 接続テストエラー: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      left: '10px', 
      background: 'white', 
      border: '2px solid #ddd', 
      padding: '15px', 
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1000,
      minWidth: '300px',
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#333', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setIsCollapsed(!isCollapsed)}>
        🔧 Firebase デバッグ 
        <span style={{ fontSize: '14px' }}>{isCollapsed ? '▶' : '▼'}</span>
      </h3>
      
      {!isCollapsed && (
        <React.Fragment>
      <div style={{ marginBottom: '15px', fontSize: '12px', color: '#666' }}>
        {status}
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={testConnection}
          disabled={loading}
          style={{
            padding: '8px 12px',
            margin: '2px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {loading ? '接続中...' : '🔥 接続テスト'}
        </button>
        
        <button 
          onClick={simpleInit}
          disabled={loading}
          style={{
            padding: '8px 12px',
            margin: '2px',
            backgroundColor: '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {loading ? '初期化中...' : '🚀 簡単初期化'}
        </button>
        
        <button 
          onClick={loadData}
          disabled={loading}
          style={{
            padding: '8px 12px',
            margin: '2px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {loading ? '読み込み中...' : '🔍 データ確認'}
        </button>
        
        <button 
          onClick={resetRooms}
          disabled={loading}
          style={{
            padding: '8px 12px',
            margin: '2px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {loading ? 'リセット中...' : '🔄 教室リセット(21室)'}
        </button>
        
        <button 
          onClick={initializeRooms}
          disabled={loading}
          style={{
            padding: '8px 12px',
            margin: '2px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          🏫 教室初期化
        </button>
        
        <button 
          onClick={deleteAllReservations}
          disabled={loading}
          style={{
            padding: '8px 12px',
            margin: '2px',
            backgroundColor: '#fd7e14',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {loading ? '削除中...' : '🗑️ 予約全削除'}
        </button>
        
        <button 
          onClick={fullReset}
          disabled={loading}
          style={{
            padding: '8px 12px',
            margin: '2px',
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          {loading ? 'リセット中...' : '🔄 完全リセット'}
        </button>
        
        <button 
          onClick={initializeData}
          disabled={loading}
          style={{
            padding: '8px 12px',
            margin: '2px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '12px'
          }}
        >
          🔄 完全初期化
        </button>
      </div>
      
      <div style={{ fontSize: '12px' }}>
        <div style={{ marginBottom: '10px' }}>
          <strong>📚 教室データ ({rooms.length}件):</strong>
          {rooms.length > 0 ? (
            <ul style={{ margin: '5px 0', paddingLeft: '15px', maxHeight: '100px', overflowY: 'auto' }}>
              {rooms.map((room, index) => (
                <li key={room.id || index} style={{ marginBottom: '2px' }}>
                  {room.name} (定員: {room.capacity})
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#999', fontStyle: 'italic' }}>データなし</div>
          )}
        </div>
        
        <div>
          <strong>📅 予約データ ({reservations.length}件):</strong>
          {reservations.length > 0 ? (
            <ul style={{ margin: '5px 0', paddingLeft: '15px', maxHeight: '100px', overflowY: 'auto' }}>
              {reservations.slice(0, 3).map((reservation, index) => (
                <li key={reservation.id || index} style={{ marginBottom: '2px' }}>
                  {reservation.roomName}: {reservation.title}
                </li>
              ))}
              {reservations.length > 3 && (
                <li style={{ color: '#999' }}>...他 {reservations.length - 3}件</li>
              )}
            </ul>
          ) : (
            <div style={{ color: '#999', fontStyle: 'italic' }}>データなし</div>
          )}
        </div>
      </div>
        </React.Fragment>
      )}
    </div>
  );
};

export default DebugPanel;
