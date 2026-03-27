from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_admin
from app.models.user import User, Department
from app.schemas.user import UserOut, UserUpdate, DepartmentOut, DepartmentCreate
from app.services.presence_service import get_multiple_presence

router = APIRouter()


@router.get("", response_model=list[UserOut])
async def list_users(
    department_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(User).options(selectinload(User.department)).where(User.is_active == True)
    if department_id:
        query = query.where(User.department_id == department_id)
    result = await db.execute(query.order_by(User.display_name))
    return result.scalars().all()


@router.get("/presence")
async def users_presence(
    user_ids: str,
    current_user: User = Depends(get_current_user),
):
    ids = [uid.strip() for uid in user_ids.split(",") if uid.strip()]
    presence = await get_multiple_presence(ids)
    return presence


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User).options(selectinload(User.department)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if update.display_name is not None:
        current_user.display_name = update.display_name
    if update.avatar_url is not None:
        current_user.avatar_url = update.avatar_url
    if update.department_id is not None:
        current_user.department_id = update.department_id
    await db.commit()
    await db.refresh(current_user)
    return current_user


# 부서 관리
@router.get("/departments/list", response_model=list[DepartmentOut])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Department).order_by(Department.order_index))
    return result.scalars().all()


@router.post("/departments", response_model=DepartmentOut, status_code=201)
async def create_department(
    req: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    dept = Department(name=req.name, parent_id=req.parent_id, order_index=req.order_index)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept
