from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import date
import json

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.redis import get_redis
from app.models.user import User, Department
from app.models.schedule import ScheduleTask
from app.schemas.schedule import ScheduleTaskCreate, ScheduleTaskUpdate, ScheduleTaskOut

router = APIRouter()


@router.get("/tasks", response_model=list[ScheduleTaskOut])
async def get_tasks(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department_id: str | None = Query(None),
    user_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(ScheduleTask)
        .options(
            selectinload(ScheduleTask.user).selectinload(User.department)
        )
        .where(
            ScheduleTask.start_date <= end_date,
            ScheduleTask.end_date >= start_date,
        )
        .order_by(ScheduleTask.user_id, ScheduleTask.order_index, ScheduleTask.start_date)
    )

    if department_id:
        query = query.join(User, ScheduleTask.user_id == User.id).where(User.department_id == department_id)

    if user_id:
        query = query.where(ScheduleTask.user_id == user_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/tasks", response_model=ScheduleTaskOut, status_code=201)
async def create_task(
    req: ScheduleTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.end_date < req.start_date:
        raise HTTPException(status_code=400, detail="종료일은 시작일보다 이후여야 합니다")

    task = ScheduleTask(
        user_id=current_user.id,
        title=req.title,
        description=req.description,
        start_date=req.start_date,
        end_date=req.end_date,
        color=req.color,
        progress=req.progress,
        status=req.status,
        parent_task_id=req.parent_task_id,
        order_index=req.order_index,
    )
    db.add(task)
    await db.commit()

    result = await db.execute(
        select(ScheduleTask)
        .options(selectinload(ScheduleTask.user).selectinload(User.department))
        .where(ScheduleTask.id == task.id)
    )
    full_task = result.scalar_one()

    task_out = ScheduleTaskOut.model_validate(full_task)
    redis = await get_redis()
    if current_user.department_id:
        await redis.publish(
            f"schedule:department:{current_user.department_id}",
            json.dumps({"type": "schedule_updated", "payload": task_out.model_dump(mode="json")}),
        )

    return task_out


@router.patch("/tasks/{task_id}", response_model=ScheduleTaskOut)
async def update_task(
    task_id: str,
    req: ScheduleTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ScheduleTask)
        .options(selectinload(ScheduleTask.user).selectinload(User.department))
        .where(ScheduleTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    if task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 작업만 수정할 수 있습니다")

    if req.title is not None:
        task.title = req.title
    if req.description is not None:
        task.description = req.description
    if req.start_date is not None:
        task.start_date = req.start_date
    if req.end_date is not None:
        task.end_date = req.end_date
    if req.color is not None:
        task.color = req.color
    if req.progress is not None:
        task.progress = req.progress
    if req.status is not None:
        task.status = req.status
    if req.order_index is not None:
        task.order_index = req.order_index

    await db.commit()
    await db.refresh(task)

    task_out = ScheduleTaskOut.model_validate(task)
    redis = await get_redis()
    if current_user.department_id:
        await redis.publish(
            f"schedule:department:{current_user.department_id}",
            json.dumps({"type": "schedule_updated", "payload": task_out.model_dump(mode="json")}),
        )

    return task_out


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ScheduleTask).where(ScheduleTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    if task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 작업만 삭제할 수 있습니다")

    await db.delete(task)
    await db.commit()
