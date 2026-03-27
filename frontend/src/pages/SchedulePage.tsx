import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { GanttChart } from "@/components/schedule/GanttChart";
import { useScheduleStore } from "@/stores/scheduleStore";
import { scheduleApi } from "@/api/schedule.api";
import { usersApi } from "@/api/users.api";
import { dateToStr } from "@/utils/dateUtils";

export function SchedulePage() {
  const {
    tasks, setTasks, viewStart, viewEnd, navigateMonth, selectedDepartmentId, setSelectedDepartmentId,
  } = useScheduleStore();

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: usersApi.getDepartments,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["schedule-tasks", dateToStr(viewStart), dateToStr(viewEnd), selectedDepartmentId],
    queryFn: () =>
      scheduleApi.getTasks(dateToStr(viewStart), dateToStr(viewEnd), selectedDepartmentId || undefined),
  });

  useEffect(() => {
    if (data) setTasks(data);
  }, [data, setTasks]);

  return (
    <div className="flex flex-col h-full">
      {/* 네비게이션 바 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => navigateMonth("prev")}
          className="p-1.5 rounded hover:bg-gray-100"
        >
          <ChevronLeft size={18} />
        </button>

        <span className="text-sm font-semibold text-gray-700 min-w-[180px] text-center">
          {format(viewStart, "yyyy년 M월", { locale: ko })} ~{" "}
          {format(viewEnd, "yyyy년 M월", { locale: ko })}
        </span>

        <button
          onClick={() => navigateMonth("next")}
          className="p-1.5 rounded hover:bg-gray-100"
        >
          <ChevronRight size={18} />
        </button>

        <div className="ml-4">
          <select
            value={selectedDepartmentId || ""}
            onChange={(e) => setSelectedDepartmentId(e.target.value || null)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 부서</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {isLoading && (
          <span className="text-sm text-gray-400 ml-2">로딩 중...</span>
        )}
      </div>

      {/* 간트 차트 */}
      <div className="flex-1 overflow-hidden">
        <GanttChart tasks={tasks} departments={departments} />
      </div>
    </div>
  );
}
