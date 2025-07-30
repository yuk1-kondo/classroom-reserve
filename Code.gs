/***** 最小限の教室予約システム *****/

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

/***** 初期データ *****/
function getInitData() {
  return {
    user: getUserEmail()
  };
}

/***** イベント一覧取得 *****/
function getEvents(calendarId, startDate, endDate) {
  try {
    console.log('イベント取得:', calendarId, startDate, endDate);
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
    console.log('取得成功:', result.length + '件');
    return { success: true, events: result };
  } catch (error) {
    console.error('イベント取得エラー:', error);
    return { success: false, error: error.toString() };
  }
}

/***** 予約作成 *****/
function createReservation(calendarId, title, startDateTime, endDateTime) {
  try {
    console.log('予約作成:', calendarId, title, startDateTime, endDateTime);
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
    
    console.log('予約作成成功:', event.getId());
    return { success: true, eventId: event.getId() };
  } catch (error) {
    console.error('予約作成エラー:', error);
    return { success: false, error: error.toString() };
  }
}

/***** 予約削除 *****/
function deleteReservation(calendarId, eventId) {
  try {
    console.log('予約削除:', calendarId, eventId);
    var user = getUserEmail();
    var cal = CalendarApp.getCalendarById(calendarId);
    var event = cal.getEventById(eventId);
    
    if (!event) {
      return { success: false, error: 'イベントが見つかりません' };
    }
    
    // 作成者チェック（簡易版）
    var description = event.getDescription() || '';
    if (!description.indexOf('Created by: ' + user) === -1) {
      return { success: false, error: '自分が作成した予約のみ削除できます' };
    }
    
    event.deleteEvent();
    console.log('削除成功');
    return { success: true };
  } catch (error) {
    console.error('削除エラー:', error);
    return { success: false, error: error.toString() };
  }
}

/***** イベント（表示） *****/
function listEvents(calendarId, isoStart, isoEnd) {
  _userEmail();
  var cal = CalendarApp.getCalendarById(calendarId);
  var start = new Date(isoStart);
  var end = new Date(isoEnd);
  var events = cal.getEvents(start, end);
  
  var result = [];
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    result.push({
      id: ev.getId(),
      title: ev.getTitle(),
      start: ev.getStartTime(),
      end: ev.getEndTime(),
      description: ev.getDescription()
    });
  }
  return result;
}

/***** 放課後スロット（30分刻み：動的） *****/
function listAfterschoolSlots(calendarId, dateISO) {
  var rooms = getRooms();
  var room = null;
  for (var i = 0; i < rooms.length; i++) {
    if (rooms[i].calendarId === calendarId) {
      room = rooms[i];
      break;
    }
  }
  
  var openTo = room ? room.openTo : '18:30';
  var startHHMM = _maxClassEndHHMM();
  var cur = _hhmmToDate(dateISO, startHHMM);
  var endLimit = _hhmmToDate(dateISO, openTo);

  var slots = [];
  var i = 1;
  while (cur < endLimit) {
    var next = new Date(cur.getTime() + 30 * 60 * 1000);
    var slotEnd = next <= endLimit ? next : endLimit;
    slots.push({
      label: '放課後' + i + '（' + _dateToHHMM(cur) + '-' + _dateToHHMM(slotEnd) + '）',
      startHHMM: _dateToHHMM(cur),
      endHHMM: _dateToHHMM(slotEnd),
      order: i
    });
    cur = slotEnd; 
    i++;
  }
  return slots;
}

/***** 予約作成（時限＋放課後） *****/
function createReservationBySegments(payload) {
  var user = _userEmail();
  var calendarId = payload.calendarId;
  var dateISO = payload.dateISO;
  var classLabels = payload.classLabels || [];
  var afterschoolSlots = payload.afterschoolSlots || [];
  var purpose = payload.purpose;
  var notes = payload.notes;
  
  var lock = LockService.getScriptLock(); 
  lock.waitLock(5000);
  try {
    var periods = getPeriods();
    var pickedClass = [];
    for (var i = 0; i < periods.length; i++) {
      for (var j = 0; j < classLabels.length; j++) {
        if (periods[i].label === classLabels[j]) {
          pickedClass.push(periods[i]);
          break;
        }
      }
    }
    
    for (var k = 0; k < pickedClass.length; k++) {
      if (pickedClass[k].kind === 'LUNCH') {
        return { ok: false, reason: '昼休みは予約できません' };
      }
    }
    
    var classOnly = [];
    for (var l = 0; l < pickedClass.length; l++) {
      if (pickedClass[l].kind === 'CLASS') {
        classOnly.push(pickedClass[l]);
      }
    }
    
    var orders = [];
    for (var m = 0; m < classOnly.length; m++) {
      orders.push(classOnly[m].order);
    }
    orders.sort(function(a, b) { return a - b; });
    
    for (var n = 1; n < orders.length; n++) {
      if (orders[n] !== orders[n-1] + 1) {
        return { ok: false, reason: '授業は連続する時限のみ選択してください' };
      }
    }
    
    var segs = [];
    for (var o = 0; o < pickedClass.length; o++) {
      segs.push({ start: pickedClass[o].start, end: pickedClass[o].end });
    }
    for (var p = 0; p < afterschoolSlots.length; p++) {
      segs.push({ start: afterschoolSlots[p].startHHMM, end: afterschoolSlots[p].endHHMM });
    }
    
    if (segs.length === 0) {
      return { ok: false, reason: '時限または放課後を選択してください' };
    }

    segs.sort(function(a, b) { return a.start.localeCompare(b.start); });
    var mergedStart = segs[0].start;
    var mergedEnd = segs[0].end;
    
    for (var q = 1; q < segs.length; q++) {
      if (segs[q].start !== mergedEnd) {
        return { ok: false, reason: '選択した枠に隙間があります（連続枠のみ可）' };
      }
      mergedEnd = segs[q].end;
    }

    var start = _hhmmToDate(dateISO, mergedStart);
    var end = _hhmmToDate(dateISO, mergedEnd);

    var cal = CalendarApp.getCalendarById(calendarId);
    if (cal.getEvents(start, end).length > 0) {
      return { ok: false, reason: 'その時間帯は既に予約があります（ブラックアウト含む）' };
    }

    var title = '【予約】' + purpose + '（' + user.split('@')[0] + '）';
    var desc = 'createdBy=' + user + '\npurpose=' + purpose + '\nnotes=' + (notes || '') + 
               '\nclass=' + classLabels.join(',') + 
               '\nafter=' + afterschoolSlots.map(function(s) { return s.startHHMM + '-' + s.endHHMM; }).join(',');
    var ev = cal.createEvent(title, start, end, { description: desc });
    try { ev.addGuest(user); } catch(e) {}
    _appendLog('CREATE', calendarId, ev.getId(), user, start, end, purpose, notes, JSON.stringify(payload));
    return { ok: true, eventId: ev.getId() };
  } finally { 
    lock.releaseLock(); 
  }
}

/***** 予約取消（締切なし／作成者・ゲストのみ） *****/
function deleteReservation(calendarId, eventId) {
  var user = _userEmail();
  var cal = CalendarApp.getCalendarById(calendarId);
  var ev = cal.getEventById(eventId);
  if (!ev) return { ok: true };
  var desc = ev.getDescription() || '';
  var isOwner = desc.indexOf('createdBy=' + user) !== -1;
  var guestList = ev.getGuestList();
  var isGuest = false;
  for (var i = 0; i < guestList.length; i++) {
    if (guestList[i].getEmail() === user) {
      isGuest = true;
      break;
    }
  }
  if (!(isOwner || isGuest)) {
    return { ok: false, reason: 'この予約は取り消せません（作成者ご本人で操作してください）' };
  }
  ev.deleteEvent();
  _appendLog('DELETE', calendarId, eventId, user);
  return { ok: true };
}

/***** ブラックアウト（初期は全員可。必要なら制限可） *****/
function createBlackout(payload) {
  var user = _userEmail();
  var calendarId = payload.calendarId;
  var dateISO = payload.dateISO;
  var startHHMM = payload.startHHMM;
  var endHHMM = payload.endHHMM;
  var reason = payload.reason;
  
  var cal = CalendarApp.getCalendarById(calendarId);
  var start = _hhmmToDate(dateISO, startHHMM);
  var end = _hhmmToDate(dateISO, endHHMM);
  var ev = cal.createEvent('【停止】ブラックアウト：' + (reason || ''), start, end,
    { description: 'blackout=true\nby=' + user + '\nreason=' + (reason || '') });
  _appendLog('BLACKOUT', calendarId, ev.getId(), user, start, end, reason || '');
  return { ok: true, eventId: ev.getId() };
}

/***** CSV 出力（全員利用可） *****/
function exportLogsCsv(payload) {
  var user = _userEmail();
  var fromISO = payload.fromISO;
  var toISO = payload.toISO;
  var roomCalendarId = payload.roomCalendarId;
  
  var from = new Date(fromISO), to = new Date(toISO);
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_LOGS);
  var vals = sh.getDataRange().getValues();
  var head = vals.shift(); 
  if (!head) throw new Error('Logs シートが空です');
  
  var idx = {};
  for (var i = 0; i < head.length; i++) {
    idx[String(head[i]).trim()] = i;
  }
  
  var rows = [];
  for (var j = 0; j < vals.length; j++) {
    var r = vals[j];
    var ts = r[idx.timestamp];
    var calId = r[idx.calendarId];
    var inRange = (ts instanceof Date) && ts >= from && ts <= to;
    var matchRoom = !roomCalendarId || calId === roomCalendarId;
    if (inRange && matchRoom) {
      rows.push(r);
    }
  }

  var csvHead = head.join(',') + '\n';
  var csvBody = '';
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k];
    var line = '';
    for (var l = 0; l < r.length; l++) {
      var cell = r[l];
      var s = (cell instanceof Date) ? Utilities.formatDate(cell, TZ, 'yyyy-MM-dd HH:mm:ss') : String(cell || '');
      s = '"' + s.replace(/"/g, '""') + '"';
      line += (l > 0 ? ',' : '') + s;
    }
    csvBody += (k > 0 ? '\n' : '') + line;
  }

  var blob = Utilities.newBlob(csvHead + csvBody, 'text/csv',
    'reservations_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '.csv');
  var file = DriveApp.createFile(blob);
  _appendLog('EXPORT_CSV', roomCalendarId || '', file.getId(), user, null, null, '', '', 'from=' + fromISO + ',to=' + toISO);
  return { ok: true, fileId: file.getId(), url: file.getUrl() };
}
