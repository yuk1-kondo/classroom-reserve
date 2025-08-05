/***** 設定 *****/
var SPREADSHEET_ID = '18oK4-xjGWPAkcbRl9vKCyXC_aUOdpk-vdS5BlNXLOAM';
var TZ = 'Asia/Tokyo';

/***** 権限テスト用関数 *****/
function testPermissions() {
  console.log('権限テスト開始');
  try {
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('スプレッドシートアクセス成功:', spreadsheet.getName());
    return '成功: ' + spreadsheet.getName();
  } catch (e) {
    console.error('権限エラー:', e.toString());
    return 'エラー: ' + e.toString();
  }
}

/***** カレンダーアクセス診断機能 *****/
function testCalendarAccess() {
  console.log('カレンダーアクセス診断開始');
  var currentUser = getUserEmail();
  console.log('現在のユーザー:', currentUser);
  
  var rooms = getRooms();
  var results = [];
  
  rooms.forEach(function(room) {
    try {
      var calendar = CalendarApp.getCalendarById(room.calendarId);
      if (calendar) {
        results.push({
          room: room.name,
          calendarId: room.calendarId,
          status: '✅ アクセス可能',
          name: calendar.getName()
        });
      } else {
        results.push({
          room: room.name,
          calendarId: room.calendarId,
          status: '❌ カレンダーが見つかりません',
          name: null
        });
      }
    } catch (e) {
      results.push({
        room: room.name,
        calendarId: room.calendarId,
        status: '❌ アクセス拒否: ' + e.toString(),
        name: null
      });
    }
  });
  
  console.log('カレンダーアクセス診断結果:', results);
  return {
    user: currentUser,
    results: results
  };
}

/***** HTML 配信 *****/
function doGet() {
  return HtmlService.createTemplateFromFile('Views')
    .evaluate()
    .setTitle('教室予約システム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/***** 教室一覧取得（スプレッドシート版・復元） *****/
function getRooms() {
  try {
    console.log('getRooms開始 - スプレッドシートID:', SPREADSHEET_ID);
    console.log('探しているシート名: Rooms');
    
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('スプレッドシート取得成功:', spreadsheet.getName());
    
    // 全シート名を確認
    var allSheets = spreadsheet.getSheets();
    var sheetNames = allSheets.map(function(s) { return s.getName(); });
    console.log('利用可能なシート名:', sheetNames);
    
    var sheet = spreadsheet.getSheetByName('Rooms');
    if (!sheet) {
      // Roomsが見つからない場合、類似名を探す
      var alternativeSheet = null;
      for (var i = 0; i < allSheets.length; i++) {
        var name = allSheets[i].getName().toLowerCase();
        if (name.includes('room')) {
          alternativeSheet = allSheets[i];
          console.log('代替シートを発見:', allSheets[i].getName());
          break;
        }
      }
      
      if (alternativeSheet) {
        sheet = alternativeSheet;
      } else {
        throw new Error('シート "Rooms" が見つかりません。利用可能なシート: ' + sheetNames.join(', '));
      }
    }
    
    console.log('使用するシート:', sheet.getName());
    
    var values = sheet.getDataRange().getValues();
    console.log('取得した全データ:', values.length + '行');
    
    if (values.length === 0) {
      throw new Error('シートにデータがありません');
    }
    
    var headers = values.shift().map(function(h) { 
      return h.includes(':') ? String(h).split(':')[1].trim() : String(h).trim(); 
    });
    console.log('取得したヘッダー:', headers);

    var col = {
      id: headers.indexOf('id'),
      name: headers.indexOf('name'),
      calendarId: headers.indexOf('calendarId'),
      openTo: headers.indexOf('openTo'),
      enabled: headers.indexOf('enabled')
    };

    console.log('列位置:', col);

    if (col.name === -1 || col.calendarId === -1) {
      throw new Error('スプレッドシートに "name" または "calendarId" の列ヘッダーが必要です。現在のヘッダー: ' + headers.join(', '));
    }

    var rooms = values.map(function(row, index) {
      console.log('行' + (index + 2) + 'データ:', row);
      
      var room = {
        id: col.id !== -1 ? row[col.id] : null,
        name: row[col.name],
        calendarId: row[col.calendarId],
        openTo: col.openTo !== -1 && row[col.openTo] ? formatSheetTime(row[col.openTo]) : '18:30'
      };
      
      console.log('変換後の教室オブジェクト:', room);
      return room;
    }).filter(function(room) {
      var isValid = room && room.name && room.calendarId;
      console.log('教室判定:', room ? room.name : 'null', 'isValid:', isValid);
      return isValid;
    });
    
    console.log('最終的な教室取得成功:', rooms.length + '件');
    console.log('教室リスト:', rooms);
    return rooms;
  } catch (e) {
    console.error('教室取得エラー詳細:', e.toString());
    console.error('エラースタック:', e.stack || 'スタック情報なし');
    return [];
  }
}

// スプレッドシートの時刻書式（Dateオブジェクト）を "HH:mm" 形式の文字列に変換
function formatSheetTime(timeValue) {
  if (timeValue instanceof Date) {
    return Utilities.formatDate(timeValue, TZ, 'HH:mm');
  }
  return timeValue.toString(); // すでに文字列ならそのまま返す
}

/***** ユーザー情報 *****/
function getUserEmail() {
  return Session.getActiveUser().getEmail();
}

/***** 初期データ *****/
function getInitData() {
  console.log('getInitData開始');
  
  try {
    var user = getUserEmail();
    console.log('ユーザー取得成功:', user);
    
    var rooms = getRooms();
    console.log('教室取得成功:', rooms ? rooms.length : '0', '件');
    
    var result = {
      user: user,
      rooms: rooms
    };
    
    console.log('初期データ準備完了 - ユーザー:', user, '教室数:', rooms.length);
    return result;
    
  } catch (e) {
    console.error('getInitData エラー詳細:', e.toString());
    console.error('エラースタック:', e.stack || 'スタック情報なし');
    
    // エラー情報を含むレスポンスを返す
    return {
      error: true,
      message: e.toString(),
      user: null,
      rooms: []
    };
  }
}

/***** イベント一覧取得（Googleカレンダー版） *****/
function getEvents(calendarId, startDate, endDate) {
  console.log('getEvents開始（Googleカレンダー版）:', calendarId, startDate, endDate);
  
  try {
    // テストカレンダーIDの場合はダミーデータを返す
    if (calendarId.startsWith('test-calendar-')) {
      console.log('テストカレンダーID検出、ダミーデータを返却');
      var events = [];
      
      if (calendarId === 'test-calendar-1@group.calendar.google.com') {
        events.push({
          id: 'test-event-1',
          title: 'テスト予約（小練習室1）',
          start: startDate,
          end: endDate
        });
      } else if (calendarId === 'test-calendar-3@group.calendar.google.com') {
        events.push({
          id: 'test-event-3',
          title: 'テスト予約（大練習室1）',
          start: startDate,
          end: endDate
        });
      }
      
      return {
        success: true,
        events: events
      };
    }
    
    // 実際のGoogleカレンダーからイベントを取得
    var calendar;
    try {
      calendar = CalendarApp.getCalendarById(calendarId);
    } catch (e) {
      console.error('カレンダー取得エラー:', e.toString());
      // カレンダーが見つからない場合の詳細ログ
      console.log('アクセス試行カレンダーID:', calendarId);
      console.log('現在のユーザー:', getUserEmail());
      
      return {
        success: false,
        error: 'カレンダーにアクセスできません。管理者にカレンダーの共有設定を確認してもらってください。カレンダーID: ' + calendarId,
        events: []
      };
    }
    
    if (!calendar) {
      console.error('カレンダーが見つかりません:', calendarId);
      return {
        success: false,
        error: 'カレンダーが見つかりません: ' + calendarId,
        events: []
      };
    }
    
    var start = new Date(startDate);
    var end = new Date(endDate);
    
    console.log('カレンダーイベント検索:', start, 'から', end);
    var calendarEvents = calendar.getEvents(start, end);
    
    var events = calendarEvents.map(function(event) {
      return {
        id: event.getId(),
        title: event.getTitle(),
        start: Utilities.formatDate(event.getStartTime(), TZ, 'yyyy-MM-dd\'T\'HH:mm:ss'),
        end: Utilities.formatDate(event.getEndTime(), TZ, 'yyyy-MM-dd\'T\'HH:mm:ss'),
        description: event.getDescription() || ''
      };
    });
    
    console.log('イベント取得成功:', events.length + '件');
    return {
      success: true,
      events: events
    };
    
  } catch (e) {
    console.error('イベント取得エラー:', e.toString());
    return {
      success: false,
      error: e.toString(),
      events: []
    };
  }
}

/***** 予約作成（Googleカレンダー版） *****/
function createReservation(calendarId, title, startDateTime, endDateTime) {
  console.log('createReservation開始（Googleカレンダー版）:', calendarId, title, startDateTime, endDateTime);
  
  try {
    // テストカレンダーIDの場合はダミーレスポンスを返す
    if (calendarId.startsWith('test-calendar-')) {
      console.log('テストカレンダーID検出、ダミーレスポンスを返却');
      return {
        success: true,
        eventId: 'test-event-' + Date.now(),
        message: 'テスト予約が作成されました'
      };
    }
    
    // 実際のGoogleカレンダーにイベントを作成
    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      console.error('カレンダーが見つかりません:', calendarId);
      return {
        success: false,
        error: 'カレンダーが見つかりません: ' + calendarId
      };
    }
    
    var startTime = new Date(startDateTime);
    var endTime = new Date(endDateTime);
    
    console.log('イベント作成:', title, startTime, 'から', endTime);
    
    // 重複チェック（既存のイベントと時間が重複していないか）
    var existingEvents = calendar.getEvents(startTime, endTime);
    if (existingEvents.length > 0) {
      console.log('時間重複検出:', existingEvents.length + '件');
      return {
        success: false,
        error: 'この時間帯は既に予約されています'
      };
    }
    
    // イベント作成
    var event = calendar.createEvent(title, startTime, endTime, {
      description: '教室予約システムにより作成\n作成者: ' + getUserEmail()
    });
    
    console.log('イベント作成成功:', event.getId());
    return {
      success: true,
      eventId: event.getId(),
      message: '予約が正常に作成されました'
    };
    
  } catch (e) {
    console.error('予約作成エラー:', e.toString());
    return {
      success: false,
      error: '予約作成に失敗しました: ' + e.toString()
    };
  }
}

/***** 予約削除（Googleカレンダー版） *****/
function deleteReservation(calendarId, eventId) {
  console.log('deleteReservation開始（Googleカレンダー版）:', calendarId, eventId);
  
  try {
    // テストカレンダーIDの場合はダミーレスポンスを返す
    if (calendarId.startsWith('test-calendar-') || eventId.startsWith('test-event-')) {
      console.log('テストカレンダー/イベントID検出、ダミーレスポンスを返却');
      return {
        success: true,
        message: 'テスト予約が削除されました'
      };
    }
    
    // 実際のGoogleカレンダーからイベントを削除
    var calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      console.error('カレンダーが見つかりません:', calendarId);
      return {
        success: false,
        error: 'カレンダーが見つかりません: ' + calendarId
      };
    }
    
    var event = calendar.getEventById(eventId);
    if (!event) {
      console.error('イベントが見つかりません:', eventId);
      return {
        success: false,
        error: 'イベントが見つかりません: ' + eventId
      };
    }
    
    console.log('イベント削除:', event.getTitle());
    event.deleteEvent();
    
    console.log('イベント削除成功:', eventId);
    return {
      success: true,
      message: '予約が正常に削除されました'
    };
    
  } catch (e) {
    console.error('予約削除エラー:', e.toString());
    return {
      success: false,
      error: '予約削除に失敗しました: ' + e.toString()
    };
  }
}
