import { useState, useRef, useCallback } from "react";
import type { ScheduleTask } from "@/types";
import { getBarPosition, strToDate, dateToStr, getDaysBetween } from "@/utils/dateUtils";
import { addDays, differenceInCalendarDays } from "date-fns";
import { cn } from "@/utils/cn";

interface GanttBarProps {
  task: ScheduleTask;
  viewStart: Date;
  cellWidth: number;
  onUpdate: (taskId: string, startDate: string, endDate: string) => void;
  onSelect: (taskId: string) => void;
  isSelected: boolean;
}

const STATUS_OPACITY: Record<string, string> = {
  planned: "opacity-80",
  in_progress: "opacity-100",
  done: "opacity-60",
  hold: "opacity-40",
};

export function GanttBar({ task, viewStart, cellWidth, onUpdate, onSelect, isSelected }: GanttBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startDate: Date; endDate: Date; mode: "move" | "resize-left" | "resize-right" } | null>(null);

  const taskStart = strToDate(task.start_date);
  const taskEnd = strToDate(task.end_date);
  const { left, width } = getBarPosition(taskStart, taskEnd, viewStart, cellWidth);

  const handleMouseDown = useCallback((e: React.MouseEvent, mode: "move" | "resize-left" | "resize-right") => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startDate: taskStart, endDate: taskEnd, mode };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      let newStart = dragRef.current.startDate;
      let newEnd = dragRef.current.endDate;

      if (mode === "move") {
        newStart = addDays(dragRef.current.startDate, deltaDays);
        newEnd = addDays(dragRef.current.endDate, deltaDays);
      } else if (mode === "resize-right") {
        newEnd = addDays(dragRef.current.endDate, deltaDays);
        if (differenceInCalendarDays(newEnd, newStart) < 0) newEnd = newStart;
      } else if (mode === "resize-left") {
        newStart = addDays(dragRef.current.startDate, deltaDays);
        if (differenceInCalendarDays(newEnd, newStart) < 0) newStart = newEnd;
      }

      // 시각적 임시 업데이트
      if (barRef.current) {
        const { left: newLeft, width: newWidth } = getBarPosition(newStart, newEnd, viewStart, cellWidth);
        barRef.current.style.left = `${newLeft}px`;
        barRef.current.style.width = `${newWidth}px`;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaDays = Math.round(deltaX / cellWidth);

      let newStart = dragRef.current.startDate;
      let newEnd = dragRef.current.endDate;

      if (mode === "move") {
        newStart = addDays(dragRef.current.startDate, deltaDays);
        newEnd = addDays(dragRef.current.endDate, deltaDays);
      } else if (mode === "resize-right") {
        newEnd = addDays(dragRef.current.endDate, deltaDays);
        if (differenceInCalendarDays(newEnd, newStart) < 0) newEnd = newStart;
      } else if (mode === "resize-left") {
        newStart = addDays(dragRef.current.startDate, deltaDays);
        if (differenceInCalendarDays(newEnd, newStart) < 0) newStart = newEnd;
      }

      onUpdate(task.id, dateToStr(newStart), dateToStr(newEnd));
      dragRef.current = null;

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [task.id, taskStart, taskEnd, viewStart, cellWidth, onUpdate]);

  const duration = getDaysBetween(taskStart, taskEnd);

  return (
    <div
      ref={barRef}
      className={cn(
        "absolute top-1 h-7 rounded flex items-center cursor-move select-none group",
        STATUS_OPACITY[task.status] || "opacity-100",
        isSelected ? "ring-2 ring-blue-400 ring-offset-1" : "",
      )}
      style={{ left, width: Math.max(width, cellWidth), backgroundColor: task.color }}
      onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
      onMouseDown={(e) => handleMouseDown(e, "move")}
    >
      {/* 왼쪽 리사이즈 핸들 */}
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l hover:bg-black/20"
        onMouseDown={(e) => handleMouseDown(e, "resize-left")}
      />

      {/* 진행률 바 */}
      <div
        className="absolute top-0 left-0 h-full rounded opacity-20 bg-black pointer-events-none"
        style={{ width: `${task.progress}%` }}
      />

      {/* 텍스트 */}
      <span className="px-2 text-white text-xs font-medium truncate pointer-events-none">
        {task.title}
        {task.progress > 0 && ` (${task.progress}%)`}
      </span>

      {/* 오른쪽 리사이즈 핸들 */}
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r hover:bg-black/20"
        onMouseDown={(e) => handleMouseDown(e, "resize-right")}
      />
    </div>
  );
}
