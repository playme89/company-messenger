import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import type { ScheduleTask } from "@/types";
import { dateToStr } from "@/utils/dateUtils";

const schema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  description: z.string().optional(),
  start_date: z.string().min(1, "시작일을 선택해주세요"),
  end_date: z.string().min(1, "종료일을 선택해주세요"),
  color: z.string().default("#4F81BD"),
  progress: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(["planned", "in_progress", "done", "hold"]).default("planned"),
});

type FormData = z.infer<typeof schema>;

interface TaskFormProps {
  task?: ScheduleTask;
  defaultStartDate?: string;
  onSubmit: (data: FormData) => Promise<void>;
  onClose: () => void;
}

const COLORS = ["#4F81BD", "#E06C75", "#98C379", "#E5C07B", "#C678DD", "#56B6C2", "#ABB2BF"];
const STATUS_LABELS = { planned: "예정", in_progress: "진행 중", done: "완료", hold: "보류" };

export function TaskForm({ task, defaultStartDate, onSubmit, onClose }: TaskFormProps) {
  const today = dateToStr(new Date());
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      start_date: task?.start_date || defaultStartDate || today,
      end_date: task?.end_date || defaultStartDate || today,
      color: task?.color || "#4F81BD",
      progress: task?.progress || 0,
      status: task?.status || "planned",
    },
  });

  const selectedColor = watch("color");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{task ? "작업 수정" : "새 작업 추가"}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">작업명 *</label>
            <input
              {...register("title")}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="작업명을 입력하세요"
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <textarea
              {...register("description")}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="작업 설명 (선택)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작일 *</label>
              <input
                type="date"
                {...register("start_date")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.start_date && <p className="text-red-500 text-xs mt-1">{errors.start_date.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료일 *</label>
              <input
                type="date"
                {...register("end_date")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.end_date && <p className="text-red-500 text-xs mt-1">{errors.end_date.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                {...register("status")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">진행률: {watch("progress")}%</label>
              <input
                type="range"
                {...register("progress")}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue("color", c)}
                  className={`w-7 h-7 rounded-full border-2 ${selectedColor === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "저장 중..." : task ? "수정" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
