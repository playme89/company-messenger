import { format, formatDistanceToNow, isSameDay, isToday, isYesterday, differenceInCalendarDays, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ko } from "date-fns/locale";

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return `어제 ${format(date, "HH:mm")}`;
  return format(date, "MM/dd HH:mm");
}

export function formatMessageDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "오늘";
  if (isYesterday(date)) return "어제";
  return format(date, "yyyy년 M월 d일 EEEE", { locale: ko });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 간트 차트 유틸
export function getDaysBetween(start: Date, end: Date): number {
  return differenceInCalendarDays(end, start) + 1;
}

export function getDateRange(viewStart: Date, viewEnd: Date): Date[] {
  return eachDayOfInterval({ start: viewStart, end: viewEnd });
}

export function getMonthLabel(date: Date): string {
  return format(date, "yyyy년 M월", { locale: ko });
}

export function getDayLabel(date: Date): string {
  return format(date, "d");
}

export function getWeekdayLabel(date: Date): string {
  return format(date, "EEE", { locale: ko });
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function dateToStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function strToDate(str: string): Date {
  return new Date(str + "T00:00:00");
}

export function getBarPosition(
  taskStart: Date,
  taskEnd: Date,
  viewStart: Date,
  cellWidth: number
): { left: number; width: number } {
  const startOffset = Math.max(0, differenceInCalendarDays(taskStart, viewStart));
  const endOffset = differenceInCalendarDays(taskEnd, viewStart) + 1;
  const startOffsetClamped = Math.max(0, startOffset);
  return {
    left: startOffsetClamped * cellWidth,
    width: Math.max(cellWidth, (endOffset - startOffsetClamped) * cellWidth),
  };
}
