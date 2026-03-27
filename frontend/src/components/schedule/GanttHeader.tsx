import { useMemo } from "react";
import { format, isSameMonth, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { getDateRange, isWeekend } from "@/utils/dateUtils";

interface GanttHeaderProps {
  viewStart: Date;
  viewEnd: Date;
  cellWidth: number;
  labelWidth: number;
}

export function GanttHeader({ viewStart, viewEnd, cellWidth, labelWidth }: GanttHeaderProps) {
  const days = useMemo(() => getDateRange(viewStart, viewEnd), [viewStart, viewEnd]);

  // 월 그룹핑
  const months = useMemo(() => {
    const groups: { label: string; count: number }[] = [];
    let current = "";
    let count = 0;
    for (const d of days) {
      const label = format(d, "yyyy년 M월", { locale: ko });
      if (label !== current) {
        if (current) groups.push({ label: current, count });
        current = label;
        count = 1;
      } else {
        count++;
      }
    }
    if (current) groups.push({ label: current, count });
    return groups;
  }, [days]);

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 select-none">
      {/* 월 헤더 */}
      <div className="flex" style={{ marginLeft: labelWidth }}>
        {months.map((m, i) => (
          <div
            key={i}
            className="border-r border-gray-200 text-xs font-semibold text-gray-600 px-2 py-1 bg-gray-50"
            style={{ width: m.count * cellWidth, minWidth: 0, overflow: "hidden" }}
          >
            {m.label}
          </div>
        ))}
      </div>
      {/* 일 헤더 */}
      <div className="flex" style={{ marginLeft: labelWidth }}>
        {days.map((d, i) => {
          const weekend = isWeekend(d);
          const today = isToday(d);
          return (
            <div
              key={i}
              className={[
                "border-r border-gray-100 text-center text-xs py-1 flex flex-col items-center",
                weekend ? "bg-gray-50 text-gray-400" : "text-gray-600",
                today ? "bg-blue-50 font-bold text-blue-600" : "",
              ].join(" ")}
              style={{ width: cellWidth, minWidth: cellWidth, maxWidth: cellWidth }}
            >
              <span>{format(d, "d")}</span>
              <span className="text-[10px]">{format(d, "EEE", { locale: ko })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
