/***** 設定 *****/
var SPREADSHEET_ID = '1z9lEV0O5rjyceix5kMAelIPV5ekaKOPRqti8Ht9ZnCs';
var SHEET_ROOMS = 'Rooms';
var SHEET_PERIODS = 'Periods';
var SHEET_LOGS = 'Logs';
var TZ = 'Asia/Tokyo';

/***** HTML 配信 *****/
function doGet() {
  return HtmlService.createTemplateFromFile('Views')
    .evaluate()
    .setTitle('教室予約システム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/***** 教室一覧取得（テスト用ハードコード版） *****/
function getRooms() {
  console.log('getRooms開始（ハードコード版）');
  
  var rooms = [
    {
      id: 's_practice_01',
      name: '小練習室1',
      calendarId: 'test-calendar-1@group.calendar.google.com',
      openTo: '18:30'
    },
    {
      id: 's_practice_02', 
      name: '小練習室2',
      calendarId: 'test-calendar-2@group.calendar.google.com',
      openTo: '18:30'
    },
    {
      id: 'l_practice_01',
      name: '大練習室1',
      calendarId: 'test-calendar-3@group.calendar.google.com', 
      openTo: '18:30'
    }
  ];
  
  console.log('ハードコード教室データ返却:', rooms.length + '件');
  return rooms;
}

/***** ユーザー情報 *****/
function getUserEmail() {
  return Session.getActiveUser().getEmail();
}

/***** 初期データ *****/
function getInitData() {
  console.log('getInitData開始');
  var user = getUserEmail();
  var rooms = getRooms();
  
  console.log('初期データ準備完了 - ユーザー:', user, '教室数:', rooms.length);
  
  return {
    user: user,
    rooms: rooms
  };
}

/***** イベント一覧取得（ダミー版） *****/
function getEvents(calendarId, startDate, endDate) {
  console.log('getEvents開始（ダミー版）:', calendarId, startDate, endDate);
  
  // テスト用のダミーイベント
  return {
    success: true,
    events: [
      {
        id: 'test-event-1',
        title: 'テスト予約',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString()
      }
    ]
  };
}

/***** 予約作成（ダミー版） *****/
function createReservation(calendarId, title, startDateTime, endDateTime) {
  console.log('createReservation開始（ダミー版）:', calendarId, title, startDateTime, endDateTime);
  
  return {
    success: true,
    eventId: 'test-event-' + Date.now()
  };
}

/***** 予約削除（ダミー版） *****/
function deleteReservation(calendarId, eventId) {
  console.log('deleteReservation開始（ダミー版）:', calendarId, eventId);
  
  return {
    success: true
  };
}
