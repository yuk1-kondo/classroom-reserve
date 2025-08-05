// 権限認証用の一時的な関数
function testSpreadsheetAccess() {
  var SPREADSHEET_ID = '1z9lEV0O5rjyceix5kMAelIPV5ekaKOPRqti8Ht9ZnCs';
  
  try {
    console.log('スプレッドシートアクセステスト開始');
    
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log('スプレッドシート取得成功:', spreadsheet.getName());
    
    var allSheets = spreadsheet.getSheets();
    var sheetNames = allSheets.map(function(s) { return s.getName(); });
    console.log('利用可能なシート:', sheetNames);
    
    // Roomsシートの確認
    var roomsSheet = spreadsheet.getSheetByName('Rooms');
    if (roomsSheet) {
      var data = roomsSheet.getDataRange().getValues();
      console.log('Roomsシートのデータ行数:', data.length);
      if (data.length > 0) {
        console.log('ヘッダー行:', data[0]);
      }
    } else {
      console.log('Roomsシートが見つかりません');
    }
    
    return { success: true, sheetNames: sheetNames };
  } catch (e) {
    console.error('スプレッドシートアクセスエラー:', e.toString());
    return { success: false, error: e.toString() };
  }
}
