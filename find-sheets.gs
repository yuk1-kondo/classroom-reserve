// 現在のGoogleドライブ内のスプレッドシートを確認する関数
function findSpreadsheets() {
  try {
    console.log('利用可能なスプレッドシートを検索中...');
    
    // Driveから最近のスプレッドシートを検索
    var files = DriveApp.searchFiles('title contains "教室" or title contains "classroom" or title contains "room"');
    
    var spreadsheets = [];
    while (files.hasNext()) {
      var file = files.next();
      if (file.getMimeType() === 'application/vnd.google-apps.spreadsheet') {
        spreadsheets.push({
          name: file.getName(),
          id: file.getId(),
          url: file.getUrl()
        });
        console.log('スプレッドシート発見:', file.getName(), 'ID:', file.getId());
      }
    }
    
    // 代替として、最近作成されたスプレッドシートも検索
    var recentFiles = DriveApp.searchFiles('mimeType="application/vnd.google-apps.spreadsheet"');
    var count = 0;
    while (recentFiles.hasNext() && count < 10) {
      var file = recentFiles.next();
      var alreadyFound = false;
      for (var i = 0; i < spreadsheets.length; i++) {
        if (spreadsheets[i].id === file.getId()) {
          alreadyFound = true;
          break;
        }
      }
      if (!alreadyFound) {
        spreadsheets.push({
          name: file.getName(),
          id: file.getId(),
          url: file.getUrl()
        });
        console.log('最近のスプレッドシート:', file.getName(), 'ID:', file.getId());
      }
      count++;
    }
    
    return spreadsheets;
  } catch (e) {
    console.error('スプレッドシート検索エラー:', e.toString());
    return [];
  }
}
