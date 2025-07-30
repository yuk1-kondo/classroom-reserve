/***** 最小限の教室予約システム *****/
var TZ = 'Asia/Tokyo';

/***** HTML 配信 *****/
function doGet() {
  return HtmlService.createTemplateFromFile('Views')
    .evaluate()
    .setTitle('教室予約（シンプル版）')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/***** ユーザー情報 *****/
function getUserEmail() {
  return Session.getActiveUser().getEmail();
}

/***** カレンダー一覧取得（デバッグ用） *****/
function listAllCalendars() {
  var calendars = CalendarApp.getAllCalendars();
  var result = [];
  
  for (var i = 0; i < calendars.length; i++) {
    var cal = calendars[i];
    result.push({
      name: cal.getName(),
      id: cal.getId(),
      description: cal.getDescription(),
      isOwnedByMe: cal.isOwnedByMe()
    });
  }
  
  console.log('利用可能なカレンダー:', result);
  return result;
}

/***** 初期データ *****/
function getInitData() {
  return {
    user: getUserEmail(),
    rooms: [
      // 自分のメインカレンダーを使用する場合
      { id: 'room1', name: '会議室A', calendarId: getUserEmail() },
      
      // 共有カレンダーを作成して使用する場合（例）
      // { id: 'room2', name: '会議室B', calendarId: 'abc123@group.calendar.google.com' }
    ]
  };
}

/***** イベント一覧取得 *****/
function getEvents(calendarId, startDate, endDate) {
  try {
    var cal = CalendarApp.getCalendarById(calendarId);
    var events = cal.getEvents(new Date(startDate), new Date(endDate));
    
    var result = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      result.push({
        id: ev.getId(),
        title: ev.getTitle(),
        start: ev.getStartTime().toISOString(),
        end: ev.getEndTime().toISOString()
      });
    }
    return { success: true, events: result };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/***** 予約作成 *****/
function createReservation(calendarId, title, startDateTime, endDateTime) {
  try {
    var user = getUserEmail();
    var cal = CalendarApp.getCalendarById(calendarId);
    var start = new Date(startDateTime);
    var end = new Date(endDateTime);
    
    // 重複チェック
    var existing = cal.getEvents(start, end);
    if (existing.length > 0) {
      return { success: false, error: 'その時間は既に予約があります' };
    }
    
    // 予約作成
    var event = cal.createEvent(
      '【予約】' + title + ' (' + user.split('@')[0] + ')',
      start,
      end,
      { description: 'Created by: ' + user }
    );
    
    return { success: true, eventId: event.getId() };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/***** 予約削除 *****/
function deleteReservation(calendarId, eventId) {
  try {
    var user = getUserEmail();
    var cal = CalendarApp.getCalendarById(calendarId);
    var event = cal.getEventById(eventId);
    
    if (!event) {
      return { success: false, error: 'イベントが見つかりません' };
    }
    
    // 作成者チェック（簡易版）
    var description = event.getDescription() || '';
    if (!description.includes('Created by: ' + user)) {
      return { success: false, error: '自分が作成した予約のみ削除できます' };
    }
    
    event.deleteEvent();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
