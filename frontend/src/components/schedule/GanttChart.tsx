import { useState, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Edit3 } from "lucide-react";
import type { ScheduleTask, User, Department } from "@/types";
import { GanttHeader } from "./GanttHeader";
import { GanttBar } from "./GanttBar";
import { TaskForm } from "./TaskForm";
import { getDateRange, isWeekend, strToDate, dateToStr, getBarPosition } from "@/utils/dateUtils";
import { useScheduleStore } from "@/stores/scheduleStore";
import { scheduleApi } from "@/api/schedule.api";
import { isToday as dateFnsIsToday } from "date-fns";
import { toast } from "sonner";

const CELL_WIDTH = 36;
const LABEL_WIDTH = 220;
const ROW_HEIGHT = 40;

interface GanttChartProps {
  tasks: ScheduleTask[];
  departments: Department[];
}

interface UserGroup {
  user: User;
  tasks: ScheduleTask[];
}

interface DeptGroup {
  department: Department | null;
  users: UserGroup[];
}

export function GanttChart({ tasks, departments }: GanttChartProps) {
  const { viewStart, viewEnd, addTask, updateTask, deleteTask, selectedTaskId, setSelectedTaskId } = useScheduleStore();
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduleTask | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => getDateRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const totalWidth = days.length * CELL_WIDTH;

  // 부서별 사용자별 그룹핑
  const deptGroups = useMemo((): DeptGroup[] => {
    const userMap = new Map<string, UserGroup>();
    for (const task of tasks) {
      const uid = task.user.id;
      if (!userMap.has(uid)) {
        userMap.set(uid, { user: task.user, tasks: [] });
      }
      userMap.get(uid)!.tasks.push(task);
    }

    const deptMap = new Map<string, DeptGroup>();
    for (const [, ug] of userMap) {
      const deptId = ug.user.department_id || "__none__";
      if (!deptMap.has(deptId)) {
        const dept = departments.find((d) => d.id === deptId) || null;
        deptMap.set(deptId, { department: dept, users: [] });
      }
      deptMap.get(deptId)!.users.push(ug);
    }

    return Array.from(deptMap.values()).sort((a, b) => {
      if (!a.department) return 1;
      if (!b.department) return -1;
      return (a.department.order_index || 0) - (b.department.order_index || 0);
    });
  }, [tasks, departments]);

  const toggleDept = (deptId: string) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  const handleBarUpdate = async (taskId: string, startDate: string, endDate: string) => {
    try {
      const updated = await scheduleApi.updateTask(taskId, { start_date: startDate, end_date: endDate });
      updateTask(updated);
    } catch {
      toast.error("작업 업데이트에 실패했습니다");
    }
  };

  const handleCreateTask = async (data: Parameters<typeof scheduleApi.createTask>[0]) => {
    try {
      const task = await scheduleApi.createTask(data);
      addTask(task);
      setShowForm(false);
      toast.success("작업이 추가되었습니다");
    } catch {
      toast.error("작업 추가에 실패했습니다");
    }
  };

  const handleUpdateTask = async (data: Parameters<typeof scheduleApi.createTask>[0]) => {
    if (!editingTask) return;
    try {
      const updated = await scheduleApi.updateTask(editingTask.id, data);
      updateTask(updated);
      setEditingTask(undefined);
      toast.success("작업이 수정되었습니다");
    } catch {
      toast.error("작업 수정에 실패했습니다");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("작업을 삭제하시겠습니까?")) return;
    try {
      await scheduleApi.deleteTask(taskId);
      deleteTask(taskId);
      toast.success("작업이 삭제되었습니다");
    } catch {
      toast.error("작업 삭제에 실패했습니다");
    }
  };

  // 오늘 선의 위치
  const todayOffset = useMemo(() => {
    const idx = days.findIndex((d) => dateFnsIsToday(d));
    return idx >= 0 ? idx * CELL_WIDTH + CELL_WIDTH / 2 : null;
  }, [days]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h2 className="font-semibold text-gray-800">일정표</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={16} />
          새 작업
        </button>
      </div>

      {/* 간트 차트 본체 */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div style={{ minWidth: LABEL_WIDTH + totalWidth }}>
          {/* 헤더 */}
          <GanttHeader viewStart={viewStart} viewEnd={viewEnd} cellWidth={CELL_WIDTH} labelWidth={LABEL_WIDTH} />

          {/* 바디 */}
          <div className="relative">
            {/* 오늘 선 */}
            {todayOffset !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
                style={{ left: LABEL_WIDTH + todayOffset }}
              />
            )}

            {deptGroups.map((dg) => {
              const deptId = dg.department?.id || "__none__";
              const isCollapsed = collapsedDepts.has(deptId);

              return (
                <div key={deptId}>
                  {/* 부서 헤더 행 */}
                  <div
                    className="flex items-center h-9 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 sticky left-0"
                    onClick={() => toggleDept(deptId)}
                  >
                    <div className="flex items-center gap-1 px-3" style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}>
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className="text-xs font-semibold text-gray-600">
                        {dg.department?.name || "부서 없음"}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">({dg.users.length}명)</span>
                    </div>
                    <div style={{ width: totalWidth }} />
                  </div>

                  {/* 사용자 행들 */}
                  {!isCollapsed &&
                    dg.users.map((ug) => (
                      <div
                        key={ug.user.id}
                        className="flex border-b border-gray-100 hover:bg-gray-50/50"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {/* 사용자 레이블 */}
                        <div
                          className="flex items-center gap-2 px-4 shrink-0 border-r border-gray-200 bg-white sticky left-0 z-10"
                          style={{ width: LABEL_WIDTH }}
                        >
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs shrink-0">
                            {ug.user.display_name[0]}
                          </div>
                          <span className="text-sm text-gray-700 truncate">{ug.user.display_name}</span>
                        </div>

                        {/* 간트 영역 */}
                        <div className="relative flex-1" style={{ width: totalWidth }}>
                          {/* 격자 배경 */}
                          {days.map((d, i) => (
                            <div
                              key={i}
                              className={[
                                "absolute top-0 bottom-0 border-r border-gray-100",
                                isWeekend(d) ? "bg-gray-50" : "",
                              ].join(" ")}
                              style={{ left: i * CELL_WIDTH, width: CELL_WIDTH }}
                            />
                          ))}

                          {/* 작업 바들 */}
                          {ug.tasks.map((task) => (
                            <div key={task.id} className="relative">
                              <GanttBar
                                task={task}
                                viewStart={viewStart}
                                cellWidth={CELL_WIDTH}
                                onUpdate={handleBarUpdate}
                                onSelect={setSelectedTaskId}
                                isSelected={selectedTaskId === task.id}
                              />
                              {/* 선택 시 액션 버튼 */}
                              {selectedTaskId === task.id && (
                                <div
                                  className="absolute top-0 right-0 flex gap-1 z-20"
                                  style={{ left: getBarRight(task, viewStart, CELL_WIDTH) }}
                                >
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingTask(task); }}
                                    className="bg-white border rounded p-0.5 shadow text-blue-600 hover:bg-blue-50"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                    className="bg-white border rounded p-0.5 shadow text-red-500 hover:bg-red-50"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}

            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <p className="text-sm">이 기간에 등록된 작업이 없습니다</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-3 text-blue-600 text-sm hover:underline"
                >
                  첫 번째 작업 추가하기
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 작업 추가 모달 */}
      {showForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* 작업 수정 모달 */}
      {editingTask && (
        <TaskForm
          task={editingTask}
          onSubmit={handleUpdateTask}
          onClose={() => setEditingTask(undefined)}
        />
      )}
    </div>
  );
}

function getBarRight(task: ScheduleTask, viewStart: Date, cellWidth: number): number {
  const { left, width } = getBarPosition(
    strToDate(task.start_date),
    strToDate(task.end_date),
    viewStart,
    cellWidth
  );
  return left + width + 4;
}
