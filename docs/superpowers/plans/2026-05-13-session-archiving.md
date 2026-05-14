# 会话归档 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 chat session 加「归档」能力——用户可以把不想看的 session 软删（保留数据 + 从 sidebar 移走），在 Settings 「已归档对话」页可恢复或彻底删除；归档 session 只读，要追问先恢复。

**Architecture:** 跨仓改动。Auth 后端：1 个 alembic migration（加 `qa_sessions.archived_at`）+ 4 个新 endpoint（archive / unarchive / listArchivedSessions / **修改** list + explain）。Web 前端：类型扩展 + API client + 2 个 store（sessions store 扩展 + 新建 archivedSessions store）+ SessionItem 改造为 dropdown + ArchivedSessionsPage + ChatPage 只读 banner。归档/恢复**不写** audit_log，彻底删除写。

**Tech Stack:**
- **Auth**: Python 3.12 / FastAPI / SQLAlchemy 2.0 async / asyncmy / Alembic / pytest
- **Web**: React 19 + TypeScript 6 + Vite 8 + Tailwind v4 + Zustand + Vitest + @testing-library/react + react-router-dom + radix-ui (dropdown-menu)

**Spec:** `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/会话归档-设计.md`

**Working directories:**
- 后端任务（Phase A）：`/Users/java/knowledge-engineering-auth`
- 前端任务（Phase B）：`/Users/java/knowledge-engineering-web`

**Branch strategy:** 各仓建独立 feature branch
- auth: `feat/qa-session-archive`
- web: `feat/qa-session-archive`

---

## File Map

### Auth 仓
| 文件 | 操作 | 责任 |
|---|---|---|
| `alembic/versions/XXXX_qa_sessions_archived_at.py` | **新建** | DB migration |
| `src/service/db_models_homepage.py` | **修改** | `QASession.archived_at` 字段 |
| `src/service/qa_router.py` | **修改** | listSessions 过滤 + archive/unarchive endpoint + explain 检查 archived |
| `src/service/user_router.py` 或新建 `archived_router.py` | **新建** | `GET /api/user/archived-sessions` |
| `tests/test_auth/test_qa_router_archive.py` | **新建** | 4 个新 endpoint + 2 个修改 endpoint 的测试 |

### Web 仓
| 文件 | 操作 | 责任 |
|---|---|---|
| `src/types/session.ts` | **修改** | `Session.archived_at` 字段 |
| `src/api/sessions.ts` | **修改** | 加 3 个函数 (archive / unarchive / listArchivedSessions) |
| `src/store/sessions.ts` | **修改** | 加 archiveSession / unarchiveSession action |
| `src/store/archivedSessions.ts` | **新建** | 归档列表跨工程汇总 store |
| `src/store/archivedSessions.test.ts` | **新建** | store 单测 |
| `src/components/session/SessionMenu.tsx` | **新建** | SessionItem dropdown 菜单子组件 |
| `src/components/session/SessionMenu.test.tsx` | **新建** | dropdown 单测 |
| `src/components/session/SessionItem.tsx` | **修改** | Trash icon → MoreHorizontal「⋯」+ SessionMenu |
| `src/pages/settings/ArchivedSessionsPage.tsx` | **新建** | 归档页主组件 |
| `src/pages/settings/ArchivedSessionsPage.test.tsx` | **新建** | 归档页单测 |
| `src/App.tsx` | **修改** | 加 `/settings/archived-chats` 路由 + lazy import |
| `src/pages/settings/SettingsLayout.tsx` | **修改** | 二级菜单加「已归档对话」入口 |
| `src/pages/ChatPage.tsx` | **修改** | 归档 session → banner + 输入框 disabled |

---

## Phase A — Auth 后端

## Task 1: Alembic Migration — 加 `qa_sessions.archived_at`

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Create: `alembic/versions/qa_archive_v1_qa_sessions_archived_at.py`

- [ ] **Step 1: 写 migration 文件**

`alembic/versions/qa_archive_v1_qa_sessions_archived_at.py`:

```python
"""qa_archive_v1: qa_sessions add archived_at + composite index.

设计文档：[[会话归档-设计]] §4.1 / §4.3

新增：
  · qa_sessions.archived_at DATETIME NULL（NULL = 活动，非 NULL = 已归档）
  · idx_qa_sessions_user_archived 复合索引 (user_id, archived_at)
    覆盖"当前用户全部归档"主查询路径

Revision ID: qa_archive_v1
Revises: v2b_remap_role
Create Date: 2026-05-13
"""
# 从 alembic 包导入 op（Alembic 的 DDL 操作对象）
from alembic import op
# 导入 sqlalchemy 供类型声明使用
import sqlalchemy as sa


# Alembic 的版本标识。revision = 当前版本；down_revision = 上一个版本
revision = 'qa_archive_v1'
down_revision = 'v2b_remap_role'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """加 archived_at 字段 + 复合索引。"""
    # batch_alter_table: 在 sqlite 上需要重建表来加列，MySQL 上是直接 ALTER；
    # alembic 用 batch 模式两边都兼容
    with op.batch_alter_table('qa_sessions') as batch_op:
        batch_op.add_column(sa.Column('archived_at', sa.DateTime(), nullable=True))

    # 复合索引 (user_id, archived_at)：
    # 归档页查询 SELECT ... WHERE user_id = ? AND archived_at IS NOT NULL
    # 这两列联合索引能让上面这个查询走索引
    op.create_index(
        'idx_qa_sessions_user_archived',
        'qa_sessions',
        ['user_id', 'archived_at'],
    )


def downgrade() -> None:
    """回滚：先删索引，再删字段。"""
    op.drop_index('idx_qa_sessions_user_archived', table_name='qa_sessions')
    with op.batch_alter_table('qa_sessions') as batch_op:
        batch_op.drop_column('archived_at')
```

- [ ] **Step 2: 检查 migration 能跑（in-memory sqlite，不动真实 DB）**

Run:
```bash
cd /Users/java/knowledge-engineering-auth
# 用 pytest 验证 alembic upgrade 跑通：用 conftest 已有的 in-memory sqlite fixture
# 临时写一个最小 test 看 migration 不抛异常
python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from src.service.db import Base
async def main():
    eng = create_async_engine('sqlite+aiosqlite:///:memory:', echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print('schema create OK')
asyncio.run(main())
"
```

Expected: `schema create OK`（这步只验证 Base.metadata 能 create_all，下个 task 再让 archived_at 字段进 model）。

- [ ] **Step 3: 跑全量回归确认现有测试不破**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/ -x --timeout=60 2>&1 | tail -20`

Expected: 全部 PASS（migration 本身不影响任何现有 model）

- [ ] **Step 4: Commit**

```bash
cd /Users/java/knowledge-engineering-auth
git add alembic/versions/qa_archive_v1_qa_sessions_archived_at.py
git commit -m "$(cat <<'EOF'
feat(qa-archive): alembic migration — qa_sessions.archived_at + 复合索引

设计：[[会话归档-设计]] §4.1, §4.3

- 加 qa_sessions.archived_at DATETIME NULL
- 加 idx_qa_sessions_user_archived (user_id, archived_at) 复合索引
- batch_alter_table 兼容 sqlite (测试用) + MySQL (生产)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: QASession 模型加 archived_at 字段

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/db_models_homepage.py` (在 `class QASession(Base)` 内加字段)

- [ ] **Step 1: 写 failing test**

`tests/test_auth/test_qa_session_model_archive.py`（新建）:

```python
"""验证 QASession.archived_at 字段存在且默认 None。"""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.service import auth_security as sec
from src.service.auth_models import User
from src.service.db import Base
from src.service.db_models_homepage import Project, QASession


@pytest_asyncio.fixture
async def session_maker():
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    return async_sessionmaker(eng, expire_on_commit=False)


@pytest.mark.asyncio
async def test_qa_session_has_archived_at_field_default_none(session_maker):
    """新建 QASession 后 archived_at 应该是 None（默认活动状态）。"""
    async with session_maker() as s:
        s.add(User(id=1, email="a@x.com", username="alice",
                   hashed_password=sec.hash_password("12345678"),
                   is_active=True))
        s.add(Project(id="p1", name="P1", status="ready"))
        s.add(QASession(id="sess_1", project_id="p1", user_id=1, title="t"))
        await s.commit()

        sess = await s.get(QASession, "sess_1")
        assert sess is not None
        # archived_at 字段必须存在，且默认 None
        assert sess.archived_at is None


@pytest.mark.asyncio
async def test_qa_session_archived_at_settable(session_maker):
    """archived_at 可以被赋值为 datetime。"""
    from datetime import datetime
    async with session_maker() as s:
        s.add(User(id=1, email="a@x.com", username="alice",
                   hashed_password=sec.hash_password("12345678"),
                   is_active=True))
        s.add(Project(id="p1", name="P1", status="ready"))
        sess = QASession(id="sess_1", project_id="p1", user_id=1, title="t")
        s.add(sess)
        await s.commit()

        sess.archived_at = datetime(2026, 5, 13, 10, 0, 0)
        await s.commit()

        refreshed = await s.get(QASession, "sess_1")
        assert refreshed.archived_at is not None
        assert refreshed.archived_at.year == 2026
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_session_model_archive.py -v 2>&1 | tail -15`

Expected: FAIL（archived_at 属性不存在）

- [ ] **Step 3: 修改 QASession 模型加字段**

打开 `src/service/db_models_homepage.py`，找到 `class QASession(Base):` 内部，在 `message_count` 字段后面加：

```python
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True, default=None
    )
    """归档时间。NULL = 活动会话（默认）；非 NULL = 已归档（值即归档时刻，归档列表按此倒序）。
    设计：[[会话归档-设计]] §4.1。"""
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_session_model_archive.py -v 2>&1 | tail -15`

Expected: 2/2 PASS

- [ ] **Step 5: 全量回归确认现有 QASession 测试不破**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/ -x --timeout=60 2>&1 | tail -10`

Expected: 全部 PASS（archived_at 是新增可空字段，不破坏现有测试）

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/db_models_homepage.py tests/test_auth/test_qa_session_model_archive.py
git commit -m "$(cat <<'EOF'
feat(qa-archive): QASession.archived_at 字段（ORM model）

设计：[[会话归档-设计]] §4.1

- Mapped[Optional[datetime]] nullable=True default=None
- 2 个单测：默认 None + 可赋值

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: listSessions 默认过滤 archived_at IS NULL

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_router.py`（找到 `list_sessions` endpoint 加 WHERE 条件）
- Test: `tests/test_auth/test_qa_router_archive.py`（新建）

- [ ] **Step 1: 写 failing test**

`tests/test_auth/test_qa_router_archive.py`（新建文件，本 task 只写第一个测试，后续 task 会往里加）:

```python
"""验证 qa_router 归档相关行为：list 过滤 / archive / unarchive / explain 409。"""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.service import auth_security as sec
from src.service.auth_models import User
from src.service.auth_router import router as auth_router
from src.service.db import Base, get_db
from src.service.db_models_homepage import (
    Project as ProjectModel,
    QASession,
    UserProjectAccess,
)
from src.service.project_router import router as project_router
from src.service.qa_router import router as qa_router


# ───────── 共享 fixture ─────────

@pytest_asyncio.fixture
async def session_maker(monkeypatch):
    monkeypatch.setenv("KE_JWT_SECRET", "x" * 32)
    monkeypatch.setenv("KE_COOKIE_SECURE", "false")
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    SM = async_sessionmaker(eng, expire_on_commit=False)
    async with SM() as s:
        # alice 是 project p1 的 reporter
        s.add(User(id=1, email="alice@x.com", username="alice",
                   hashed_password=sec.hash_password("12345678"),
                   is_active=True, is_admin=False))
        s.add(ProjectModel(id="p1", name="P1", status="ready"))
        s.add(UserProjectAccess(user_id=1, project_id="p1", role="reporter"))
        await s.commit()
    return SM


def _build_app(session_maker):
    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(project_router)
    app.include_router(qa_router)

    async def override_db():
        async with session_maker() as s:
            yield s
            await s.commit()
    app.dependency_overrides[get_db] = override_db
    return app


def _login(client, email="alice@x.com", password="12345678"):
    """登录并返回 access_token。"""
    resp = client.post("/api/auth/login",
                       json={"email": email, "password": password,
                             "remember_me": False})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# ───────── Task 3 测试 ─────────

@pytest.mark.asyncio
async def test_list_sessions_filters_out_archived(session_maker):
    """list /qa/sessions 默认只返回 archived_at IS NULL 的 session。"""
    # 准备数据：插 2 个 session，1 活动 1 归档
    async with session_maker() as s:
        s.add(QASession(id="sess_active", project_id="p1", user_id=1,
                        title="活动 session", message_count=2))
        s.add(QASession(id="sess_archived", project_id="p1", user_id=1,
                        title="已归档 session", message_count=3,
                        archived_at=datetime(2026, 5, 10, 0, 0, 0)))
        await s.commit()

    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)

    resp = client.get("/api/projects/p1/qa/sessions",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    ids = [s["id"] for s in data["sessions"]]
    # 只看到活动，看不到归档
    assert "sess_active" in ids
    assert "sess_archived" not in ids
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py::test_list_sessions_filters_out_archived -v 2>&1 | tail -15`

Expected: FAIL（返回的列表中**包含**了 sess_archived，因为现在 list_sessions 没过滤 archived_at）

- [ ] **Step 3: 改 qa_router.py 给 list_sessions 加 WHERE 条件**

打开 `src/service/qa_router.py`，找到 `list_sessions` endpoint（grep `async def list_sessions`），在它的 select 语句里加 `archived_at IS NULL` 过滤。

具体改动：找到类似这样的代码：
```python
stmt = (
    select(QASession)
    .where(QASession.project_id == project_id, QASession.user_id == user.id)
    .order_by(QASession.updated_at.desc())
)
```

改成：
```python
stmt = (
    select(QASession)
    .where(
        QASession.project_id == project_id,
        QASession.user_id == user.id,
        QASession.archived_at.is_(None),  # 默认只返回活动 session（归档的从此接口看不见）
    )
    .order_by(QASession.updated_at.desc())
)
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py::test_list_sessions_filters_out_archived -v 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: 全量回归**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router.py -x --timeout=60 2>&1 | tail -10`

Expected: 全部 PASS（现有 list_sessions 测试用的都是未归档 session，过滤后行为不变）

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_router.py tests/test_auth/test_qa_router_archive.py
git commit -m "$(cat <<'EOF'
feat(qa-archive): list_sessions 默认过滤已归档 session

设计：[[会话归档-设计]] §5.2

- WHERE archived_at IS NULL 加入 list 查询
- 归档 session 从主列表消失（要看必须去 Settings 归档页）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: POST /sessions/{sid}/archive endpoint

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_router.py`（加 archive endpoint）
- Test: `tests/test_auth/test_qa_router_archive.py`（追加测试）

- [ ] **Step 1: 在 test 文件追加 4 个 test**

在 `tests/test_auth/test_qa_router_archive.py` 末尾追加：

```python
@pytest.mark.asyncio
async def test_archive_session_success(session_maker):
    """归档自己的 session → 200 + archived_at 被设置。"""
    async with session_maker() as s:
        s.add(QASession(id="sess_a", project_id="p1", user_id=1,
                        title="x", message_count=1))
        await s.commit()

    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)

    resp = client.post("/api/projects/p1/qa/sessions/sess_a/archive",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "sess_a"
    assert body["archived_at"] is not None  # ISO 8601 字符串

    # DB 状态确认
    async with session_maker() as s:
        sess = await s.get(QASession, "sess_a")
        assert sess.archived_at is not None


@pytest.mark.asyncio
async def test_archive_idempotent(session_maker):
    """归档已归档的 session → 200 + 返回原有 archived_at（不更新时间戳）。"""
    original = datetime(2026, 5, 1, 12, 0, 0)
    async with session_maker() as s:
        s.add(QASession(id="sess_a", project_id="p1", user_id=1,
                        title="x", message_count=1,
                        archived_at=original))
        await s.commit()

    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)

    resp = client.post("/api/projects/p1/qa/sessions/sess_a/archive",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    # 时间戳保持不变（幂等性）
    assert body["archived_at"].startswith("2026-05-01")


@pytest.mark.asyncio
async def test_archive_not_owner_returns_404(session_maker):
    """非 owner 归档别人的 session → 404（与现有 delete 一致，不暴露存在性）。"""
    async with session_maker() as s:
        # bob 是另一个用户，session 属于 bob 不属于 alice
        s.add(User(id=2, email="bob@x.com", username="bob",
                   hashed_password=sec.hash_password("12345678"),
                   is_active=True, is_admin=False))
        s.add(QASession(id="sess_b", project_id="p1", user_id=2,
                        title="bob 的 session"))
        await s.commit()

    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)  # alice 登录

    resp = client.post("/api/projects/p1/qa/sessions/sess_b/archive",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_archive_session_not_found_returns_404(session_maker):
    """session 不存在 → 404。"""
    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)

    resp = client.post("/api/projects/p1/qa/sessions/nonexistent/archive",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py -v 2>&1 | tail -25`

Expected: 4 个新 case 全部 FAIL（路由不存在 → 404 但 archive_success 期望 200；这里所有都失败因为没实现）

- [ ] **Step 3: 在 qa_router.py 加 archive endpoint**

在 `src/service/qa_router.py` 中，紧挨着 `delete_session` endpoint 之后（约 line 405 之后）添加：

```python
# ─── 归档 / 恢复 ─────────────────────────────────────────────────────────────


class ArchiveResponse(BaseModel):
    """archive / unarchive 响应：仅返回 id + archived_at（恢复时为 null）。"""
    id: str
    archived_at: Optional[str] = None


@router.post(
    "/sessions/{session_id}/archive",
    # 设计 §5.1：archive 需要 session owner + project reporter+
    dependencies=[Depends(require_project_role("reporter"))],
)
async def archive_session(
    project_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArchiveResponse:
    """把 session 设为归档状态。幂等：已归档再调不更新时间戳。
    设计：[[会话归档-设计]] §5.1, §5.4。"""
    # owner 检查与 delete_session 同模式：保证只能动自己的 session
    sess = await db.get(QASession, session_id)
    if not sess or sess.project_id != project_id or sess.user_id != user.id:
        raise HTTPException(status_code=404, detail="会话不存在")

    # 幂等性（§5.4）：已归档 → 不更新时间戳
    if sess.archived_at is None:
        # datetime.utcnow() 已过时；新代码用 datetime.now(timezone.utc) 拿 UTC 时间
        from datetime import datetime as _dt
        sess.archived_at = _dt.now(timezone.utc).replace(tzinfo=None)
        await db.commit()
        await db.refresh(sess)

    return ArchiveResponse(
        id=sess.id,
        archived_at=sess.archived_at.isoformat() if sess.archived_at else None,
    )
```

注意：`timezone` 已经在文件顶部 import 过（`from datetime import timezone`）。`Optional` 也已经 import。`Field` 也已经 import。

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py -v 2>&1 | tail -15`

Expected: 5/5 PASS（包括 Task 3 的 list + Task 4 的 4 个 archive）

- [ ] **Step 5: 全量回归**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router.py tests/test_auth/test_qa_router_archive.py -x --timeout=60 2>&1 | tail -10`

Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_router.py tests/test_auth/test_qa_router_archive.py
git commit -m "$(cat <<'EOF'
feat(qa-archive): POST /sessions/{sid}/archive endpoint

设计：[[会话归档-设计]] §5.1, §5.4

- 权限：require_project_role(reporter) + 路由内 owner 检查
- 幂等：已归档再调不更新时间戳
- 返回 { id, archived_at } JSON

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: POST /sessions/{sid}/unarchive endpoint

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_router.py`（加 unarchive endpoint）
- Test: `tests/test_auth/test_qa_router_archive.py`（追加 3 个测试）

- [ ] **Step 1: 在 test 文件追加 3 个 test**

在 `tests/test_auth/test_qa_router_archive.py` 末尾追加：

```python
@pytest.mark.asyncio
async def test_unarchive_session_success(session_maker):
    """unarchive 已归档 session → 200 + archived_at 清空。"""
    async with session_maker() as s:
        s.add(QASession(id="sess_a", project_id="p1", user_id=1,
                        title="x", message_count=1,
                        archived_at=datetime(2026, 5, 1, 0, 0, 0)))
        await s.commit()

    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)

    resp = client.post("/api/projects/p1/qa/sessions/sess_a/unarchive",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "sess_a"
    assert body["archived_at"] is None

    async with session_maker() as s:
        sess = await s.get(QASession, "sess_a")
        assert sess.archived_at is None


@pytest.mark.asyncio
async def test_unarchive_idempotent_on_active_session(session_maker):
    """unarchive 活动 session → 200 + 仍是 null（无操作）。"""
    async with session_maker() as s:
        s.add(QASession(id="sess_a", project_id="p1", user_id=1,
                        title="x", message_count=1))
        await s.commit()

    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)

    resp = client.post("/api/projects/p1/qa/sessions/sess_a/unarchive",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["archived_at"] is None


@pytest.mark.asyncio
async def test_unarchive_not_owner_returns_404(session_maker):
    """非 owner unarchive → 404。"""
    async with session_maker() as s:
        s.add(User(id=2, email="bob@x.com", username="bob",
                   hashed_password=sec.hash_password("12345678"),
                   is_active=True, is_admin=False))
        s.add(QASession(id="sess_b", project_id="p1", user_id=2,
                        title="bob",
                        archived_at=datetime(2026, 5, 1, 0, 0, 0)))
        await s.commit()

    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)

    resp = client.post("/api/projects/p1/qa/sessions/sess_b/unarchive",
                       headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py -k unarchive -v 2>&1 | tail -15`

Expected: 3 个新 case 全部 FAIL（404 — endpoint 不存在）

- [ ] **Step 3: 在 qa_router.py 加 unarchive endpoint**

在 `archive_session` endpoint 之后立即添加：

```python
@router.post(
    "/sessions/{session_id}/unarchive",
    # 设计 §5.1：unarchive 需要 session owner + project reporter+
    dependencies=[Depends(require_project_role("reporter"))],
)
async def unarchive_session(
    project_id: str,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArchiveResponse:
    """把归档 session 恢复为活动状态。幂等：本来就是活动的直接返回 null。
    设计：[[会话归档-设计]] §5.1, §5.4。"""
    sess = await db.get(QASession, session_id)
    if not sess or sess.project_id != project_id or sess.user_id != user.id:
        raise HTTPException(status_code=404, detail="会话不存在")

    # 幂等：活动 session 不需要变更
    if sess.archived_at is not None:
        sess.archived_at = None
        await db.commit()

    return ArchiveResponse(id=sess.id, archived_at=None)
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py -v 2>&1 | tail -15`

Expected: 8/8 PASS（前 5 个 + 新 3 个）

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_router.py tests/test_auth/test_qa_router_archive.py
git commit -m "$(cat <<'EOF'
feat(qa-archive): POST /sessions/{sid}/unarchive endpoint

设计：[[会话归档-设计]] §5.1, §5.4

- 把 archived_at 清回 None
- 幂等：本来活动的直接返回 archived_at=null

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: GET /api/user/archived-sessions endpoint

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_router.py`（加 user-scoped endpoint，**注意** prefix 不在 `/projects/{pid}/qa` 下，要加单独的 router 或新建文件）

为简单起见放在新 router file。

- Create: `src/service/archived_router.py`
- Modify: `src/service/api.py`（注册新 router）
- Test: `tests/test_auth/test_qa_router_archive.py`（追加测试）

- [ ] **Step 1: 在 test 追加测试**

在 `tests/test_auth/test_qa_router_archive.py` 末尾追加：

```python
# ─── Task 6: GET /api/user/archived-sessions 测试 ─────────


@pytest.mark.asyncio
async def test_list_archived_sessions_cross_project(session_maker):
    """跨工程汇总当前用户的所有归档 session，按工程分组。"""
    async with session_maker() as s:
        # 再加一个 project p2，alice 也是 reporter
        s.add(ProjectModel(id="p2", name="P2", status="ready"))
        s.add(UserProjectAccess(user_id=1, project_id="p2", role="reporter"))
        # alice 在 p1 一个归档 + p1 一个活动 + p2 一个归档
        s.add(QASession(id="sess_a1_arch", project_id="p1", user_id=1,
                        title="p1 归档", message_count=1,
                        archived_at=datetime(2026, 5, 10, 0, 0, 0)))
        s.add(QASession(id="sess_a2_active", project_id="p1", user_id=1,
                        title="p1 活动", message_count=1))
        s.add(QASession(id="sess_a3_arch", project_id="p2", user_id=1,
                        title="p2 归档", message_count=2,
                        archived_at=datetime(2026, 5, 12, 0, 0, 0)))
        await s.commit()

    # 需要把 archived_router 也挂上去
    from src.service.archived_router import router as archived_router
    app = _build_app(session_maker)
    app.include_router(archived_router)
    client = TestClient(app)
    token = _login(client)

    resp = client.get("/api/user/archived-sessions",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    # by_project 列表里有 2 个 project（p1 + p2），且按 project_name 排序
    project_ids = [g["project_id"] for g in data["by_project"]]
    assert "p1" in project_ids
    assert "p2" in project_ids

    # 每个 project 里只有归档的 session（活动的不见）
    p1_group = next(g for g in data["by_project"] if g["project_id"] == "p1")
    p1_ids = [s["id"] for s in p1_group["sessions"]]
    assert "sess_a1_arch" in p1_ids
    assert "sess_a2_active" not in p1_ids


@pytest.mark.asyncio
async def test_list_archived_sessions_user_scoped(session_maker):
    """看不到其他用户的归档（按 current_user.id 过滤）。"""
    async with session_maker() as s:
        s.add(User(id=2, email="bob@x.com", username="bob",
                   hashed_password=sec.hash_password("12345678"),
                   is_active=True, is_admin=False))
        s.add(QASession(id="sess_bob", project_id="p1", user_id=2,
                        title="bob 的归档", message_count=1,
                        archived_at=datetime(2026, 5, 10, 0, 0, 0)))
        await s.commit()

    from src.service.archived_router import router as archived_router
    app = _build_app(session_maker)
    app.include_router(archived_router)
    client = TestClient(app)
    token = _login(client)  # alice

    resp = client.get("/api/user/archived-sessions",
                      headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    # alice 看不到 bob 的
    all_session_ids = [s["id"] for g in data["by_project"] for s in g["sessions"]]
    assert "sess_bob" not in all_session_ids
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py::test_list_archived_sessions_cross_project -v 2>&1 | tail -10`

Expected: FAIL with "Cannot import archived_router"

- [ ] **Step 3: 创建 src/service/archived_router.py**

`src/service/archived_router.py`:

```python
"""跨工程归档 session 汇总 API（用户维度，不限定 project_id）。

设计文档：[[会话归档-设计]] §5.1, §5.5
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.service.auth_dependencies import get_current_user
from src.service.auth_models import User
from src.service.db import get_db
from src.service.db_models_homepage import Project as ProjectModel, QASession

# prefix=/api/user：用户维度（不绑定 project），与 qa_router 的 /api/projects/.. 平级
router = APIRouter(prefix="/api/user", tags=["user-archived"])


class _ArchivedSessionDTO(BaseModel):
    """归档列表行：仅返回 metadata 字段。"""
    id: str
    title: Optional[str] = None
    archived_at: str
    created_at: str
    updated_at: str
    message_count: int


class _ProjectGroupDTO(BaseModel):
    """归档列表按 project 分组。"""
    project_id: str
    project_name: str
    sessions: list[_ArchivedSessionDTO]


class ArchivedListResponse(BaseModel):
    """GET /api/user/archived-sessions 响应。"""
    by_project: list[_ProjectGroupDTO]


@router.get("/archived-sessions")
async def list_archived_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArchivedListResponse:
    """列出当前用户所有工程的归档 session，按工程分组。
    设计：[[会话归档-设计]] §5.5。"""
    # 1. 查所有归档（按 user_id 过滤，复合索引 user_id + archived_at 覆盖）
    stmt = (
        select(QASession)
        .where(QASession.user_id == user.id, QASession.archived_at.is_not(None))
        .order_by(QASession.archived_at.desc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    # 2. 收集涉及的 project_id 集合，一次性查 project_name
    project_ids = sorted({r.project_id for r in rows})
    if project_ids:
        proj_stmt = select(ProjectModel).where(ProjectModel.id.in_(project_ids))
        projects = {p.id: p for p in (await db.execute(proj_stmt)).scalars().all()}
    else:
        projects = {}

    # 3. 按 project_id 分桶
    by_pid: dict[str, list[_ArchivedSessionDTO]] = {pid: [] for pid in project_ids}
    for r in rows:
        by_pid[r.project_id].append(_ArchivedSessionDTO(
            id=r.id,
            title=r.title,
            archived_at=r.archived_at.isoformat(),
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
            message_count=r.message_count,
        ))

    # 4. 按 project_name 排序输出
    groups = sorted(
        [
            _ProjectGroupDTO(
                project_id=pid,
                project_name=projects.get(pid).name if pid in projects else pid,
                sessions=sess_list,
            )
            for pid, sess_list in by_pid.items()
        ],
        key=lambda g: g.project_name or "",
    )
    return ArchivedListResponse(by_project=groups)
```

- [ ] **Step 4: 在 api.py 注册 router**

打开 `src/service/api.py`，找到注册其他 router 的位置（搜 `include_router`），加一行：

```python
from src.service.archived_router import router as archived_router
# ... 其他 include_router ...
app.include_router(archived_router)
```

- [ ] **Step 5: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py -v 2>&1 | tail -15`

Expected: 10/10 PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/archived_router.py src/service/api.py tests/test_auth/test_qa_router_archive.py
git commit -m "$(cat <<'EOF'
feat(qa-archive): GET /api/user/archived-sessions endpoint（跨工程汇总）

设计：[[会话归档-设计]] §5.1, §5.5

- 用户维度查所有归档（按 user_id 严格过滤）
- 按 project_id 分组，project 间按 project_name 排序
- 每组按 archived_at 倒序

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: POST /qa/explain 检查 archived → 409

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_router.py`（在 explain endpoint 内加 archived 检查）
- Test: `tests/test_auth/test_qa_router_archive.py`（追加 1 个测试）

- [ ] **Step 1: 追加测试**

```python
@pytest.mark.asyncio
async def test_explain_to_archived_session_returns_409(session_maker):
    """对已归档 session POST /qa/explain → 409 Conflict。"""
    async with session_maker() as s:
        s.add(QASession(id="sess_arch", project_id="p1", user_id=1,
                        title="归档了",
                        archived_at=datetime(2026, 5, 1, 0, 0, 0)))
        await s.commit()

    app = _build_app(session_maker)
    client = TestClient(app)
    token = _login(client)

    resp = client.post(
        "/api/projects/p1/qa/explain",
        json={"question": "继续问", "session_id": "sess_arch"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409
    detail = resp.json().get("detail", "")
    # 友好错误信息含「归档」字样，前端可据此提示
    assert "归档" in detail or "archived" in detail.lower()
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py::test_explain_to_archived_session_returns_409 -v 2>&1 | tail -10`

Expected: FAIL（当前没 409 检查；可能是 200 或其他状态）

- [ ] **Step 3: 在 qa_router.py 的 explain endpoint 加 archived 检查**

打开 `src/service/qa_router.py`，找到 `async def explain` endpoint（grep `async def explain`）。在函数内 session_id 已被解析、QASession 已被加载的位置之后，加一段检查：

具体位置：找到类似 `sess = await db.get(QASession, session_id)` 或类似 fetch session 的代码（如果是新建 session 流程则跳过此检查）。

如果 `body.session_id` 提供了 + session 存在 + 已归档（archived_at 非 None），返回 409：

```python
# session_id 已提供时检查是否归档（新建 session 流程不需要这个检查）
if body.session_id:
    existing_sess = await db.get(QASession, body.session_id)
    if existing_sess and existing_sess.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该会话已归档，请先恢复后继续提问",
        )
```

**注意**：精确插入位置取决于 explain 函数现有结构，需要先 `cat src/service/qa_router.py | head -200` 看清楚后再放在合适的位置（最好在 session 已被验证存在、user_id 等基础检查通过之后，但在创建/追加 QAMessage 之前）。

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router_archive.py::test_explain_to_archived_session_returns_409 -v 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: 全量回归**

Run: `cd /Users/java/knowledge-engineering-auth && python -m pytest tests/test_auth/test_qa_router.py tests/test_auth/test_qa_router_archive.py -x --timeout=60 2>&1 | tail -10`

Expected: 全部 PASS（新增的 archived 检查只对 archived session 触发，不影响现有路径）

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_router.py tests/test_auth/test_qa_router_archive.py
git commit -m "$(cat <<'EOF'
feat(qa-archive): POST /qa/explain 检查归档 session 返回 409

设计：[[会话归档-设计]] §5.2

- session_id 对应的 session 若 archived_at 非 None → 409 Conflict
- 错误信息「该会话已归档，请先恢复后继续提问」
- 前端据此提示用户

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — Web 前端

## Task 8: 类型扩展 + API client 加 3 个函数

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Modify: `src/types/session.ts`（Session 加 archived_at）
- Modify: `src/api/sessions.ts`（加 3 个函数）
- Test: `src/api/sessions.test.ts`（新建，如不存在则创建）

- [ ] **Step 1: 写 failing test**

`src/api/sessions.test.ts`（新建文件；如果已存在则在末尾追加 describe）:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { archiveSession, unarchiveSession, listArchivedSessions } from './sessions'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('sessions API: archive endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('archiveSession 调 POST /projects/{pid}/qa/sessions/{sid}/archive', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { id: 'sess_a', archived_at: '2026-05-13T10:00:00Z' },
    })
    await archiveSession('p1', 'sess_a')
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/p1/qa/sessions/sess_a/archive',
    )
  })

  it('unarchiveSession 调 POST /projects/{pid}/qa/sessions/{sid}/unarchive', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { id: 'sess_a', archived_at: null },
    })
    await unarchiveSession('p1', 'sess_a')
    expect(apiClient.post).toHaveBeenCalledWith(
      '/projects/p1/qa/sessions/sess_a/unarchive',
    )
  })

  it('listArchivedSessions 调 GET /user/archived-sessions 返回 by_project 数组', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        by_project: [
          {
            project_id: 'p1',
            project_name: 'P1',
            sessions: [
              {
                id: 'sess_a',
                title: 'x',
                archived_at: '2026-05-13T10:00:00Z',
                created_at: '2026-05-01T00:00:00Z',
                updated_at: '2026-05-10T00:00:00Z',
                message_count: 2,
              },
            ],
          },
        ],
      },
    })
    const result = await listArchivedSessions()
    expect(apiClient.get).toHaveBeenCalledWith('/user/archived-sessions')
    expect(result).toHaveLength(1)
    expect(result[0].project_id).toBe('p1')
    expect(result[0].sessions).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/api/sessions.test.ts --run 2>&1 | tail -10`

Expected: FAIL（archiveSession 等函数不存在）

- [ ] **Step 3: 改 src/types/session.ts**

打开 `src/types/session.ts`，在 `Session` 接口中添加：

```typescript
export interface Session {
  id: string
  project_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
  /** 归档时间。null/undefined = 活动 session；ISO 8601 字符串 = 已归档。
   * 设计：[[会话归档-设计]] §7.1。 */
  archived_at?: string | null
}
```

并在文件末尾追加跨工程归档列表的 DTO 类型：

```typescript
/**
 * GET /api/user/archived-sessions 返回的单条归档 session 行。
 * 与 Session 类型字段相同，只是 archived_at 强制非空。
 * 设计：[[会话归档-设计]] §5.5。
 */
export interface ArchivedSession {
  id: string
  title: string | null
  archived_at: string  // ISO 8601；归档时间，必填
  created_at: string
  updated_at: string
  message_count: number
}

/**
 * 跨工程归档列表的「工程分组」。
 */
export interface ArchivedByProject {
  project_id: string
  project_name: string
  sessions: ArchivedSession[]
}
```

- [ ] **Step 4: 改 src/api/sessions.ts，在文件末尾追加 3 个函数**

```typescript
// ─── v1.5: 归档相关 API ────────────────────────────────────────────────────

/** 归档 session（软删，从 sidebar 主列表移走，仍存在 DB）。幂等。
 * 设计：[[会话归档-设计]] §5.1。 */
export async function archiveSession(projectId: string, sessionId: string): Promise<void> {
  await apiClient.post(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions/${encodeURIComponent(sessionId)}/archive`,
  )
}

/** 恢复归档 session（archived_at 清空，回到 sidebar 主列表）。幂等。 */
export async function unarchiveSession(projectId: string, sessionId: string): Promise<void> {
  await apiClient.post(
    `/projects/${encodeURIComponent(projectId)}/qa/sessions/${encodeURIComponent(sessionId)}/unarchive`,
  )
}

/** 列出当前用户所有工程的归档 session（按工程分组）。 */
export async function listArchivedSessions(): Promise<import('@/types/session').ArchivedByProject[]> {
  interface ResponseShape {
    by_project: import('@/types/session').ArchivedByProject[]
  }
  const { data } = await apiClient.get<ResponseShape>('/user/archived-sessions')
  return data.by_project
}
```

- [ ] **Step 5: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/api/sessions.test.ts --run 2>&1 | tail -10`

Expected: 3/3 PASS

- [ ] **Step 6: 全量回归 + tsc**

Run:
```bash
cd /Users/java/knowledge-engineering-web
npm test -- --run 2>&1 | tail -6
npx tsc --noEmit
```

Expected: 全部测试 PASS；tsc exit 0

- [ ] **Step 7: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/types/session.ts src/api/sessions.ts src/api/sessions.test.ts
git commit -m "$(cat <<'EOF'
feat(qa-archive): 类型 + API client — archive/unarchive/listArchivedSessions

设计：[[会话归档-设计]] §7.1, §7.2

- Session.archived_at?: string | null
- 新类型 ArchivedSession + ArchivedByProject
- 3 个 API 函数 + 3 个单测

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: sessions store 加 archiveSession / unarchiveSession action

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Modify: `src/store/sessions.ts`
- Modify: `src/store/sessions.test.ts`（追加测试）

- [ ] **Step 1: 在 sessions.test.ts 追加测试**

打开 `src/store/sessions.test.ts`，在末尾追加：

```typescript
describe('useSessionStore: archive actions', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
    vi.clearAllMocks()
  })

  it('archiveSession: 成功后从本地 sessionsByProject 移除', async () => {
    useSessionStore.setState({
      sessionsByProject: {
        p1: [
          mkSession({ id: 's1', project_id: 'p1' }),
          mkSession({ id: 's2', project_id: 'p1' }),
        ],
      },
    })
    vi.mocked(sessionsApi.archiveSession).mockResolvedValue()
    await useSessionStore.getState().archiveSession('p1', 's1')
    const list = useSessionStore.getState().sessionsByProject.p1
    expect(list.map(s => s.id)).toEqual(['s2'])
  })

  it('archiveSession 失败 → 本地 store 不变', async () => {
    useSessionStore.setState({
      sessionsByProject: {
        p1: [mkSession({ id: 's1', project_id: 'p1' })],
      },
    })
    vi.mocked(sessionsApi.archiveSession).mockRejectedValue(new Error('boom'))
    await expect(
      useSessionStore.getState().archiveSession('p1', 's1'),
    ).rejects.toThrow('boom')
    // 本地保留
    expect(useSessionStore.getState().sessionsByProject.p1).toHaveLength(1)
  })

  it('unarchiveSession: 成功后再 fetchSessions 让 sidebar 看到', async () => {
    // 简化模型：unarchive 后 store 不强行注入回去，由调用方触发 fetchSessions
    vi.mocked(sessionsApi.unarchiveSession).mockResolvedValue()
    await useSessionStore.getState().unarchiveSession('p1', 's1')
    expect(sessionsApi.unarchiveSession).toHaveBeenCalledWith('p1', 's1')
  })
})
```

同时在 `vi.mock('@/api/sessions', ...)` 块里加 `archiveSession: vi.fn(), unarchiveSession: vi.fn()`（如果还没的话）。

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/store/sessions.test.ts -t archive --run 2>&1 | tail -10`

Expected: FAIL（archiveSession / unarchiveSession 还不在 store 上）

- [ ] **Step 3: 修改 src/store/sessions.ts**

找到 `SessionStore` interface 加：

```typescript
  /** 归档单个 session：调后端 + 本地从 sessionsByProject 移除。 */
  archiveSession: (projectId: string, sessionId: string) => Promise<void>
  /** 取消归档：调后端；返回后 sidebar 端通常需要 fetchSessions 刷新。 */
  unarchiveSession: (projectId: string, sessionId: string) => Promise<void>
```

在 `import { listSessions, deleteSession as apiDeleteSession } from '@/api/sessions'` 这行扩展：

```typescript
import {
  listSessions,
  deleteSession as apiDeleteSession,
  archiveSession as apiArchiveSession,
  unarchiveSession as apiUnarchiveSession,
} from '@/api/sessions'
```

在 store 实现里加：

```typescript
  archiveSession: async (projectId: string, sessionId: string) => {
    // 后端成功后才本地移除（保证失败时 sidebar 仍能看到）
    await apiArchiveSession(projectId, sessionId)
    set(state => {
      const list = state.sessionsByProject[projectId] ?? []
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectId]: list.filter(s => s.id !== sessionId),
        },
      }
    })
  },

  unarchiveSession: async (projectId: string, sessionId: string) => {
    // 仅调后端；本地是否注入由调用方决定（归档页恢复 → 触发 fetchSessions 拉一遍）
    await apiUnarchiveSession(projectId, sessionId)
  },
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/store/sessions.test.ts --run 2>&1 | tail -10`

Expected: 全部 PASS（含 archive 新增 3 个 + 原有的）

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/store/sessions.ts src/store/sessions.test.ts
git commit -m "$(cat <<'EOF'
feat(qa-archive): sessions store — archiveSession / unarchiveSession action

设计：[[会话归档-设计]] §7.3

- archiveSession: 调后端 + 本地从 sessionsByProject 移除（失败时回滚）
- unarchiveSession: 仅调后端；本地刷新交给调用方
- 3 个单测

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 新建 archivedSessions store

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Create: `src/store/archivedSessions.ts`
- Create: `src/store/archivedSessions.test.ts`

- [ ] **Step 1: 写 failing test**

`src/store/archivedSessions.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useArchivedSessionStore } from './archivedSessions'
import * as sessionsApi from '@/api/sessions'
import type { ArchivedByProject } from '@/types/session'

vi.mock('@/api/sessions', () => ({
  listArchivedSessions: vi.fn(),
  unarchiveSession: vi.fn(),
  deleteSession: vi.fn(),
}))

const mkGroup = (over: Partial<ArchivedByProject> = {}): ArchivedByProject => ({
  project_id: 'p1',
  project_name: 'P1',
  sessions: [
    {
      id: 's1', title: 'x', archived_at: '2026-05-13T10:00:00Z',
      created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-10T00:00:00Z',
      message_count: 2,
    },
  ],
  ...over,
})

describe('useArchivedSessionStore', () => {
  beforeEach(() => {
    useArchivedSessionStore.getState().reset()
    vi.clearAllMocks()
  })

  it('默认状态：byProject 空数组，isLoading false', () => {
    const s = useArchivedSessionStore.getState()
    expect(s.byProject).toEqual([])
    expect(s.isLoading).toBe(false)
  })

  it('fetchAll: 拉取归档列表并写入 byProject', async () => {
    vi.mocked(sessionsApi.listArchivedSessions).mockResolvedValue([mkGroup()])
    await useArchivedSessionStore.getState().fetchAll()
    expect(useArchivedSessionStore.getState().byProject).toHaveLength(1)
  })

  it('fetchAll 失败 → error 字段', async () => {
    vi.mocked(sessionsApi.listArchivedSessions).mockRejectedValue(new Error('boom'))
    await useArchivedSessionStore.getState().fetchAll()
    expect(useArchivedSessionStore.getState().error).toBe('boom')
  })

  it('restore: 调 unarchive + 从 byProject 移除', async () => {
    useArchivedSessionStore.setState({
      byProject: [mkGroup({ project_id: 'p1', sessions: [
        { id: 's1', title: 'x', archived_at: '2026-05-13T10:00:00Z',
          created_at: '...', updated_at: '...', message_count: 2 },
        { id: 's2', title: 'y', archived_at: '2026-05-12T10:00:00Z',
          created_at: '...', updated_at: '...', message_count: 1 },
      ]})],
    })
    vi.mocked(sessionsApi.unarchiveSession).mockResolvedValue()
    await useArchivedSessionStore.getState().restore('p1', 's1')
    const list = useArchivedSessionStore.getState().byProject[0].sessions
    expect(list.map(s => s.id)).toEqual(['s2'])
  })

  it('permanentDelete: 调 deleteSession + 从 byProject 移除', async () => {
    useArchivedSessionStore.setState({
      byProject: [mkGroup()],
    })
    vi.mocked(sessionsApi.deleteSession).mockResolvedValue()
    await useArchivedSessionStore.getState().permanentDelete('p1', 's1')
    expect(useArchivedSessionStore.getState().byProject[0].sessions).toHaveLength(0)
  })

  it('restore 让 project 变空时移除整个 group', async () => {
    useArchivedSessionStore.setState({
      byProject: [mkGroup()],  // 只有一条 session
    })
    vi.mocked(sessionsApi.unarchiveSession).mockResolvedValue()
    await useArchivedSessionStore.getState().restore('p1', 's1')
    // project 整体消失（因为里面 sessions 空了）
    expect(useArchivedSessionStore.getState().byProject).toHaveLength(0)
  })

  it('reset 清空', () => {
    useArchivedSessionStore.setState({ byProject: [mkGroup()], error: 'x' })
    useArchivedSessionStore.getState().reset()
    expect(useArchivedSessionStore.getState().byProject).toEqual([])
    expect(useArchivedSessionStore.getState().error).toBeNull()
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/store/archivedSessions.test.ts --run 2>&1 | tail -10`

Expected: FAIL with "Cannot find module './archivedSessions'"

- [ ] **Step 3: 创建 src/store/archivedSessions.ts**

```typescript
/**
 * src/store/archivedSessions.ts
 *
 * 归档 session 列表 store（跨工程汇总）。
 *
 * 与 sessionsStore 是独立的两个 store：
 *   - sessionsStore: 活动 sessions，按 project_id 分桶（sidebar 用）
 *   - archivedSessionStore: 归档 sessions，跨工程汇总（Settings 归档页用）
 *
 * 不 persist（每次进归档页都重拉，保证看到最新状态）。
 *
 * 设计：[[会话归档-设计]] §7.4。
 */
import { create } from 'zustand'

import {
  listArchivedSessions,
  unarchiveSession as apiUnarchive,
  deleteSession as apiDelete,
} from '@/api/sessions'
import type { ArchivedByProject } from '@/types/session'

interface ArchivedSessionStore {
  /** 按工程分组的归档列表。空数组 = 无归档。 */
  byProject: ArchivedByProject[]
  isLoading: boolean
  error: string | null

  /** 拉取当前用户全部归档。每次进入归档页都调一次。 */
  fetchAll: () => Promise<void>
  /** 恢复一个归档 session：调 unarchive + 从本地 byProject 移除。 */
  restore: (projectId: string, sessionId: string) => Promise<void>
  /** 彻底删除一个归档 session：调 DELETE + 从本地 byProject 移除。 */
  permanentDelete: (projectId: string, sessionId: string) => Promise<void>
  /** 重置（登出 / 路由离开归档页时调）。 */
  reset: () => void
}

export const useArchivedSessionStore = create<ArchivedSessionStore>((set) => ({
  byProject: [],
  isLoading: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const groups = await listArchivedSessions()
      set({ byProject: groups, isLoading: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载归档失败'
      set({ error: msg, isLoading: false })
    }
  },

  restore: async (projectId: string, sessionId: string) => {
    // 后端成功后再本地移除（失败保留 UI 状态）
    await apiUnarchive(projectId, sessionId)
    set(state => removeFromByProject(state.byProject, projectId, sessionId))
  },

  permanentDelete: async (projectId: string, sessionId: string) => {
    await apiDelete(projectId, sessionId)
    set(state => removeFromByProject(state.byProject, projectId, sessionId))
  },

  reset: () => set({ byProject: [], isLoading: false, error: null }),
}))


/**
 * 从 byProject 中移除指定 session。
 * 副作用：若 project 的 sessions 数组变空，则把整个 project 分组从列表中剔除
 * （避免归档页出现空分组 UI）。
 */
function removeFromByProject(
  byProject: ArchivedByProject[],
  projectId: string,
  sessionId: string,
): { byProject: ArchivedByProject[] } {
  // 先把每个分组里的 session 过滤一遍
  const next = byProject
    .map(g => g.project_id === projectId
      ? { ...g, sessions: g.sessions.filter(s => s.id !== sessionId) }
      : g
    )
    .filter(g => g.sessions.length > 0)  // 移除空分组
  return { byProject: next }
}
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/store/archivedSessions.test.ts --run 2>&1 | tail -10`

Expected: 7/7 PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/store/archivedSessions.ts src/store/archivedSessions.test.ts
git commit -m "$(cat <<'EOF'
feat(qa-archive): archivedSessions store — 跨工程归档列表

设计：[[会话归档-设计]] §7.4

- fetchAll / restore / permanentDelete / reset
- 内部 helper removeFromByProject：移空分组（保持 UI 整洁）
- 7 个单测（默认状态 / fetch / restore / delete / 空分组移除 / reset）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: SessionMenu 组件（dropdown）

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Create: `src/components/session/SessionMenu.tsx`
- Create: `src/components/session/SessionMenu.test.tsx`

- [ ] **Step 1: 写 failing test**

`src/components/session/SessionMenu.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionMenu } from './SessionMenu'

describe('SessionMenu', () => {
  let onArchive: ReturnType<typeof vi.fn>
  let onDelete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onArchive = vi.fn()
    onDelete = vi.fn()
  })

  it('渲染「⋯」trigger 按钮', () => {
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} />)
    expect(screen.getByRole('button', { name: /更多操作/ })).toBeInTheDocument()
  })

  it('点击 trigger 打开 menu 显示「归档」+「删除」', () => {
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /更多操作/ }))
    expect(screen.getByText('归档')).toBeInTheDocument()
    expect(screen.getByText('删除')).toBeInTheDocument()
  })

  it('点「归档」调 onArchive', () => {
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /更多操作/ }))
    fireEvent.click(screen.getByText('归档'))
    expect(onArchive).toHaveBeenCalledTimes(1)
  })

  it('点「删除」调 onDelete', () => {
    render(<SessionMenu onArchive={onArchive} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /更多操作/ }))
    fireEvent.click(screen.getByText('删除'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/components/session/SessionMenu.test.tsx --run 2>&1 | tail -10`

Expected: FAIL（找不到模块）

- [ ] **Step 3: 创建 SessionMenu.tsx**

```typescript
/**
 * src/components/session/SessionMenu.tsx
 *
 * Session 行 hover 出现的「⋯」下拉菜单，含「归档」+「删除」两项。
 *
 * 复用项目已有的 dropdown-menu primitive（基于 @radix-ui/react-dropdown-menu）。
 *
 * 设计：[[会话归档-设计]] §8.1。
 */
import { MoreHorizontal, Archive, Trash2 } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface Props {
  onArchive: () => void
  onDelete: () => void
}

export function SessionMenu({ onArchive, onDelete }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="更多操作"
          onClick={(e) => e.stopPropagation()}  // 阻止触发外层 session 点击导航
          className="
            p-1 rounded text-muted-foreground
            opacity-0 group-hover:opacity-100
            hover:bg-muted hover:text-foreground
            transition-opacity transition-colors
            focus:opacity-100
          "
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        <DropdownMenuItem
          onSelect={(e) => {
            // 阻止 radix 默认关闭后还把焦点带出（避免触发外层 onClick）
            e.preventDefault()
            onArchive()
          }}
          className="cursor-pointer"
        >
          <Archive className="h-4 w-4 mr-2" />
          <span>归档</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            onDelete()
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          <span>删除</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/components/session/SessionMenu.test.tsx --run 2>&1 | tail -10`

Expected: 4/4 PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/components/session/SessionMenu.tsx src/components/session/SessionMenu.test.tsx
git commit -m "$(cat <<'EOF'
feat(qa-archive): SessionMenu — hover 下拉菜单（归档 / 删除）

设计：[[会话归档-设计]] §8.1

- 复用 @radix-ui/react-dropdown-menu primitive
- aria-label="更多操作"
- MoreHorizontal trigger + Archive / Trash2 menu items
- 删除项 text-destructive 红色

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: SessionItem 改造 — 接入 SessionMenu

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Modify: `src/components/session/SessionItem.tsx`（删旧 Trash 按钮，接 SessionMenu）

- [ ] **Step 1: 看现状**

Run: `head -120 src/components/session/SessionItem.tsx` 确认现在 Trash 按钮的位置和点击逻辑。

需要保留的逻辑：
- `onClick` 导航到 session URL
- Active 状态高亮

需要替换：
- 旧 Trash icon + 双击确认 → SessionMenu 组件

- [ ] **Step 2: 写或更新现有 SessionItem.test.tsx**

如已有 `SessionItem.test.tsx`：在末尾追加；否则新建：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SessionItem } from './SessionItem'
import { useSessionStore } from '@/store/sessions'
import type { Session } from '@/types/session'
import type { Project } from '@/types/project'

vi.mock('@/store/sessions')

const mkSession = (over: Partial<Session> = {}): Session => ({
  id: 's1', project_id: 'p1', title: '你好',
  created_at: '2026-05-01T00:00:00Z', updated_at: '2026-05-13T00:00:00Z',
  message_count: 2,
  ...over,
})

const mkProject = (over: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'P1', status: 'ready', description: '',
  ...over,
} as Project)

describe('SessionItem with SessionMenu', () => {
  beforeEach(() => {
    vi.mocked(useSessionStore as unknown as () => unknown).mockReturnValue({
      archiveSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('hover 显示「⋯」按钮', () => {
    render(
      <MemoryRouter>
        <SessionItem session={mkSession()} project={mkProject()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /更多操作/ })).toBeInTheDocument()
  })

  it('点 trigger → menu 出现 + 含「归档」', () => {
    render(
      <MemoryRouter>
        <SessionItem session={mkSession()} project={mkProject()} />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /更多操作/ }))
    expect(screen.getByText('归档')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/components/session/SessionItem.test.tsx --run 2>&1 | tail -10`

Expected: 2 个新 case FAIL（按钮不存在）

- [ ] **Step 4: 改 SessionItem.tsx**

打开 `src/components/session/SessionItem.tsx`。

(a) 顶部 import 调整：去掉 `Trash2`，加 `useNavigate`（如果还没的话），import SessionMenu + useSessionStore 的 archiveSession action。

(b) 把原本的"hover Trash 按钮 + 二次确认"那段 JSX 整段删掉，替换成：

```tsx
<SessionMenu
  onArchive={async () => {
    try {
      await archive(project.id, session.id)
      // 如果归档的是当前 active session，跳回工程主页（设计 §8.5）
      if (isActive) {
        navigate(`/project/${project.id}`)
      }
    } catch {
      // 失败时静默 — 列表已由 store 保留状态；可在后续 task 加 toast
    }
  }}
  onDelete={async () => {
    // 二次确认沿用现有 Modal 模式 — 简化版：window.confirm（生产替为 modal）
    if (!window.confirm('确认删除该对话？此操作不可恢复。')) return
    try {
      await deleteSession(project.id, session.id)
      if (isActive) navigate(`/project/${project.id}`)
    } catch {
      // 静默
    }
  }}
/>
```

`archive`/`deleteSession` 从 `useSessionStore` 取：
```typescript
const archive = useSessionStore(s => s.archiveSession)
const deleteSession = useSessionStore(s => s.deleteSession)
```

完整改完后，SessionItem.tsx 的 hover 区域不再是单个 Trash icon，而是右上角悬浮的 SessionMenu 组件。

- [ ] **Step 5: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/components/session/SessionItem.test.tsx --run 2>&1 | tail -10`

Expected: 全部 PASS（新加的 2 个 + 原有的）

- [ ] **Step 6: 全量回归 + tsc**

Run:
```bash
cd /Users/java/knowledge-engineering-web
npm test -- --run 2>&1 | tail -6
npx tsc --noEmit
```

Expected: 全部 PASS；tsc exit 0

- [ ] **Step 7: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/components/session/SessionItem.tsx src/components/session/SessionItem.test.tsx
git commit -m "$(cat <<'EOF'
feat(qa-archive): SessionItem 接入 SessionMenu — Trash icon → ⋯ dropdown

设计：[[会话归档-设计]] §8.1, §8.5

- 删除旧的 hover Trash 按钮 + 二次确认逻辑
- 替换为 <SessionMenu>（归档 / 删除）
- 归档/删除当前 active session 自动跳回工程主页
- 删除前 window.confirm 二次确认（后续可升级 modal）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: ArchivedSessionsPage 页面

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Create: `src/pages/settings/ArchivedSessionsPage.tsx`
- Create: `src/pages/settings/ArchivedSessionsPage.test.tsx`

- [ ] **Step 1: 写 failing test**

`src/pages/settings/ArchivedSessionsPage.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ArchivedSessionsPage } from './ArchivedSessionsPage'
import { useArchivedSessionStore } from '@/store/archivedSessions'

vi.mock('@/store/archivedSessions')

describe('ArchivedSessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('挂载时调 fetchAll', () => {
    const fetchAll = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useArchivedSessionStore as unknown as () => unknown).mockReturnValue({
      byProject: [],
      isLoading: false,
      error: null,
      fetchAll,
      restore: vi.fn(),
      permanentDelete: vi.fn(),
    })
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    expect(fetchAll).toHaveBeenCalled()
  })

  it('byProject 为空显示「没有已归档对话」', () => {
    vi.mocked(useArchivedSessionStore as unknown as () => unknown).mockReturnValue({
      byProject: [],
      isLoading: false,
      error: null,
      fetchAll: vi.fn(),
      restore: vi.fn(),
      permanentDelete: vi.fn(),
    })
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    expect(screen.getByText(/没有已归档对话/)).toBeInTheDocument()
  })

  it('渲染工程分组 + session 项 + 「恢复」+「彻底删除」按钮', () => {
    vi.mocked(useArchivedSessionStore as unknown as () => unknown).mockReturnValue({
      byProject: [{
        project_id: 'p1',
        project_name: 'PetClinic 测试',
        sessions: [{
          id: 's1', title: 'OrderService 调用链',
          archived_at: '2026-05-13T10:00:00Z',
          created_at: '...', updated_at: '...', message_count: 5,
        }],
      }],
      isLoading: false,
      error: null,
      fetchAll: vi.fn(),
      restore: vi.fn(),
      permanentDelete: vi.fn(),
    })
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    expect(screen.getByText('PetClinic 测试')).toBeInTheDocument()
    expect(screen.getByText('OrderService 调用链')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '恢复' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '彻底删除' })).toBeInTheDocument()
  })

  it('点「恢复」调 restore(projectId, sessionId)', async () => {
    const restore = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useArchivedSessionStore as unknown as () => unknown).mockReturnValue({
      byProject: [{
        project_id: 'p1', project_name: 'P1',
        sessions: [{
          id: 's1', title: 'x', archived_at: '...',
          created_at: '...', updated_at: '...', message_count: 1,
        }],
      }],
      isLoading: false, error: null,
      fetchAll: vi.fn(), restore, permanentDelete: vi.fn(),
    })
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '恢复' }))
    await waitFor(() => expect(restore).toHaveBeenCalledWith('p1', 's1'))
  })

  it('点「彻底删除」弹二次确认，确认后调 permanentDelete', async () => {
    const permanentDelete = vi.fn().mockResolvedValue(undefined)
    // mock window.confirm 返回 true
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(useArchivedSessionStore as unknown as () => unknown).mockReturnValue({
      byProject: [{
        project_id: 'p1', project_name: 'P1',
        sessions: [{
          id: 's1', title: 'x', archived_at: '...',
          created_at: '...', updated_at: '...', message_count: 1,
        }],
      }],
      isLoading: false, error: null,
      fetchAll: vi.fn(), restore: vi.fn(), permanentDelete,
    })
    render(<MemoryRouter><ArchivedSessionsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '彻底删除' }))
    await waitFor(() => expect(permanentDelete).toHaveBeenCalledWith('p1', 's1'))
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/pages/settings/ArchivedSessionsPage.test.tsx --run 2>&1 | tail -10`

Expected: FAIL (Cannot find module)

- [ ] **Step 3: 创建 ArchivedSessionsPage.tsx**

```typescript
/**
 * src/pages/settings/ArchivedSessionsPage.tsx
 *
 * Settings 二级菜单「已归档对话」页面。
 *
 * 跨工程汇总归档 session（按工程分组），每条可「恢复」或「彻底删除」。
 *
 * 设计：[[会话归档-设计]] §8.2。
 */
import { useEffect } from 'react'
import { Archive } from 'lucide-react'

import { useArchivedSessionStore } from '@/store/archivedSessions'

export function ArchivedSessionsPage() {
  const byProject = useArchivedSessionStore(s => s.byProject)
  const isLoading = useArchivedSessionStore(s => s.isLoading)
  const error = useArchivedSessionStore(s => s.error)
  const fetchAll = useArchivedSessionStore(s => s.fetchAll)
  const restore = useArchivedSessionStore(s => s.restore)
  const permanentDelete = useArchivedSessionStore(s => s.permanentDelete)

  // 挂载即拉一次
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">已归档对话</h1>
        <p className="text-sm text-muted-foreground mt-1">
          已归档的对话不会出现在主侧栏。在这里可以恢复或彻底删除它们。
        </p>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground">加载中…</p>
      )}

      {error && (
        <p className="text-sm text-destructive">加载失败：{error}</p>
      )}

      {!isLoading && !error && byProject.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Archive className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>没有已归档对话</p>
        </div>
      )}

      {byProject.map(group => (
        <section key={group.project_id} className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">
            {group.project_name}（{group.sessions.length}）
          </h2>
          <ul className="border rounded-lg divide-y">
            {group.sessions.map(s => (
              <li
                key={s.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {s.title || '(无标题)'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    归档于 {new Date(s.archived_at).toLocaleString('zh-CN')}
                    · {s.message_count} 条消息
                  </p>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => restore(group.project_id, s.id)}
                    className="px-3 py-1.5 text-sm rounded border hover:bg-muted transition-colors text-foreground"
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(
                        '彻底删除该对话？此操作不可恢复。'
                      )) return
                      permanentDelete(group.project_id, s.id)
                    }}
                    className="px-3 py-1.5 text-sm rounded border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    彻底删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/pages/settings/ArchivedSessionsPage.test.tsx --run 2>&1 | tail -10`

Expected: 5/5 PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/pages/settings/ArchivedSessionsPage.tsx src/pages/settings/ArchivedSessionsPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(qa-archive): ArchivedSessionsPage — 归档页主组件

设计：[[会话归档-设计]] §8.2

- 挂载即调 fetchAll
- 按工程分组渲染归档 session 列表
- 每行有「恢复」+「彻底删除」(window.confirm)
- 空 state 显示 Archive icon + 「没有已归档对话」
- 5 个单测

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: 路由 + Settings 菜单入口

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Modify: `src/App.tsx`（加 lazy import + Route）
- Modify: `src/pages/settings/SettingsLayout.tsx`（加菜单项）

- [ ] **Step 1: 写 minimal 集成测试**

`src/pages/settings/SettingsLayout.test.tsx`（新建，如果文件不存在）:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SettingsLayout } from './SettingsLayout'

describe('SettingsLayout 集成「已归档对话」入口', () => {
  it('左侧菜单含「已归档对话」link', () => {
    render(
      <MemoryRouter initialEntries={['/settings/projects']}>
        <SettingsLayout />
      </MemoryRouter>,
    )
    expect(screen.getByText('已归档对话')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/pages/settings/SettingsLayout.test.tsx --run 2>&1 | tail -10`

Expected: FAIL（菜单还没加）

- [ ] **Step 3: 改 SettingsLayout.tsx**

打开 `src/pages/settings/SettingsLayout.tsx`，找到现有菜单项数组（含 `groups` / `users` / `audit-logs` 等），在合适位置加：

```typescript
{ to: '/settings/archived-chats', label: '已归档对话' }
```

或者按现有数据结构格式（数组、对象、JSX 列表）做对应改动。具体格式视现有 SettingsLayout 内部实现，但保持视觉/结构与其他菜单项一致。

- [ ] **Step 4: 改 App.tsx 加路由**

打开 `src/App.tsx`，按现有模式：

(a) 在 lazy import 区加：
```typescript
const ArchivedSessionsPage = lazy(() =>
  import('@/pages/settings/ArchivedSessionsPage').then(m => ({ default: m.ArchivedSessionsPage })),
)
```

(b) 在 `/settings` 路由块内加 Route：
```tsx
<Route path="archived-chats" element={<ArchivedSessionsPage />} />
```

具体位置参考现有 `audit-logs` 路由的位置。

- [ ] **Step 5: 跑 test 看它通过 + 全量回归**

Run:
```bash
cd /Users/java/knowledge-engineering-web
npm test -- src/pages/settings/SettingsLayout.test.tsx --run 2>&1 | tail -8
npm test -- --run 2>&1 | tail -6
npx tsc --noEmit
```

Expected: 全部 PASS；tsc exit 0

- [ ] **Step 6: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/App.tsx src/pages/settings/SettingsLayout.tsx src/pages/settings/SettingsLayout.test.tsx
git commit -m "$(cat <<'EOF'
feat(qa-archive): 路由 + Settings 菜单接入 ArchivedSessionsPage

设计：[[会话归档-设计]] §8.3

- /settings/archived-chats 路由 + lazy import
- SettingsLayout 左侧菜单加「已归档对话」

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: ChatPage 归档 session 只读 banner

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: 看现状**

Run: `head -100 src/pages/ChatPage.tsx` 确认当前 ChatPage 结构 + 在哪能读到 currentSession 的 archived_at。

通常 ChatPage 通过 useParams 拿 sessionId，调 getSessionDetail 拿详情。`SessionDetail.session.archived_at` 是关键判断字段。

- [ ] **Step 2: 写 minimal test（验证 banner + disabled 输入）**

`src/pages/ChatPage.archived.test.tsx`（新建独立测试文件，避免污染主测试）:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ChatPage } from './ChatPage'
import * as sessionsApi from '@/api/sessions'

vi.mock('@/api/sessions')

describe('ChatPage: archived session 只读模式', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('归档 session 顶部显示 banner「该对话已归档」', async () => {
    vi.mocked(sessionsApi.getSessionDetail).mockResolvedValue({
      session: {
        id: 'sess_arch', project_id: 'p1', title: '老对话',
        created_at: '2026-05-01T00:00:00Z',
        updated_at: '2026-05-10T00:00:00Z',
        message_count: 3,
        archived_at: '2026-05-13T10:00:00Z',
      },
      messages: [],
    })
    render(
      <MemoryRouter initialEntries={['/project/p1/chat/sess_arch']}>
        <Routes>
          <Route path="/project/:projectId/chat/:sessionId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText(/该对话已归档/)).toBeInTheDocument()
    })
  })

  it('归档 session 输入框 disabled', async () => {
    vi.mocked(sessionsApi.getSessionDetail).mockResolvedValue({
      session: {
        id: 'sess_arch', project_id: 'p1', title: '老对话',
        created_at: '...', updated_at: '...',
        message_count: 3,
        archived_at: '2026-05-13T10:00:00Z',
      },
      messages: [],
    })
    render(
      <MemoryRouter initialEntries={['/project/p1/chat/sess_arch']}>
        <Routes>
          <Route path="/project/:projectId/chat/:sessionId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => {
      const input = screen.getByRole('textbox')
      expect(input).toBeDisabled()
    })
  })
})
```

- [ ] **Step 3: 跑 test 看它失败**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/pages/ChatPage.archived.test.tsx --run 2>&1 | tail -15`

Expected: FAIL（banner 和 disabled 都还没实现）

- [ ] **Step 4: 改 src/pages/ChatPage.tsx**

打开 `src/pages/ChatPage.tsx`，添加：

(a) 找到 currentSession state 的来源（通常是 useChatStore 或 useSessionStore 里的 selector），加一个 `isArchived` 派生：

```typescript
const isArchived = currentSession?.archived_at != null
```

(b) 在主容器顶部、聊天消息列表之前，加 banner（条件渲染）：

```tsx
{isArchived && (
  <div className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3 mb-3">
    <p className="text-sm text-foreground">
      <strong>该对话已归档</strong> — 恢复后可继续提问。
      你可以在{' '}
      <a href="/settings/archived-chats" className="underline text-primary">
        设置 → 已归档对话
      </a>{' '}
      里恢复它。
    </p>
  </div>
)}
```

**注意**：颜色 `bg-yellow-50` `dark:bg-yellow-950/30` 是 banner 特殊场景的合理硬编码（前端规则允许"状态色（橙）需要做暗色变体"）。如果项目已经有 `warning` design token，优先用它。

(c) 输入框 + 发送按钮加 `disabled={isArchived || ...原条件...}`：

```tsx
<textarea
  disabled={isArchived || isStreaming}
  placeholder={isArchived ? '该对话已归档，请先恢复' : '...原文案'}
  ...
/>
<button disabled={isArchived || isStreaming || !input.trim()} ...>
  发送
</button>
```

- [ ] **Step 5: 跑 test 看它通过**

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/pages/ChatPage.archived.test.tsx --run 2>&1 | tail -10`

Expected: 2/2 PASS

- [ ] **Step 6: 全量回归**

Run:
```bash
cd /Users/java/knowledge-engineering-web
npm test -- --run 2>&1 | tail -6
npx tsc --noEmit
```

Expected: 全部 PASS（archived banner 只在 archived_at 非 null 时显示，不影响活动 session 行为）

- [ ] **Step 7: Commit**

```bash
cd /Users/java/knowledge-engineering-web
git add src/pages/ChatPage.tsx src/pages/ChatPage.archived.test.tsx
git commit -m "$(cat <<'EOF'
feat(qa-archive): ChatPage 归档 session 只读模式（banner + disabled）

设计：[[会话归档-设计]] §8.4

- archived_at 非空时顶部 banner「该对话已归档」+ 链到 settings
- 输入框 + 发送按钮 disabled
- 2 个单测

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: 集成自验 + Obsidian 变更日志

**Working directory:** 两边都跑

**Files:**
- Modify: `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/会话归档-设计.md`（§13 变更日志）

- [ ] **Step 1: 启动两个 dev server**

后端（auth）:
```bash
cd /Users/java/knowledge-engineering-auth
# 先把 migration 跑到本地 MySQL（注意 production prefer）
python -m alembic upgrade head
# 启动 FastAPI
uvicorn src.service.api:app --reload --port 8000 > /tmp/auth-dev-archive.log 2>&1 &
```

前端（web）:
```bash
cd /Users/java/knowledge-engineering-web
npm run dev > /tmp/web-dev-archive.log 2>&1 &
```

等启动后访问 http://localhost:5174 或 5173。

- [ ] **Step 2: 浏览器手工过 §11 验收**

13 条 checklist 一条一条过：

1. [ ] sidebar SessionItem hover 出现「⋯」按钮，点开 dropdown 含「归档 / 删除」
2. [ ] 点「归档」 → session 从 sidebar 消失
3. [ ] 归档当前正在看的 session → 自动跳回新对话页
4. [ ] Settings 二级菜单出现「已归档对话」入口
5. [ ] 进入归档页能看到所有工程的归档（按工程分组、按 archived_at 倒序）
6. [ ] 「恢复」按钮 → toast + session 立即回到 sidebar（需要 refresh sidebar 验证）
7. [ ] 「彻底删除」按钮 → window.confirm → 删除 + toast
8. [ ] 直接 URL 访问归档 session（/project/p1/chat/<arch_sid>）→ 顶部 banner + 输入框 disabled
9. [ ] POST /qa/explain 到归档 session（用 curl 测）→ 409 + 友好错误信息
10. [ ] 用 alice 登录看不到 bob 的归档（多账号验证）
11. [ ] light / dark 主题切换 ChatPage banner 都正常
12. [ ] alembic upgrade head + alembic downgrade -1 都跑通
13. [ ] 现有功能不回归（删除单 session 仍工作；feedback 仍工作）

逐条手工验证，记录不过的项。

- [ ] **Step 3: 修复发现的问题（如有）**

按问题列表逐条 fix → 加 test → 再验。如全过跳过此步。

- [ ] **Step 4: 更新 Obsidian 设计文档 §13 变更日志**

`/Users/java/obsidian/01 Engineering/knowledge-engineering-web/会话归档-设计.md` 文件末尾：

```markdown
- 2026-05-13: 实施完成（实施计划：`knowledge-engineering-web/docs/superpowers/plans/2026-05-13-session-archiving.md`）。
  - Auth 后端：Tasks 1-7（migration + 6 个 endpoint 改动）
  - Web 前端：Tasks 8-15（类型/API/store/UI/路由/banner）
  - 自动化验证：auth tests 全过；web 100+ tests 全过；tsc 干净
  - 手工 §11 验收：[全部 13/13 通过 / X 项不通过见 fix 列表]
```

- [ ] **Step 5: 关闭 dev server**

```bash
pkill -f 'vite.*dev\|uvicorn.*src.service.api' 2>/dev/null || true
```

- [ ] **Step 6: 最终 commit**

两边都 `git status` + `git log --oneline -20` 确认提交完整，然后把 plan 自身（如有改动）也提交：

```bash
cd /Users/java/knowledge-engineering-web
git status
git log --oneline -20
```

如果 plan 文件需要更新（如 task 6 的 step 4 实际改了 api.py 还是别处），同步 commit：

```bash
cd /Users/java/knowledge-engineering-web
# 如果 plan 有改动
git add docs/superpowers/plans/2026-05-13-session-archiving.md
git commit -m "docs(plan): 会话归档实施完成验收"
```

---

## Self-Review

### 1. Spec coverage

| Spec § | 内容 | Task |
|---|---|---|
| §3 决策 1 | 永久保留 + 用户可控 | 全 |
| §3 决策 2 | 只做归档单 session | 全（不做 incognito/批删/zip）|
| §3 决策 3 | 归档只读不能追问 | Task 7（explain 409）+ Task 15（UI banner+disabled）|
| §3 决策 4 | 归档柜独立 Settings 页 | Task 13 + Task 14 |
| §3 决策 5 | 按工程分组汇总 | Task 6（后端）+ Task 10（store）+ Task 13（UI）|
| §3 决策 6 | 恢复 + 彻底删除 | Task 13（UI 两个按钮）|
| §3 决策 7 | hover ⋯ dropdown | Task 11（SessionMenu）+ Task 12（SessionItem 改造）|
| §3 决策 8 | 归档不写 audit，删除写 audit | Task 4/5（archive/unarchive 无 audit）+ 沿用现有 DELETE（已 audit）|
| §4 schema | archived_at + 索引 | Task 1 |
| §5 API 4 新 + 2 改 | archive/unarchive/listArchived/list filter/explain 409 | Tasks 3-7 |
| §6 权限 | reporter+ + owner | Tasks 4/5/7 |
| §7 类型/store | Session.archived_at + 2 store | Tasks 8/9/10 |
| §8 UI 4 处 | SessionItem + ArchivedPage + Settings menu + ChatPage banner | Tasks 11-15 |
| §10 边界 | 8 个 case | 散布在 Tasks 4-15 |
| §11 验收 13 条 | 全部 | Task 16 |

无 spec 项漏覆盖。

### 2. Placeholder scan

- ❌ Task 7 Step 3 含"具体位置取决于 explain 函数现有结构…需要先 cat src/service/qa_router.py 后再放在合适的位置" — 这是软指引而非占位符；engineer 需要少量判断，但代码块是完整的。可接受。
- ❌ Task 14 Step 3 "按现有数据结构格式做对应改动" — 同上，软指引。这两处都是因为现有文件复杂度高、有多种合理写法。

不是 hard placeholder（无 TBD / TODO / "implement later"），但也不是百分百死板。Engineer 需要少量上下文判断。属可接受的现实折衷。

### 3. Type consistency

- `ArchiveResponse` (auth): 同时被 archive_session + unarchive_session 用 → 一致。
- `ArchivedSession` / `ArchivedByProject` (web types): Task 8 定义，Task 10 store + Task 13 page 使用 → 一致。
- `useArchivedSessionStore`: 在 Task 10 定义，Task 13 消费 → 字段名 `byProject / isLoading / error / fetchAll / restore / permanentDelete / reset` 全程一致。
- `archiveSession` / `unarchiveSession` (api): Task 8 定义，Task 9 store 用，Task 12 SessionItem 用 → 签名一致 `(projectId, sessionId) => Promise<void>`。

无不一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-session-archiving.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 task 派一个 fresh subagent 实现，task 之间快速 spec + quality 双 review。跨仓两边各跑自己的工作目录。前 7 个 task 在 auth 仓，后 8 个在 web 仓。

**2. Inline Execution** — 当前会话内顺序跑，到 checkpoint 时停下来 review。

Which approach?
