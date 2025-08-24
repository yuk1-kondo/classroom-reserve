// 学期・年度管理用ユーティリティ
import { Semester, SemesterDates } from '../types/templates';
import { SEMESTER_PERIODS, SEMESTER_LABELS } from '../constants/collections';

/**
 * 指定された年度・学期の期間を計算
 */
export function calculateSemesterDates(
  semester: Semester,
  academicYear: number
): SemesterDates {
  const period = SEMESTER_PERIODS[semester];
  
  let startYear = academicYear;
  let endYear = academicYear;
  
  // 冬期は前年度の1月から始まる
  if (semester === 'winter') {
    startYear = academicYear - 1;
  }
  
  // 夏期は8月のみ
  if (semester === 'summer') {
    const startDate = new Date(startYear, period.startMonth - 1, 1);
    const endDate = new Date(startYear, period.endMonth, 0); // 月末
    
    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      name: `${academicYear}年度${period.name}`,
      academicYear,
      semester
    };
  }
  
  // 通常の学期（前期・後期）
  const startDate = new Date(startYear, period.startMonth - 1, 1);
  const endDate = new Date(endYear, period.endMonth, 0); // 月末
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    name: `${academicYear}年度${period.name}`,
    academicYear,
    semester
  };
}

/**
 * 現在の日付から年度・学期を判定
 */
export function getCurrentAcademicInfo(): { academicYear: number; semester: Semester } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 0-basedなので+1
  
  let academicYear: number;
  let semester: Semester;
  
  if (currentMonth >= 4 && currentMonth <= 7) {
    // 4月-7月: 前期
    academicYear = currentYear;
    semester = 'spring';
  } else if (currentMonth === 8) {
    // 8月: 夏期
    academicYear = currentYear;
    semester = 'summer';
  } else if (currentMonth >= 9 && currentMonth <= 12) {
    // 9月-12月: 後期
    academicYear = currentYear;
    semester = 'fall';
  } else {
    // 1月-3月: 冬期
    academicYear = currentYear;
    semester = 'winter';
  }
  
  return { academicYear, semester };
}

/**
 * 指定された日付が学期期間内かチェック
 */
export function isWithinSemester(
  date: string | Date,
  semester: Semester,
  academicYear: number
): boolean {
  const semesterDates = calculateSemesterDates(semester, academicYear);
  const targetDate = typeof date === 'string' ? date : formatDate(date);
  
  return targetDate >= semesterDates.startDate && targetDate <= semesterDates.endDate;
}

/**
 * 指定された日付が含まれる学期を取得
 */
export function getSemesterForDate(date: string | Date): { academicYear: number; semester: Semester } {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  
  if (month >= 4 && month <= 7) {
    return { academicYear: year, semester: 'spring' };
  } else if (month === 8) {
    return { academicYear: year, semester: 'summer' };
  } else if (month >= 9 && month <= 12) {
    return { academicYear: year, semester: 'fall' };
  } else {
    return { academicYear: year - 1, semester: 'winter' };
  }
}

/**
 * 年度の開始日（4月1日）を取得
 */
export function getAcademicYearStart(academicYear: number): Date {
  return new Date(academicYear, 3, 1); // 4月1日（0-basedなので3）
}

/**
 * 年度の終了日（翌年3月31日）を取得
 */
export function getAcademicYearEnd(academicYear: number): Date {
  return new Date(academicYear + 1, 2, 31); // 3月31日（0-basedなので2）
}

/**
 * 年度の全期間を取得
 */
export function getAcademicYearRange(academicYear: number): { startDate: string; endDate: string } {
  const start = getAcademicYearStart(academicYear);
  const end = getAcademicYearEnd(academicYear);
  
  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 学期の表示名を取得
 */
export function getSemesterLabel(semester: Semester): string {
  return SEMESTER_LABELS[semester];
}

/**
 * 年度・学期の表示名を取得
 */
export function getAcademicSemesterLabel(academicYear: number, semester: Semester): string {
  return `${academicYear}年度${getSemesterLabel(semester)}`;
}

/**
 * 次の学期を取得
 */
export function getNextSemester(semester: Semester, academicYear: number): { semester: Semester; academicYear: number } {
  switch (semester) {
    case 'spring':
      return { semester: 'summer', academicYear };
    case 'summer':
      return { semester: 'fall', academicYear };
    case 'fall':
      return { semester: 'winter', academicYear };
    case 'winter':
      return { semester: 'spring', academicYear: academicYear + 1 };
  }
}

/**
 * 前の学期を取得
 */
export function getPreviousSemester(semester: Semester, academicYear: number): { semester: Semester; academicYear: number } {
  switch (semester) {
    case 'spring':
      return { semester: 'winter', academicYear: academicYear - 1 };
    case 'summer':
      return { semester: 'spring', academicYear };
    case 'fall':
      return { semester: 'summer', academicYear };
    case 'winter':
      return { semester: 'fall', academicYear };
  }
}
