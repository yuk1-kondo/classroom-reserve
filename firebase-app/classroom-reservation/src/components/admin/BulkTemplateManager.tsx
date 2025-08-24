// 一括適用管理画面コンポーネント
import React, { useState, useEffect, useMemo } from 'react';
import { bulkTemplatesService } from '../../firebase/bulkTemplates';
import { AutoTemplateService } from '../../services/autoTemplateService';
import { 
  calculateSemesterDates, 
  getCurrentAcademicInfo,
  getSemesterLabel
} from '../../utils/semesterUtils';
import { 
  SEMESTER_LABELS
} from '../../constants/collections';
import { 
  BulkTemplate, 
  Semester, 
  TemplatePriority,
  BulkApplyResult 
} from '../../types/templates';
import './BulkTemplateManager.css';

interface BulkTemplateManagerProps {
  isAdmin: boolean;
  currentUserId?: string;
}

export default function BulkTemplateManager({ isAdmin, currentUserId }: BulkTemplateManagerProps) {
  // 状態管理
  const [academicYear, setAcademicYear] = useState<number>(new Date().getFullYear());
  const [semester, setSemester] = useState<Semester>('spring');
  const [bulkTemplates, setBulkTemplates] = useState<BulkTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // 一括適用関連
  const [applyOptions, setApplyOptions] = useState({
    forceOverride: false,
    notifyConflicts: true,
    dryRun: false,
    priority: undefined as TemplatePriority | undefined
  });
  
  // 適用結果
  const [applyResult, setApplyResult] = useState<BulkApplyResult | null>(null);
  const [applying, setApplying] = useState(false);
  
  // 現在の年度・学期情報
  const currentInfo = useMemo(() => getCurrentAcademicInfo(), []);
  
  // 年度選択肢（現在年度の前後2年）
  const academicYears = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1, current + 2];
  }, []);
  
  // 学期選択肢
  const semesters: Semester[] = ['spring', 'summer', 'fall', 'winter'];
  
  // 選択された学期の期間を計算
  const semesterDates = useMemo(() => 
    calculateSemesterDates(semester, academicYear), 
    [semester, academicYear]
  );
  
  // 一括テンプレートの読み込み
  useEffect(() => {
    if (!isAdmin) return;
    
    const loadBulkTemplates = async () => {
      try {
        setError(null);
        const templates = await bulkTemplatesService.listByAcademicYear(academicYear, semester);
        setBulkTemplates(templates);
      } catch (err: any) {
        setError(err?.message || '一括テンプレートの読み込みに失敗しました');
      }
    };
    
    loadBulkTemplates();
  }, [isAdmin, academicYear, semester]);
  
  // 現在の年度・学期に設定
  useEffect(() => {
    setAcademicYear(currentInfo.academicYear);
    setSemester(currentInfo.semester);
  }, [currentInfo]);
  
  // 一括適用の実行
  const handleBulkApply = async () => {
    if (!isAdmin || !currentUserId) {
      alert('管理者権限が必要です');
      return;
    }
    
    try {
      setApplying(true);
      setError(null);
      setApplyResult(null);
      
      console.log(`🚀 ${academicYear}年度${getSemesterLabel(semester)}の一括適用開始`);
      
      const result = await bulkTemplatesService.applySemester(
        semester,
        academicYear,
        applyOptions
      );
      
      setApplyResult(result);
      
      if (result.success) {
        console.log(`✅ 一括適用完了: ${result.applied}件適用`);
      } else {
        console.warn(`⚠️ 一括適用完了（競合あり）: ${result.applied}件適用、${result.conflicts.length}件競合`);
      }
      
    } catch (err: any) {
      console.error('一括適用エラー:', err);
      setError(err?.message || '一括適用に失敗しました');
    } finally {
      setApplying(false);
    }
  };
  
  // テスト実行（ドライラン）
  const handleDryRun = async () => {
    if (!isAdmin || !currentUserId) {
      alert('管理者権限が必要です');
      return;
    }
    
    try {
      setApplying(true);
      setError(null);
      setApplyResult(null);
      
      console.log(`🔍 ${academicYear}年度${getSemesterLabel(semester)}のテスト実行開始`);
      
      const result = await bulkTemplatesService.applySemester(
        semester,
        academicYear,
        { ...applyOptions, dryRun: true }
      );
      
      setApplyResult(result);
      console.log(`🔍 テスト実行完了: ${result.conflicts.length}件の競合を検出`);
      
    } catch (err: any) {
      console.error('テスト実行エラー:', err);
      setError(err?.message || 'テスト実行に失敗しました');
    } finally {
      setApplying(false);
    }
  };
  
  // 現在の学期に適用
  const handleApplyCurrentSemester = async () => {
    if (!isAdmin || !currentUserId) {
      alert('管理者権限が必要です');
      return;
    }
    
    try {
      setApplying(true);
      setError(null);
      setApplyResult(null);
      
      console.log('🔄 現在の学期への一括適用開始');
      
      const { academicYear: currentYear, semester: currentSemester } = getCurrentAcademicInfo();
      const result = await bulkTemplatesService.applySemester(
        currentSemester,
        currentYear,
        applyOptions
      );
      setApplyResult(result);
      
      if (result.success) {
        console.log(`✅ 現在学期適用完了: ${result.applied}件適用`);
      }
      
    } catch (err: any) {
      console.error('現在学期適用エラー:', err);
      setError(err?.message || '現在学期への適用に失敗しました');
    } finally {
      setApplying(false);
    }
  };
  
  // 年度全体に適用
  const handleApplyFullYear = async () => {
    if (!isAdmin || !currentUserId) {
      alert('管理者権限が必要です');
      return;
    }
    
    if (!window.confirm(`${academicYear}年度の全学期に一括適用しますか？\n\nこれは大量の処理を実行するため、時間がかかる場合があります。`)) {
      return;
    }
    
    try {
      setApplying(true);
      setError(null);
      setApplyResult(null);
      
      console.log(`🎓 ${academicYear}年度全体への一括適用開始`);
      
      const results = await AutoTemplateService.applyAcademicYearStart(academicYear, applyOptions);
      
      // 結果を統合
      const totalApplied = results.reduce((sum, r) => sum + r.applied, 0);
      const totalConflicts = results.reduce((sum, r) => sum + r.conflicts.length, 0);
      const totalOverridden = results.reduce((sum, r) => sum + r.overridden, 0);
      const totalRelocated = results.reduce((sum, r) => sum + r.relocated, 0);
      
      const totalSkipped = results.reduce((sum, r) => sum + (r as any).skipped, 0);
      
      const summaryResult: BulkApplyResult = {
        success: results.some(r => r.success),
        applied: totalApplied,
        conflicts: results.flatMap(r => r.conflicts),
        overridden: totalOverridden,
        relocated: totalRelocated,
        skipped: totalSkipped,
        errors: results.flatMap(r => r.errors),
        summary: {
          total: results.length,
          success: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          warnings: totalConflicts
        }
      };
      
      setApplyResult(summaryResult);
      console.log(`🎓 年度全体適用完了: ${totalApplied}件適用、${totalConflicts}件競合`);
      
    } catch (err: any) {
      console.error('年度全体適用エラー:', err);
      setError(err?.message || '年度全体への適用に失敗しました');
    } finally {
      setApplying(false);
    }
  };
  
  if (!isAdmin) {
    return (
      <div className="bulk-template-manager">
        <div className="access-denied">
          <h3>🚫 アクセス拒否</h3>
          <p>この機能は管理者のみ利用できます。</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bulk-template-manager">
      <div className="manager-header">
        <h3>📅 年度・学期別固定予約一括適用</h3>
        <p className="manager-description">
          年度初めや学期ごとに、設定された固定予約テンプレートを一括で適用します。
        </p>
      </div>
      
      {/* 年度・学期選択 */}
      <div className="semester-selector">
        <div className="selector-group">
          <label>年度:</label>
          <select 
            value={academicYear} 
            onChange={e => setAcademicYear(Number(e.target.value))}
            disabled={applying}
          >
            {academicYears.map(year => (
              <option key={year} value={year}>{year}年度</option>
            ))}
          </select>
        </div>
        
        <div className="selector-group">
          <label>学期:</label>
          <select 
            value={semester} 
            onChange={e => setSemester(e.target.value as Semester)}
            disabled={applying}
          >
            {semesters.map(sem => (
              <option key={sem} value={sem}>
                {SEMESTER_LABELS[sem]}（{semesterDates.startDate} 〜 {semesterDates.endDate}）
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* 適用オプション */}
      <div className="apply-options">
        <h4>🔧 適用オプション</h4>
        <div className="options-grid">
          <label className="option-item">
            <input
              type="checkbox"
              checked={applyOptions.forceOverride}
              onChange={e => setApplyOptions(prev => ({ ...prev, forceOverride: e.target.checked }))}
              disabled={applying}
            />
            既存予約を強制上書き
          </label>
          
          <label className="option-item">
            <input
              type="checkbox"
              checked={applyOptions.notifyConflicts}
              onChange={e => setApplyOptions(prev => ({ ...prev, notifyConflicts: e.target.checked }))}
              disabled={applying}
            />
            競合を通知
          </label>
          
          <label className="option-item">
            <input
              type="checkbox"
              checked={applyOptions.dryRun}
              onChange={e => setApplyOptions(prev => ({ ...prev, dryRun: e.target.checked }))}
              disabled={applying}
            />
            テスト実行（実際には適用しない）
          </label>
        </div>
        
        <div className="priority-selector">
          <label>優先度フィルター:</label>
          <select
            value={applyOptions.priority || ''}
            onChange={e => setApplyOptions(prev => ({ 
              ...prev, 
              priority: e.target.value ? (e.target.value as TemplatePriority) : undefined 
            }))}
            disabled={applying}
          >
            <option value="">すべての優先度</option>
            <option value="critical">最重要のみ</option>
            <option value="high">高以上</option>
            <option value="normal">通常以上</option>
          </select>
        </div>
      </div>
      
      {/* 一括操作ボタン */}
      <div className="bulk-actions">
        <button 
          onClick={handleBulkApply}
          disabled={applying}
          className="primary-btn"
        >
          🚀 {applying ? '適用中...' : `${academicYear}年度${getSemesterLabel(semester)}に一括適用`}
        </button>
        
        <button 
          onClick={handleDryRun}
          disabled={applying}
          className="secondary-btn"
        >
          🔍 {applying ? '実行中...' : 'テスト実行（競合チェックのみ）'}
        </button>
        
        <button 
          onClick={handleApplyCurrentSemester}
          disabled={applying}
          className="secondary-btn"
        >
          🔄 現在の学期に適用
        </button>
        
        <button 
          onClick={handleApplyFullYear}
          disabled={applying}
          className="danger-btn"
        >
          🎓 {academicYear}年度全体に適用
        </button>
      </div>
      
      {/* 適用結果表示 */}
      {applyResult && (
        <div className="apply-result">
          <h4>📊 適用結果</h4>
          <div className="result-summary">
            <div className="result-item success">
              <span className="label">成功:</span>
              <span className="value">{applyResult.applied}件</span>
            </div>
            <div className="result-item warning">
              <span className="label">競合:</span>
              <span className="value">{applyResult.conflicts.length}件</span>
            </div>
            <div className="result-item info">
              <span className="label">上書き:</span>
              <span className="value">{applyResult.overridden}件</span>
            </div>
            <div className="result-item info">
              <span className="label">移動:</span>
              <span className="value">{applyResult.relocated}件</span>
            </div>
          </div>
          
          {applyResult.conflicts.length > 0 && (
            <div className="conflicts-details">
              <h5>⚠️ 競合詳細</h5>
              <div className="conflicts-list">
                {applyResult.conflicts.slice(0, 10).map((conflict, index) => (
                  <div key={index} className="conflict-item">
                    <div className="conflict-date">{conflict.date}</div>
                    <div className="conflict-room">{conflict.roomName}</div>
                    <div className="conflict-period">{conflict.periodName}</div>
                    <div className="conflict-action">{conflict.action}</div>
                    <div className="conflict-template">{conflict.template.name}</div>
                  </div>
                ))}
                {applyResult.conflicts.length > 10 && (
                  <div className="conflicts-more">
                    他 {applyResult.conflicts.length - 10} 件の競合があります
                  </div>
                )}
              </div>
            </div>
          )}
          
          {applyResult.errors.length > 0 && (
            <div className="errors-details">
              <h5>❌ エラー詳細</h5>
              <div className="errors-list">
                {applyResult.errors.map((error, index) => (
                  <div key={index} className="error-item">{error}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* エラーメッセージ */}
      {error && (
        <div className="error-message">
          <h4>❌ エラー</h4>
          <p>{error}</p>
        </div>
      )}
      
      {/* 一括テンプレート一覧 */}
      {bulkTemplates.length > 0 && (
        <div className="bulk-templates-list">
          <h4>📋 一括テンプレート一覧</h4>
          <div className="templates-grid">
            {bulkTemplates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-header">
                  <h5>{template.name}</h5>
                  <span className={`status-badge status-${template.status}`}>
                    {template.status === 'draft' ? '下書き' : 
                     template.status === 'active' ? '有効' : 'アーカイブ'}
                  </span>
                </div>
                <div className="template-details">
                  <div>期間: {template.startDate} 〜 {template.endDate}</div>
                  <div>テンプレート数: {template.templates.length}件</div>
                  <div>作成者: {template.createdBy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
