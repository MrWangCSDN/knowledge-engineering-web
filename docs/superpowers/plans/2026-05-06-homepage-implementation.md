# 首页实施计划（v1，10 周）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 knowledge-engineering-web 首页从登录页占位状态升级为「ChatGPT 风格的代码知识问答 + 多工程切换」MVP，10 周内由 1 人完成（前端+后端+设计）。

**Architecture:** 前端 React 19 + Vite + shadcn/ui + Zustand + SSE；后端 FastAPI + MySQL + Weaviate + LLM via existing factory；按工程隔离数据（per-project）。v1 用单次 RAG 不做多步 agent。

**Tech Stack:**
- 前端：React 19, TypeScript, Vite, Tailwind v4, shadcn/ui, Zustand, axios, React Router v7
- 后端：FastAPI, SQLAlchemy 2.0 async, alembic, Weaviate, asyncmy
- 测试：Vitest（前端，新加）+ pytest（后端，已有）
- LLM：通过 `LLMProviderFactory`（已有，支持 通义/Claude/Ollama）

**Spec：** `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/首页设计.md`

**项目仓库（多个）：**
- 前端：`/Users/java/knowledge-engineering-web/`
- 后端：`/Users/java/knowledge-engineering/`（api.py 所在）
- Auth 后端：`/Users/java/knowledge-engineering-auth/`（auth_router 所在；如已合并到主仓忽略）

---

## File Structure

### 前端新增/修改文件（22 组件 + 4 store + 3 api + 3 hook + 4 type）

**新增：**
```
src/
├── pages/ChatPage.tsx                    # 替代 HomePage
├── components/
│   ├── layout/TopBar.tsx                 # 顶栏（含工程选择器）
│   ├── project/
│   │   ├── ProjectSwitcher.tsx
│   │   ├── ProjectStatusBadge.tsx
│   │   └── ProjectStatsBanner.tsx
│   ├── chat/
│   │   ├── EmptyState.tsx
│   │   ├── SuggestedQuestions.tsx
│   │   ├── MessageList.tsx
│   │   ├── UserMessage.tsx
│   │   ├── AssistantMessage.tsx
│   │   ├── ThinkingIndicator.tsx
│   │   ├── SectionRenderer.tsx           # 6 段式核心
│   │   ├── EntityLink.tsx
│   │   ├── FreshnessBadge.tsx
│   │   ├── MessageActions.tsx
│   │   └── ChatInput.tsx
│   └── session/
│       ├── SessionHistory.tsx
│       ├── ProjectGroup.tsx
│       └── SessionItem.tsx
├── stores/
│   ├── projects.ts
│   ├── chat.ts
│   └── sessions.ts
├── api/
│   ├── projects.ts
│   ├── qa.ts
│   └── sessions.ts
├── hooks/
│   ├── useSSEStream.ts
│   ├── useProject.ts
│   └── useTypewriterEffect.ts
└── types/
    ├── project.ts
    ├── chat.ts
    └── session.ts
```

**修改：**
```
src/App.tsx                               # 路由从 /project/:projectId 起算
src/components/layout/AppLayout.tsx       # 调整为 3 栏
src/components/layout/Sidebar.tsx         # 改为 SessionHistory 容器
package.json                              # 加 vitest, react-markdown, eventsource-parser
```

### 后端新增/修改文件（在 `/Users/java/knowledge-engineering/`）

**新增：**
```
src/service/
├── project_router.py                     # /api/projects CRUD
├── qa_router.py                          # /api/projects/{pid}/qa/*
├── project_models.py                     # Pydantic schemas
├── qa_models.py
├── session_models.py
├── db_models.py                          # 5 张新表 SQLAlchemy ORM
└── qa_engine/
    ├── __init__.py
    ├── retriever.py                      # Weaviate + 图查询
    ├── synthesizer.py                    # LLM 合成 6 段式
    ├── sse_emitter.py                    # 流式输出辅助
    └── prompts.py                        # prompt 模板 + few-shot

alembic/versions/<id>_homepage_tables.py  # 5 张新表迁移
scripts/
├── ke_admin_create_project.py            # CLI: 添加新工程
└── migrate_weaviate_project_id.py        # 给历史数据回填 project_id
```

**修改：**
```
src/service/api.py                        # 注册新 router；旧路由加 deprecated 头
src/core/weaviate_defaults.py             # 4 个 collection schema 加 project_id
src/knowledge/weaviate_*_store.py         # 写入时带 project_id；查询时过滤
src/pipeline/run.py                       # 加 --project 参数
src/pipeline/cli.py                       # 同上
```

---

## Phase 1 (Week 1): Foundation — 数据模型 + 测试脚手架

**目标：** 数据库 schema 落地、前后端测试框架就位、设计文档冻结。

### Task 1.1：前端引入测试框架（Vitest）

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/components/auth/LoginForm.test.tsx`（最小 smoke test）

- [ ] **Step 1：安装 Vitest 及依赖**

```bash
cd /Users/java/knowledge-engineering-web
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2：创建 `vitest.config.ts`**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
```

- [ ] **Step 3：创建 `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

- [ ] **Step 4：在 `package.json` scripts 加 test 命令**

```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:run": "vitest run"
```

- [ ] **Step 5：写最小 smoke test**

`src/components/auth/LoginForm.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { LoginForm } from './LoginForm'
import { describe, it, expect } from 'vitest'

describe('LoginForm', () => {
  it('renders username and password inputs', () => {
    render(<BrowserRouter><LoginForm /></BrowserRouter>)
    expect(screen.getByLabelText(/邮箱/)).toBeInTheDocument()
    expect(screen.getByLabelText(/密码/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6：运行测试**

```bash
npm run test:run
```
Expected: PASS（1 个测试）

- [ ] **Step 7：提交**

```bash
git add package.json vitest.config.ts src/test/ src/components/auth/LoginForm.test.tsx package-lock.json
git commit -m "test: 引入 Vitest + smoke 测试"
```

---

### Task 1.2：后端 SQLAlchemy ORM 模型（5 张新表）

**Files:**
- Create: `/Users/java/knowledge-engineering/src/service/db_models_homepage.py`
- Create: `/Users/java/knowledge-engineering/tests/test_db_models_homepage.py`

- [ ] **Step 1：写测试（验证 ORM 能正确建表）**

`tests/test_db_models_homepage.py`:
```python
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from src.service.db import Base
from src.service.db_models_homepage import Project, UserProjectAccess, QASession, QAMessage, QAFeedback


@pytest.mark.asyncio
async def test_homepage_tables_create():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 验证 5 张表都建出来
        result = await conn.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ))
        tables = {row[0] for row in result.fetchall()}
        assert "projects" in tables
        assert "user_project_access" in tables
        assert "qa_sessions" in tables
        assert "qa_messages" in tables
        assert "qa_feedback" in tables
```

- [ ] **Step 2：运行测试，预期失败**

```bash
cd /Users/java/knowledge-engineering
python -m pytest tests/test_db_models_homepage.py -v
```
Expected: FAIL with "No module named db_models_homepage"

- [ ] **Step 3：实现 ORM 模型**

`src/service/db_models_homepage.py`:
```python
"""首页相关数据表 ORM 模型。

5 张表：
  projects            - 工程元数据
  user_project_access - 用户对工程的访问权限（v2 启用 RBAC）
  qa_sessions         - 问答会话
  qa_messages         - 会话消息
  qa_feedback         - 用户反馈
"""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import (
    String, Integer, DateTime, Text, JSON, ForeignKey, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from src.service.db import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    repo_url: Mapped[str | None] = mapped_column(String(512))
    language: Mapped[str] = mapped_column(String(32), default="java")
    status: Mapped[str] = mapped_column(String(32), default="indexing")
    pipeline_at: Mapped[datetime | None] = mapped_column(DateTime)
    indexing_progress: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_by: Mapped[str | None] = mapped_column(String(64))

    __table_args__ = (Index("idx_projects_status", "status"),)


class UserProjectAccess(Base):
    __tablename__ = "user_project_access"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(32), default="reader")


class QASession(Base):
    __tablename__ = "qa_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    project_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    message_count: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        Index("idx_qa_sessions_project_user", "project_id", "user_id", "updated_at"),
    )

    messages: Mapped[list["QAMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class QAMessage(Base):
    __tablename__ = "qa_messages"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("qa_sessions.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user/assistant
    content: Mapped[str | None] = mapped_column(Text)
    sections: Mapped[list | None] = mapped_column(JSON)
    msg_metadata: Mapped[dict | None] = mapped_column("metadata", JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    __table_args__ = (Index("idx_qa_messages_session", "session_id", "created_at"),)

    session: Mapped["QASession"] = relationship(back_populates="messages")


class QAFeedback(Base):
    __tablename__ = "qa_feedback"

    message_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("qa_messages.id", ondelete="CASCADE"), primary_key=True
    )
    vote: Mapped[str | None] = mapped_column(String(8))  # up/down
    comment: Mapped[str | None] = mapped_column(Text)
    user_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

- [ ] **Step 4：运行测试，预期通过**

```bash
python -m pytest tests/test_db_models_homepage.py -v
```
Expected: PASS

- [ ] **Step 5：提交**

```bash
git add src/service/db_models_homepage.py tests/test_db_models_homepage.py
git commit -m "feat(db): 加 projects/qa_sessions/qa_messages/qa_feedback ORM 模型"
```

---

### Task 1.3：alembic 迁移脚本

**Files:**
- Create: `/Users/java/knowledge-engineering/alembic/versions/<auto>_homepage_tables.py`

- [ ] **Step 1：生成迁移**

```bash
cd /Users/java/knowledge-engineering
alembic revision --autogenerate -m "homepage tables: projects, qa_sessions, qa_messages, qa_feedback, user_project_access"
```

- [ ] **Step 2：检查生成的迁移文件**

打开 `alembic/versions/<id>_homepage_tables.py`，确认 5 张表的 `op.create_table` 都生成了。如果 alembic 没识别到，手动加。

- [ ] **Step 3：在测试 DB（SQLite/MySQL）上跑迁移**

```bash
alembic upgrade head
```
Expected: 无报错；查表能看到 5 张新表。

- [ ] **Step 4：测试 downgrade（确保可回滚）**

```bash
alembic downgrade -1
```
Expected: 5 张表被删除。然后再 `alembic upgrade head` 回到最新。

- [ ] **Step 5：提交**

```bash
git add alembic/versions/<id>_homepage_tables.py
git commit -m "chore(db): alembic 迁移 - 添加首页相关表"
```

---

### Task 1.4：前端类型定义（4 个 type 文件）

**Files:**
- Create: `src/types/project.ts`
- Create: `src/types/chat.ts`
- Create: `src/types/session.ts`
- Modify: `src/types/index.ts`（如有）

- [ ] **Step 1：创建 `src/types/project.ts`**

```typescript
// 工程状态枚举（4 种）
export type ProjectStatus = 'ready' | 'indexing' | 'partial' | 'failed'

// 工程统计信息
export interface ProjectStats {
  methods_count: number
  classes_count: number
  interpretation_progress: number  // 0-100
}

// 索引进度（仅 status === 'indexing' 时存在）
export interface IndexingProgress {
  phase: string                    // 'parsing' / 'embedding' / 'interpreting'
  percent: number                  // 0-100
  eta_seconds: number              // 预计剩余秒数
}

// 工程主类型
export interface Project {
  id: string                       // 'deposit-system'
  name: string                     // '存款系统'
  status: ProjectStatus
  stats: ProjectStats
  pipeline_at: string | null       // ISO 8601
  indexing_progress?: IndexingProgress
}
```

- [ ] **Step 2：创建 `src/types/chat.ts`**

```typescript
import type { Reference } from './session'

// 6 段式 section 类型
export type SectionType =
  | 'overview'      // 业务概述
  | 'entry_point'   // 入口方法
  | 'call_chain'    // 调用链路
  | 'db_ops'        // 数据库操作
  | 'rules'         // 关键约束
  | 'sources'       // 引用源

export interface Section {
  type: SectionType
  title: string
  content: string                  // markdown
  references?: Reference[]
}

// 消息 metadata
export interface MessageMetadata {
  entry_points: string[]
  cited_entities: string[]
  interpretation_freshness: string // ISO 8601
  token_usage: number
  latency_ms: number
}

// SSE 事件类型
export type SSEEventType =
  | 'meta'
  | 'step'
  | 'section_start'
  | 'content'
  | 'section_done'
  | 'done'
  | 'error'

export interface SSEEvent<T = unknown> {
  event: SSEEventType
  data: T
}

// chat 状态
export type ChatStatus = 'idle' | 'submitting' | 'streaming' | 'error'
```

- [ ] **Step 3：创建 `src/types/session.ts`**

```typescript
import type { Section, MessageMetadata } from './chat'

export interface Session {
  id: string
  project_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface Reference {
  entity_id: string                // 'method://com.bank.deposit.openAccount'
  display_text: string             // 'DepositController.openAccount()'
  kind: 'method' | 'class' | 'table' | 'doc'
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string                  // markdown
  sections?: Section[]
  metadata?: MessageMetadata
  created_at: string
}
```

- [ ] **Step 4：检查 TypeScript 编译**

```bash
cd /Users/java/knowledge-engineering-web
npx tsc --noEmit
```
Expected: 无新增错误

- [ ] **Step 5：提交**

```bash
git add src/types/project.ts src/types/chat.ts src/types/session.ts
git commit -m "feat(types): 添加 Project / Chat / Session 类型定义"
```

---

### Task 1.5：周末自审 + 设计文档锁版本

- [ ] **Step 1：在 Obsidian 设计文档加版本标记**

把 `首页设计.md` frontmatter 的 `status: draft` 改成 `status: locked-v1`。

- [ ] **Step 2：复盘本周进度**

W1 验收：
- ✅ Vitest 跑得动 + smoke test 通过
- ✅ 5 张新表 ORM 定义 + alembic 迁移可前进可回滚
- ✅ 前端 4 个核心 type 定义完整
- ✅ 设计文档冻结 v1 版本

---

## Phase 2 (Week 2): 项目 API + 顶栏 UI

**目标：** 后端 `/api/projects` CRUD 跑通；前端 TopBar + ProjectSwitcher 静态渲染。

### Task 2.1：后端 Project Pydantic schemas

**Files:**
- Create: `/Users/java/knowledge-engineering/src/service/project_models.py`
- Create: `/Users/java/knowledge-engineering/tests/test_project_models.py`

- [ ] **Step 1：写 schema 测试**

```python
# tests/test_project_models.py
from src.service.project_models import (
    ProjectStats, IndexingProgress, Project, ProjectStatus
)
import pytest


def test_project_minimal():
    p = Project(
        id="deposit-system",
        name="存款系统",
        status="ready",
        stats=ProjectStats(methods_count=100, classes_count=20, interpretation_progress=92),
        pipeline_at="2026-05-06T10:00:00Z",
    )
    assert p.id == "deposit-system"
    assert p.indexing_progress is None


def test_project_status_validation():
    with pytest.raises(ValueError):
        Project(
            id="x", name="x",
            status="invalid_status",  # 不在枚举里
            stats=ProjectStats(methods_count=0, classes_count=0, interpretation_progress=0),
            pipeline_at=None,
        )
```

- [ ] **Step 2：运行测试 - 预期 fail**

```bash
python -m pytest tests/test_project_models.py -v
```

- [ ] **Step 3：实现 schema**

```python
# src/service/project_models.py
"""Project 相关 Pydantic schemas（API 层）。"""
from typing import Literal, Optional
from pydantic import BaseModel, Field

ProjectStatus = Literal["ready", "indexing", "partial", "failed"]


class ProjectStats(BaseModel):
    methods_count: int = 0
    classes_count: int = 0
    interpretation_progress: int = Field(0, ge=0, le=100)


class IndexingProgress(BaseModel):
    phase: str
    percent: int = Field(..., ge=0, le=100)
    eta_seconds: int = 0


class Project(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=128)
    status: ProjectStatus = "indexing"
    stats: ProjectStats
    pipeline_at: Optional[str] = None  # ISO 8601
    indexing_progress: Optional[IndexingProgress] = None


class ProjectListResponse(BaseModel):
    projects: list[Project]


class ProjectCreateRequest(BaseModel):
    """admin only。"""
    id: str = Field(..., pattern=r"^[a-z][a-z0-9-]{1,62}[a-z0-9]$")
    name: str
    repo_url: Optional[str] = None
    language: str = "java"
```

- [ ] **Step 4：运行测试 - 预期 pass**

```bash
python -m pytest tests/test_project_models.py -v
```

- [ ] **Step 5：提交**

```bash
git add src/service/project_models.py tests/test_project_models.py
git commit -m "feat(api): Project Pydantic schemas"
```

---

### Task 2.2：后端 `/api/projects` GET 路由

**Files:**
- Create: `/Users/java/knowledge-engineering/src/service/project_router.py`
- Create: `/Users/java/knowledge-engineering/tests/test_project_router.py`
- Modify: `/Users/java/knowledge-engineering/src/service/api.py`

- [ ] **Step 1：写测试**

```python
# tests/test_project_router.py
import pytest
from httpx import AsyncClient, ASGITransport
from src.service.api import app
from src.service.db_models_homepage import Project as ProjectModel
from src.service.db import get_db


@pytest.mark.asyncio
async def test_list_projects_empty(test_db_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # TODO: mock auth header
        resp = await client.get("/api/projects", headers={"Authorization": "Bearer test"})
        assert resp.status_code == 200
        assert resp.json()["projects"] == []


@pytest.mark.asyncio
async def test_list_projects_with_data(test_db_session):
    test_db_session.add(ProjectModel(id="p1", name="P1", status="ready"))
    await test_db_session.commit()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/projects", headers={"Authorization": "Bearer test"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["projects"]) == 1
        assert data["projects"][0]["id"] == "p1"
```

> 注：`test_db_session` fixture 需要在 `conftest.py` 里创建（注入测试 DB）。如果项目已有，复用。

- [ ] **Step 2：运行测试 - 预期 fail**

- [ ] **Step 3：实现 router**

```python
# src/service/project_router.py
"""项目（工程）管理路由。

- GET  /api/projects             列出当前用户可访问的工程
- GET  /api/projects/{id}        工程详情
- POST /api/projects             创建（admin only，v2 才在 UI 暴露）
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.service.auth_dependencies import get_current_user
from src.service.auth_models import User
from src.service.db import get_db
from src.service.db_models_homepage import Project as ProjectModel
from src.service.project_models import (
    Project, ProjectListResponse, ProjectStats, IndexingProgress, ProjectCreateRequest
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _to_pydantic(p: ProjectModel) -> Project:
    """ORM Project → Pydantic Project。统计字段从 indexing_progress JSON 取，没有默认 0。"""
    progress = p.indexing_progress or {}
    return Project(
        id=p.id,
        name=p.name,
        status=p.status,  # type: ignore
        stats=ProjectStats(
            methods_count=progress.get("methods_count", 0),
            classes_count=progress.get("classes_count", 0),
            interpretation_progress=progress.get("interpretation_progress", 0),
        ),
        pipeline_at=p.pipeline_at.isoformat() + "Z" if p.pipeline_at else None,
        indexing_progress=IndexingProgress(**progress) if p.status == "indexing" and progress else None,
    )


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """列出当前用户可访问的工程（v1 全部可见，v2 加 RBAC 过滤）。"""
    result = await db.execute(select(ProjectModel).order_by(ProjectModel.created_at.desc()))
    projects = result.scalars().all()
    return ProjectListResponse(projects=[_to_pydantic(p) for p in projects])


@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = await db.get(ProjectModel, project_id)
    if p is None:
        raise HTTPException(status_code=404, detail="工程不存在")
    return _to_pydantic(p)


@router.post("", response_model=Project, status_code=201)
async def create_project(
    body: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """admin only。v1 主要给 CLI 用，前端不暴露。"""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="仅管理员可创建工程")
    existing = await db.get(ProjectModel, body.id)
    if existing:
        raise HTTPException(status_code=409, detail="工程 ID 已存在")
    p = ProjectModel(
        id=body.id, name=body.name, repo_url=body.repo_url,
        language=body.language, status="indexing",
        created_by=user.username,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _to_pydantic(p)
```

- [ ] **Step 4：在 `api.py` 注册 router**

修改 `src/service/api.py`，在 `app = FastAPI(...)` 之后加：

```python
from src.service.project_router import router as project_router
app.include_router(project_router)
```

- [ ] **Step 5：运行测试 - 预期 pass**

- [ ] **Step 6：手动测试**

```bash
# 启动服务
uvicorn src.service.api:app --reload

# 用 httpie 或 curl 测试
http GET http://localhost:8000/api/projects "Authorization:Bearer <real-token>"
```
Expected: 200 + `{"projects": []}`

- [ ] **Step 7：提交**

```bash
git add src/service/project_router.py src/service/api.py tests/test_project_router.py
git commit -m "feat(api): /api/projects GET/POST 路由"
```

---

### Task 2.3：前端 projects API client

**Files:**
- Create: `src/api/projects.ts`
- Create: `src/api/projects.test.ts`

- [ ] **Step 1：写测试（用 MSW 或 axios mock）**

简化版（直接 mock axios）：
```typescript
// src/api/projects.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listProjects, getProject } from './projects'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: { get: vi.fn() }
}))

describe('projects api', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listProjects returns array', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { projects: [{ id: 'p1', name: 'P1', status: 'ready', stats: {methods_count:0,classes_count:0,interpretation_progress:0}, pipeline_at: null }] }
    })
    const result = await listProjects()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
    expect(apiClient.get).toHaveBeenCalledWith('/projects')
  })

  it('getProject returns single project', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { id: 'p1', name: 'P1', status: 'ready', stats: {methods_count:0,classes_count:0,interpretation_progress:0}, pipeline_at: null }
    })
    const result = await getProject('p1')
    expect(result.id).toBe('p1')
    expect(apiClient.get).toHaveBeenCalledWith('/projects/p1')
  })
})
```

- [ ] **Step 2：实现 API client**

```typescript
// src/api/projects.ts
import { apiClient } from './client'
import type { Project } from '@/types/project'

interface ProjectListResponse {
  projects: Project[]
}

/** 列出当前用户可访问的工程。 */
export async function listProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<ProjectListResponse>('/projects')
  return data.projects
}

/** 获取指定工程详情。 */
export async function getProject(projectId: string): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/projects/${projectId}`)
  return data
}
```

- [ ] **Step 3：运行测试 - 预期 pass**

```bash
npm run test:run -- src/api/projects.test.ts
```

- [ ] **Step 4：提交**

```bash
git add src/api/projects.ts src/api/projects.test.ts
git commit -m "feat(api): 前端 projects api client"
```

---

### Task 2.4：前端 projects Zustand store

**Files:**
- Create: `src/stores/projects.ts`
- Create: `src/stores/projects.test.ts`

- [ ] **Step 1：实现 store（精简版，无测试）**

```typescript
// src/stores/projects.ts
import { create } from 'zustand'
import { listProjects } from '@/api/projects'
import type { Project } from '@/types/project'

interface ProjectStore {
  projects: Project[]
  currentProjectId: string | null
  isLoading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  setCurrentProject: (id: string) => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const projects = await listProjects()
      set({ projects, isLoading: false })
      // 如果没有 currentProjectId，默认选第一个
      if (!get().currentProjectId && projects.length > 0) {
        set({ currentProjectId: projects[0].id })
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  setCurrentProject: (id: string) => {
    set({ currentProjectId: id })
  },
}))
```

- [ ] **Step 2：写 store 测试**

```typescript
// src/stores/projects.test.ts
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useProjectStore } from './projects'

vi.mock('@/api/projects', () => ({
  listProjects: vi.fn(),
}))

import { listProjects } from '@/api/projects'

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], currentProjectId: null, isLoading: false, error: null })
    vi.clearAllMocks()
  })

  it('fetchProjects sets first project as current', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p1', name: 'P1', status: 'ready', stats: {methods_count:0,classes_count:0,interpretation_progress:0}, pipeline_at: null },
      { id: 'p2', name: 'P2', status: 'ready', stats: {methods_count:0,classes_count:0,interpretation_progress:0}, pipeline_at: null },
    ])
    await useProjectStore.getState().fetchProjects()
    const state = useProjectStore.getState()
    expect(state.projects).toHaveLength(2)
    expect(state.currentProjectId).toBe('p1')
    expect(state.error).toBeNull()
  })

  it('setCurrentProject updates id', () => {
    useProjectStore.getState().setCurrentProject('p2')
    expect(useProjectStore.getState().currentProjectId).toBe('p2')
  })
})
```

- [ ] **Step 3：运行测试**

```bash
npm run test:run -- src/stores/projects.test.ts
```
Expected: PASS

- [ ] **Step 4：提交**

```bash
git add src/stores/projects.ts src/stores/projects.test.ts
git commit -m "feat(store): projects Zustand store"
```

---

### Task 2.5：前端 ProjectStatusBadge 组件

**Files:**
- Create: `src/components/project/ProjectStatusBadge.tsx`
- Create: `src/components/project/ProjectStatusBadge.test.tsx`

- [ ] **Step 1：实现组件**

```typescript
// src/components/project/ProjectStatusBadge.tsx
import type { ProjectStatus } from '@/types/project'

interface Props {
  status: ProjectStatus
  progress?: number  // 仅 indexing 时有
}

const STATUS_CONFIG: Record<ProjectStatus, { icon: string; label: string; color: string }> = {
  ready:    { icon: '💚', label: '就绪',     color: 'text-emerald-500' },
  indexing: { icon: '🟡', label: '索引中',   color: 'text-amber-500' },
  partial:  { icon: '🟠', label: '部分就绪', color: 'text-orange-500' },
  failed:   { icon: '🔴', label: '索引失败', color: 'text-red-500' },
}

export function ProjectStatusBadge({ status, progress }: Props) {
  const cfg = STATUS_CONFIG[status]
  const text = status === 'indexing' && progress != null
    ? `${cfg.label} · 进度 ${progress}%`
    : cfg.label
  return (
    <span className={`text-xs ${cfg.color}`}>
      {cfg.icon} {text}
    </span>
  )
}
```

- [ ] **Step 2：写组件测试**

```typescript
// src/components/project/ProjectStatusBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProjectStatusBadge } from './ProjectStatusBadge'

describe('ProjectStatusBadge', () => {
  it('renders ready status', () => {
    render(<ProjectStatusBadge status="ready" />)
    expect(screen.getByText(/就绪/)).toBeInTheDocument()
  })

  it('renders indexing with progress', () => {
    render(<ProjectStatusBadge status="indexing" progress={45} />)
    expect(screen.getByText(/进度 45%/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3：测试 + 提交**

```bash
npm run test:run -- ProjectStatusBadge
git add src/components/project/ProjectStatusBadge.{tsx,test.tsx}
git commit -m "feat(ui): ProjectStatusBadge"
```

---

### Task 2.6：前端 ProjectSwitcher 组件（用 shadcn DropdownMenu）

**Files:**
- Create: `src/components/project/ProjectSwitcher.tsx`
- Add shadcn dropdown-menu component

- [ ] **Step 1：安装 shadcn dropdown-menu**

```bash
npx shadcn@latest add dropdown-menu
```

- [ ] **Step 2：实现组件**

```typescript
// src/components/project/ProjectSwitcher.tsx
import { ChevronDown, FolderClosed } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { useProjectStore } from '@/stores/projects'
import { ProjectStatusBadge } from './ProjectStatusBadge'

export function ProjectSwitcher() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const projects = useProjectStore(s => s.projects)
  const current = projects.find(p => p.id === projectId) ?? projects[0]

  if (!current) {
    return (
      <button className="text-sm text-muted-foreground px-3 py-2">
        <FolderClosed className="inline h-4 w-4 mr-1" />
        选择工程 <ChevronDown className="inline h-4 w-4" />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 px-3 py-2 hover:bg-muted rounded">
        <FolderClosed className="h-4 w-4" />
        <span className="text-sm font-medium truncate max-w-[180px]">{current.name}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[360px]">
        {projects.map(p => (
          <DropdownMenuItem
            key={p.id}
            disabled={p.status === 'indexing' || p.status === 'failed'}
            onClick={() => navigate(`/project/${p.id}`)}
            className="flex flex-col items-start gap-1 py-2"
          >
            <div className="flex items-center gap-2 w-full">
              {p.id === current.id && <span>✓</span>}
              <span className="font-medium">{p.name}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {p.stats.methods_count} 方法 · 解读 {p.stats.interpretation_progress}%
            </div>
            <ProjectStatusBadge
              status={p.status}
              progress={p.indexing_progress?.percent}
            />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-xs text-muted-foreground">
          + 添加新工程（管理员请用 CLI）
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 3：写最简单的渲染测试**

```typescript
// src/components/project/ProjectSwitcher.test.tsx
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { ProjectSwitcher } from './ProjectSwitcher'
import { useProjectStore } from '@/stores/projects'

function setup() {
  return render(<BrowserRouter><ProjectSwitcher /></BrowserRouter>)
}

describe('ProjectSwitcher', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], currentProjectId: null })
  })

  it('shows "select project" when no projects loaded', () => {
    setup()
    expect(screen.getByText(/选择工程/)).toBeInTheDocument()
  })

  it('shows current project name', () => {
    useProjectStore.setState({
      projects: [{ id: 'p1', name: '存款系统', status: 'ready', stats: {methods_count:100,classes_count:20,interpretation_progress:90}, pipeline_at: null }],
      currentProjectId: 'p1',
    })
    setup()
    expect(screen.getByText('存款系统')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4：测试 + 提交**

```bash
npm run test:run -- ProjectSwitcher
git add src/components/project/ProjectSwitcher.{tsx,test.tsx} src/components/ui/dropdown-menu.tsx
git commit -m "feat(ui): ProjectSwitcher 组件"
```

---

### Task 2.7：前端 TopBar + AppLayout 调整为 3 栏

**Files:**
- Create: `src/components/layout/TopBar.tsx`
- Modify: `src/components/layout/AppLayout.tsx`

- [ ] **Step 1：实现 TopBar**

```typescript
// src/components/layout/TopBar.tsx
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { ProjectSwitcher } from '@/components/project/ProjectSwitcher'
import { UserMenu } from '@/components/auth/UserMenu'

export function TopBar() {
  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-4">
      <Link to="/" className="flex items-center gap-2">
        <span className="text-xl">💎</span>
        <span className="font-semibold">KE</span>
      </Link>
      <div className="h-6 w-px bg-border" />
      <ProjectSwitcher />
      <div className="ml-auto flex items-center gap-2">
        <button className="p-2 hover:bg-muted rounded">
          <Bell className="h-4 w-4" />
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
```

- [ ] **Step 2：调整 AppLayout 为 3 栏**

```typescript
// src/components/layout/AppLayout.tsx
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[280px] border-r overflow-y-auto hidden lg:block">
          <Sidebar />
        </aside>
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3：手动验证**

```bash
npm run dev
# 浏览器看 http://localhost:5173/，登录后应该看到 3 栏布局
```

- [ ] **Step 4：提交**

```bash
git add src/components/layout/TopBar.tsx src/components/layout/AppLayout.tsx
git commit -m "feat(ui): TopBar + 3 栏 AppLayout"
```

---

### Week 2 验收

- ✅ 后端 `/api/projects` GET/POST 跑通（curl 验证）
- ✅ 前端 listProjects + Zustand store + DropdownMenu 渲染
- ✅ 3 栏布局上线，TopBar 含工程选择器
- ✅ 切工程会变 URL（`/project/p1` → `/project/p2`）

---

## Phase 3 (Week 3): QA Engine 检索 + 合成

**目标：** 后端 `qa_engine` 模块跑通：能从问题 → 找到候选实体 → 拼 context → 调 LLM 出 6 段式答案。**这周不做 SSE，先用同步返回验证质量。**

### Task 3.1：QA Engine retriever（Weaviate + 图查询封装）

**Files:**
- Create: `/Users/java/knowledge-engineering/src/service/qa_engine/__init__.py`
- Create: `/Users/java/knowledge-engineering/src/service/qa_engine/retriever.py`
- Create: `/Users/java/knowledge-engineering/tests/test_qa_retriever.py`

- [ ] **Step 1：写测试（mock Weaviate）**

```python
# tests/test_qa_retriever.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from src.service.qa_engine.retriever import QARetriever, RetrievedContext


@pytest.mark.asyncio
async def test_retriever_returns_top_k_entries():
    mock_business_store = MagicMock()
    mock_business_store.search_method_hits_by_text = MagicMock(return_value=[
        {"entity_id": "method://com.bank.deposit.openAccount", "summary_text": "开户方法", "level": "api"},
        {"entity_id": "method://com.bank.deposit.kycCheck", "summary_text": "KYC 校验", "level": "method"},
    ])
    mock_graph = MagicMock()
    mock_graph.successors = MagicMock(return_value=["method://kycCheck", "method://riskApprove"])
    mock_graph.predecessors = MagicMock(return_value=[])

    retriever = QARetriever(business_store=mock_business_store, graph=mock_graph)
    ctx = await retriever.retrieve(
        question="存款开户的设计逻辑",
        project_id="deposit-system",
        top_k=5,
    )
    assert isinstance(ctx, RetrievedContext)
    assert len(ctx.entry_candidates) == 2
    assert ctx.entry_candidates[0]["entity_id"] == "method://com.bank.deposit.openAccount"
    assert "method://kycCheck" in ctx.callees_by_entry
```

- [ ] **Step 2：实现 retriever**

```python
# src/service/qa_engine/__init__.py
"""QA 引擎：检索 + 合成代码知识答案。"""

# src/service/qa_engine/retriever.py
"""检索阶段：业务概念 → 候选入口方法 + 调用链上下文。"""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RetrievedContext:
    """检索结果，喂给 synthesizer 作为 LLM context。"""
    question: str
    project_id: str
    entry_candidates: list[dict[str, Any]]            # BusinessInterpretation 命中
    callees_by_entry: dict[str, list[str]] = field(default_factory=dict)
    callers_by_entry: dict[str, list[str]] = field(default_factory=dict)
    table_access_by_entry: dict[str, list[dict]] = field(default_factory=dict)


class QARetriever:
    """从 Weaviate + 图谱检索候选实体 + 调用链。"""

    def __init__(self, business_store, graph, code_store=None):
        self.business_store = business_store
        self.graph = graph
        self.code_store = code_store

    async def retrieve(self, *, question: str, project_id: str, top_k: int = 5) -> RetrievedContext:
        # 1. 用问题做语义检索 BusinessInterpretation（带 project_id 过滤）
        candidates = self.business_store.search_method_hits_by_text(
            text=question, project_id=project_id, limit=top_k
        )

        ctx = RetrievedContext(question=question, project_id=project_id, entry_candidates=candidates)

        # 2. 对每个候选，取 1 跳调用链
        for c in candidates[:3]:  # 只对 top 3 取链路（控制成本）
            entity_id = c["entity_id"]
            ctx.callees_by_entry[entity_id] = list(self.graph.successors(entity_id))[:5]
            ctx.callers_by_entry[entity_id] = list(self.graph.predecessors(entity_id))[:5]

            # 3. 取数据库访问（如果方法访问了表）
            ctx.table_access_by_entry[entity_id] = self._extract_table_access(entity_id)

        return ctx

    def _extract_table_access(self, entity_id: str) -> list[dict]:
        """从图谱里提取这个方法访问的表。"""
        try:
            # 假设图上有 'accesses_table' 关系
            tables = []
            for table_id in self.graph.successors(entity_id, edge_type="accesses_table"):
                tables.append({"table_id": table_id, "operation": "unknown"})
            return tables
        except Exception:
            return []
```

- [ ] **Step 3：运行测试 - 预期 pass**

```bash
python -m pytest tests/test_qa_retriever.py -v
```

- [ ] **Step 4：提交**

```bash
git add src/service/qa_engine/__init__.py src/service/qa_engine/retriever.py tests/test_qa_retriever.py
git commit -m "feat(qa): retriever 检索 BusinessInterpretation + 调用链"
```

---

### Task 3.2：QA Engine prompts（6 段式 prompt 模板）

**Files:**
- Create: `/Users/java/knowledge-engineering/src/service/qa_engine/prompts.py`

- [ ] **Step 1：实现 prompt 模板**

```python
# src/service/qa_engine/prompts.py
"""LLM prompt 模板。

设计原则：
1. 强制结构化输出（6 段式 JSON），LLM 不能自由发挥
2. 引用强约束：方法名/类名必须真实，不允许编造
3. 新鲜度透明：在 sources 段标注解读生成时间
4. 中文输出
"""

SYSTEM_PROMPT = """你是企业代码知识分析师。你的任务是把代码翻译成业务方/新人能读懂的业务文档。

**严格规则**：
1. **不允许编造**：所有方法名、类名、表名必须出自我提供的 context，不能从知识里"想当然"
2. **结构化输出**：必须按 6 段式 JSON 输出，缺信息的段落直接省略（不要凑字数）
3. **简洁专业**：每段 50-200 字，不啰嗦
4. **引用标记**：提到方法/类/表时，用 `[entity_id|显示文本]` 格式（前端会转链接）
5. **中文输出**

**6 段式结构**：
- overview：1-2 句业务概述（这个流程做什么、面向谁）
- entry_point：入口方法（Controller / API entry），HTTP 路径
- call_chain：调用步骤列表，每步 1 行业务说明
- db_ops：数据库操作（INSERT/UPDATE/DELETE 哪些表）
- rules：关键约束/业务规则
- sources：引用的代码实体 + 业务文档

输出格式（必须是合法 JSON）：
```json
{
  "sections": [
    {"type": "overview", "title": "业务概述", "content": "...", "references": []},
    {"type": "entry_point", "title": "入口方法", "content": "...", "references": [...]},
    ...
  ]
}
```

每个 reference: `{"entity_id": "method://...", "display_text": "...", "kind": "method|class|table|doc"}`
"""


def build_user_prompt(question: str, context: dict) -> str:
    """组装 user prompt：问题 + 检索到的 context。"""
    parts = [f"用户问题：{question}", "", "可用 context："]

    if context.get("entry_candidates"):
        parts.append("候选入口方法（按相关度排序）：")
        for i, c in enumerate(context["entry_candidates"][:3], 1):
            parts.append(f"{i}. entity_id: {c['entity_id']}")
            parts.append(f"   level: {c.get('level', 'method')}")
            parts.append(f"   业务说明: {c.get('summary_text', '(无)')[:300]}")
            parts.append("")

    if context.get("callees_by_entry"):
        parts.append("调用关系（每个候选的下游方法）：")
        for entry, callees in context["callees_by_entry"].items():
            parts.append(f"- {entry}")
            for c in callees:
                parts.append(f"    → {c}")
        parts.append("")

    if context.get("table_access_by_entry"):
        parts.append("数据库访问：")
        for entry, tables in context["table_access_by_entry"].items():
            if tables:
                parts.append(f"- {entry}")
                for t in tables:
                    parts.append(f"    {t.get('operation', '?')} {t['table_id']}")
        parts.append("")

    parts.append("请基于以上 context 回答用户问题，输出 6 段式 JSON。")
    return "\n".join(parts)


# 多轮对话压缩 prompt
HISTORY_SUMMARIZE_PROMPT = """以下是用户之前的对话历史。请用 1-2 句话概括重点，作为后续对话的上下文：

{history}

概括："""
```

- [ ] **Step 2：提交**

```bash
git add src/service/qa_engine/prompts.py
git commit -m "feat(qa): 6 段式 prompt 模板"
```

---

### Task 3.3：QA Engine synthesizer（LLM 调用 + JSON 解析）

**Files:**
- Create: `/Users/java/knowledge-engineering/src/service/qa_engine/synthesizer.py`
- Create: `/Users/java/knowledge-engineering/tests/test_qa_synthesizer.py`

- [ ] **Step 1：写测试**

```python
# tests/test_qa_synthesizer.py
import pytest
import json
from unittest.mock import AsyncMock, MagicMock
from src.service.qa_engine.retriever import RetrievedContext
from src.service.qa_engine.synthesizer import QASynthesizer, SynthesizedAnswer


@pytest.mark.asyncio
async def test_synthesizer_returns_structured_answer():
    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value=json.dumps({
        "sections": [
            {"type": "overview", "title": "业务概述",
             "content": "存款开户是核心流程...", "references": []},
            {"type": "entry_point", "title": "入口方法",
             "content": "[method://openAccount|DepositController.openAccount()]",
             "references": [{"entity_id": "method://openAccount", "display_text": "DepositController.openAccount()", "kind": "method"}]},
        ]
    }, ensure_ascii=False))

    synthesizer = QASynthesizer(llm_provider=mock_llm)
    ctx = RetrievedContext(
        question="存款开户的设计逻辑",
        project_id="deposit-system",
        entry_candidates=[{"entity_id": "method://openAccount", "summary_text": "...", "level": "api"}],
    )
    result = await synthesizer.synthesize(ctx)
    assert isinstance(result, SynthesizedAnswer)
    assert len(result.sections) == 2
    assert result.sections[0]["type"] == "overview"
    assert result.token_usage > 0


@pytest.mark.asyncio
async def test_synthesizer_handles_invalid_json():
    """LLM 输出不是合法 JSON 时降级为单段 markdown。"""
    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value="这是一段普通 markdown 不是 JSON")

    synthesizer = QASynthesizer(llm_provider=mock_llm)
    ctx = RetrievedContext(question="x", project_id="p1", entry_candidates=[])
    result = await synthesizer.synthesize(ctx)
    assert len(result.sections) == 1
    assert result.sections[0]["type"] == "overview"
    assert "markdown" in result.sections[0]["content"]
```

- [ ] **Step 2：实现 synthesizer**

```python
# src/service/qa_engine/synthesizer.py
"""LLM 合成阶段：把检索到的 context 喂给 LLM，输出 6 段式 JSON。"""
import json
from dataclasses import dataclass, asdict
from typing import Any
from src.service.qa_engine.retriever import RetrievedContext
from src.service.qa_engine.prompts import SYSTEM_PROMPT, build_user_prompt


@dataclass
class SynthesizedAnswer:
    sections: list[dict]
    token_usage: int = 0
    cost_yuan: float = 0.0
    raw_output: str = ""


class QASynthesizer:
    def __init__(self, llm_provider):
        """llm_provider 需要有 async complete(system, user) -> str 方法。"""
        self.llm = llm_provider

    async def synthesize(self, ctx: RetrievedContext) -> SynthesizedAnswer:
        """同步版（v1 单次调用）。SSE 流式版在 sse_emitter.py 里。"""
        user_prompt = build_user_prompt(ctx.question, asdict_safe(ctx))
        try:
            raw = await self.llm.complete(system=SYSTEM_PROMPT, user=user_prompt)
        except Exception as e:
            return SynthesizedAnswer(
                sections=[{"type": "overview", "title": "出错了",
                           "content": f"LLM 调用失败：{e}", "references": []}],
                raw_output=str(e),
            )

        sections = self._parse_sections(raw)
        return SynthesizedAnswer(
            sections=sections,
            token_usage=len(user_prompt.split()) + len(raw.split()),  # 粗算
            raw_output=raw,
        )

    def _parse_sections(self, raw: str) -> list[dict]:
        """解析 LLM 输出。失败时降级为单段 markdown（不抛错）。"""
        try:
            # 尝试找 ```json ... ``` 包裹
            if "```json" in raw:
                raw = raw.split("```json")[1].split("```")[0].strip()
            data = json.loads(raw)
            sections = data.get("sections", [])
            # 校验每段都有必要字段
            valid = [s for s in sections if "type" in s and "content" in s]
            if valid:
                return valid
        except (json.JSONDecodeError, KeyError, IndexError):
            pass
        # 降级：包成单段 markdown
        return [{"type": "overview", "title": "回答", "content": raw, "references": []}]


def asdict_safe(ctx: RetrievedContext) -> dict:
    return {
        "entry_candidates": ctx.entry_candidates,
        "callees_by_entry": ctx.callees_by_entry,
        "callers_by_entry": ctx.callers_by_entry,
        "table_access_by_entry": ctx.table_access_by_entry,
    }
```

- [ ] **Step 3：测试 + 提交**

```bash
python -m pytest tests/test_qa_synthesizer.py -v
git add src/service/qa_engine/synthesizer.py tests/test_qa_synthesizer.py
git commit -m "feat(qa): synthesizer 调 LLM 合成 6 段式答案"
```

---

### Task 3.4：QA Engine 端到端集成测试（用真实 LLM）

**Files:**
- Create: `/Users/java/knowledge-engineering/tests/test_qa_engine_e2e.py`（标记为 `@pytest.mark.e2e`，CI 跳过）

- [ ] **Step 1：写 E2E 测试**

```python
# tests/test_qa_engine_e2e.py
"""端到端测试。需要真实 LLM + Weaviate；用 -m e2e 才会跑。"""
import pytest
from src.service.qa_engine.retriever import QARetriever
from src.service.qa_engine.synthesizer import QASynthesizer


@pytest.mark.e2e
@pytest.mark.asyncio
async def test_e2e_explain_question(real_llm_provider, real_business_store, real_graph):
    retriever = QARetriever(business_store=real_business_store, graph=real_graph)
    synthesizer = QASynthesizer(llm_provider=real_llm_provider)

    ctx = await retriever.retrieve(
        question="存款开户的设计逻辑是怎样的？",
        project_id="default",  # 用历史数据
        top_k=5,
    )
    answer = await synthesizer.synthesize(ctx)

    # 至少有 overview 段
    assert any(s["type"] == "overview" for s in answer.sections)
    # 没有空 sections
    assert all(s["content"] for s in answer.sections)
    # 不能有"我不知道"之类的回避答案
    overview_text = next(s["content"] for s in answer.sections if s["type"] == "overview")
    assert "不知道" not in overview_text
```

- [ ] **Step 2：手动跑一次（确认能联通真实 LLM + Weaviate）**

```bash
cd /Users/java/knowledge-engineering
KE_DB_URL=mysql+asyncmy://... \
LLM_PROVIDER=tongyi \
python -m pytest tests/test_qa_engine_e2e.py -v -m e2e -s
```

如果失败，**这周必须修通**。常见问题：
- BusinessInterpretation collection 没有 project_id 字段（W7 才迁移；这里先用 `default`）
- LLM provider 配置不对
- Graph 加载方式

- [ ] **Step 3：提交**

```bash
git add tests/test_qa_engine_e2e.py
git commit -m "test(qa): 端到端 E2E 测试（标记 e2e，CI 跳过）"
```

---

### Week 3 验收

- ✅ retriever 单测通过（mock Weaviate）
- ✅ synthesizer 单测通过（mock LLM；包括 JSON 解析失败降级）
- ✅ E2E 跑得通至少 1 个真实问题（"存款开户" 或 demo 项目里的问题）
- ✅ 答案至少包含 overview 段，没有空 section

---

## Phase 4 (Week 4): SSE 流式 + 前端 hook + ChatPage 静态布局

**目标：** `qa_router` 暴露 SSE 接口；前端 useSSEStream 接通；ChatPage 静态布局完成。

### Task 4.1：后端 SSE emitter

**Files:**
- Create: `/Users/java/knowledge-engineering/src/service/qa_engine/sse_emitter.py`
- Create: `/Users/java/knowledge-engineering/tests/test_sse_emitter.py`

- [ ] **Step 1：实现 emitter（异步生成器）**

```python
# src/service/qa_engine/sse_emitter.py
"""SSE 事件流式生成器。

使用方法：
    async for event in stream_qa_answer(ctx, retriever, synthesizer):
        yield format_sse(event)
"""
import json
import time
import uuid
from typing import AsyncIterator, Any
from src.service.qa_engine.retriever import QARetriever
from src.service.qa_engine.synthesizer import QASynthesizer


def format_sse(event_type: str, data: Any) -> str:
    """把数据格式化为 SSE 行。"""
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event_type}\ndata: {payload}\n\n"


async def stream_qa_answer(
    *,
    question: str,
    project_id: str,
    session_id: str,
    retriever: QARetriever,
    synthesizer: QASynthesizer,
) -> AsyncIterator[str]:
    """v1：先发 meta + step + 一次性 done。v1.5 升级为 token-by-token。"""
    message_id = "msg_" + uuid.uuid4().hex[:12]
    start = time.time()

    # 1. meta
    yield format_sse("meta", {
        "session_id": session_id,
        "message_id": message_id,
        "plan_steps": ["搜索", "提取链路", "合成"],
    })

    # 2. step: searching
    yield format_sse("step", {"phase": "searching", "desc": "检索相关代码实体"})
    ctx = await retriever.retrieve(question=question, project_id=project_id, top_k=5)

    # 3. step: chain extraction
    yield format_sse("step", {"phase": "chain_extraction", "desc": "提取调用链路"})

    # 4. step: synthesis
    yield format_sse("step", {"phase": "synthesizing", "desc": "合成业务文档"})
    answer = await synthesizer.synthesize(ctx)

    # 5. 按段发出（v1 整段 dump，不做 token 流）
    for section in answer.sections:
        yield format_sse("section_start", {
            "section": section["type"],
            "title": section.get("title", ""),
        })
        yield format_sse("content", {
            "section": section["type"],
            "delta": section["content"],
        })
        yield format_sse("section_done", {
            "section": section["type"],
            "references": section.get("references", []),
        })

    # 6. done
    yield format_sse("done", {
        "session_id": session_id,
        "message_id": message_id,
        "total_tokens": answer.token_usage,
        "cost_yuan": answer.cost_yuan,
        "latency_ms": int((time.time() - start) * 1000),
    })
```

- [ ] **Step 2：写测试**

```python
# tests/test_sse_emitter.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from src.service.qa_engine.sse_emitter import stream_qa_answer, format_sse


def test_format_sse_basic():
    s = format_sse("meta", {"k": "v"})
    assert "event: meta" in s
    assert '"k":' in s and '"v"' in s
    assert s.endswith("\n\n")


def test_format_sse_chinese():
    s = format_sse("content", {"delta": "存款开户"})
    assert "存款开户" in s  # ensure_ascii=False 生效


@pytest.mark.asyncio
async def test_stream_qa_answer_emits_all_phases():
    mock_retriever = MagicMock()
    mock_retriever.retrieve = AsyncMock(return_value=MagicMock(entry_candidates=[]))
    mock_synthesizer = MagicMock()
    mock_synthesizer.synthesize = AsyncMock(return_value=MagicMock(
        sections=[{"type": "overview", "title": "业务概述", "content": "...", "references": []}],
        token_usage=100, cost_yuan=0.05,
    ))

    events = []
    async for chunk in stream_qa_answer(
        question="x", project_id="p1", session_id="s1",
        retriever=mock_retriever, synthesizer=mock_synthesizer,
    ):
        events.append(chunk)

    event_types = [e.split("\n")[0].replace("event: ", "") for e in events]
    assert "meta" in event_types
    assert "step" in event_types
    assert "section_start" in event_types
    assert "content" in event_types
    assert "section_done" in event_types
    assert "done" in event_types
```

- [ ] **Step 3：测试 + 提交**

```bash
python -m pytest tests/test_sse_emitter.py -v
git add src/service/qa_engine/sse_emitter.py tests/test_sse_emitter.py
git commit -m "feat(qa): SSE emitter 异步流式输出"
```

---

### Task 4.2：后端 qa_router POST /qa/explain（SSE）

**Files:**
- Create: `/Users/java/knowledge-engineering/src/service/qa_router.py`
- Modify: `/Users/java/knowledge-engineering/src/service/api.py`

- [ ] **Step 1：实现 router**

```python
# src/service/qa_router.py
"""问答路由。"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from src.service.auth_dependencies import get_current_user
from src.service.auth_models import User
from src.service.db import get_db
from src.service.db_models_homepage import Project as ProjectModel, QASession
from src.service.qa_engine.sse_emitter import stream_qa_answer
from src.service.qa_engine.retriever import QARetriever
from src.service.qa_engine.synthesizer import QASynthesizer
import uuid


router = APIRouter(prefix="/api/projects/{project_id}/qa", tags=["qa"])


class ExplainRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    history: Optional[list[dict]] = None


@router.post("/explain")
async def explain(
    project_id: str,
    body: ExplainRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # 工程存在性 + 状态校验
    p = await db.get(ProjectModel, project_id)
    if p is None:
        raise HTTPException(status_code=404, detail="工程不存在")
    if p.status == "indexing":
        raise HTTPException(status_code=409, detail="工程正在索引，请稍后再试")

    # 创建/复用 session
    session_id = body.session_id or "sess_" + uuid.uuid4().hex[:12]
    if not body.session_id:
        sess = QASession(
            id=session_id, project_id=project_id, user_id=user.username,
            title=body.question[:30],
        )
        db.add(sess)
        await db.commit()

    # 注入 retriever / synthesizer（v1 用 app.state；后面可以改成 dependency injection）
    from src.service.api import app
    retriever: QARetriever = app.state.qa_retriever
    synthesizer: QASynthesizer = app.state.qa_synthesizer

    return StreamingResponse(
        stream_qa_answer(
            question=body.question,
            project_id=project_id,
            session_id=session_id,
            retriever=retriever,
            synthesizer=synthesizer,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 2：在 `api.py` 注册 + 初始化 retriever/synthesizer**

```python
# 在 api.py 加：
from src.service.qa_router import router as qa_router
from src.service.qa_engine.retriever import QARetriever
from src.service.qa_engine.synthesizer import QASynthesizer

# app 初始化后：
app.include_router(qa_router)

@app.on_event("startup")
async def init_qa_engine():
    # 这里要把现有的 business_store / graph / llm_provider 注入
    business_store = ...  # 现有 weaviate_business_store
    graph = ...           # 现有 KnowledgeGraph
    llm = ...             # 现有 LLMProviderFactory.get_default()
    app.state.qa_retriever = QARetriever(business_store=business_store, graph=graph)
    app.state.qa_synthesizer = QASynthesizer(llm_provider=llm)
```

> 实际接现有代码时，参考 `src/knowledge/` 下已有的 weaviate store 和 graph 加载方式。

- [ ] **Step 3：手动 SSE 测试**

```bash
curl -N -X POST http://localhost:8000/api/projects/default/qa/explain \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"question": "存款开户的设计逻辑"}'
```
Expected: 看到 `event: meta` / `event: step` / `event: content` 等流式输出。

- [ ] **Step 4：提交**

```bash
git add src/service/qa_router.py src/service/api.py
git commit -m "feat(api): /qa/explain SSE 路由 + qa_engine 启动注入"
```

---

### Task 4.3：前端 useSSEStream hook

**Files:**
- Create: `src/hooks/useSSEStream.ts`
- Create: `src/hooks/useSSEStream.test.ts`

- [ ] **Step 1：实现 hook**

```typescript
// src/hooks/useSSEStream.ts
import { useState, useCallback, useRef } from 'react'
import { createParser } from 'eventsource-parser'
import type { SSEEvent } from '@/types/chat'

interface UseSSEStreamOptions {
  url: string
  body?: unknown
  headers?: Record<string, string>
}

interface UseSSEStreamReturn {
  events: SSEEvent[]
  status: 'idle' | 'streaming' | 'done' | 'error'
  error: Error | null
  start: () => Promise<void>
  abort: () => void
}

/** 用 fetch + ReadableStream 接收 SSE 事件。比 EventSource 灵活（支持 POST body）。 */
export function useSSEStream(opts: UseSSEStreamOptions): UseSSEStreamReturn {
  const [events, setEvents] = useState<SSEEvent[]>([])
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle')
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const start = useCallback(async () => {
    setEvents([])
    setStatus('streaming')
    setError(null)
    abortRef.current = new AbortController()

    try {
      const res = await fetch(opts.url, {
        method: opts.body ? 'POST' : 'GET',
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...opts.headers,
        },
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('no response body')

      const parser = createParser({
        onEvent: (event) => {
          if (!event.event || !event.data) return
          try {
            const data = JSON.parse(event.data)
            setEvents(prev => [...prev, { event: event.event as SSEEvent['event'], data }])
            if (event.event === 'done') setStatus('done')
            if (event.event === 'error') setStatus('error')
          } catch {
            // ignore malformed event
          }
        },
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(decoder.decode(value, { stream: true }))
      }

      if (status !== 'done' && status !== 'error') setStatus('done')
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('idle')
      } else {
        setError(err as Error)
        setStatus('error')
      }
    }
  }, [opts.url, opts.body, opts.headers])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { events, status, error, start, abort }
}
```

- [ ] **Step 2：装 eventsource-parser**

```bash
npm install eventsource-parser
```

- [ ] **Step 3：写最简单的测试**

跳过单测（SSE 测试需要 mock fetch + ReadableStream，复杂；E2E 在 W4 末手测）。

- [ ] **Step 4：提交**

```bash
git add src/hooks/useSSEStream.ts package.json package-lock.json
git commit -m "feat(hook): useSSEStream POST + 事件解析"
```

---

### Task 4.4：前端 ChatPage 静态布局 + EmptyState

**Files:**
- Create: `src/pages/ChatPage.tsx`
- Create: `src/components/chat/EmptyState.tsx`
- Create: `src/components/chat/SuggestedQuestions.tsx`
- Create: `src/components/chat/ChatInput.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1：实现 ChatPage 容器**

```typescript
// src/pages/ChatPage.tsx
import { useParams } from 'react-router-dom'
import { useProjectStore } from '@/stores/projects'
import { EmptyState } from '@/components/chat/EmptyState'
import { ChatInput } from '@/components/chat/ChatInput'

export function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = useProjectStore(s => s.projects.find(p => p.id === projectId))

  if (!project) return <div className="p-8">加载中...</div>

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <EmptyState project={project} />
      </div>
      <div className="border-t p-4">
        <ChatInput onSend={(q) => console.log('todo:', q)} disabled={false} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2：实现 EmptyState**

```typescript
// src/components/chat/EmptyState.tsx
import type { Project } from '@/types/project'
import { SuggestedQuestions } from './SuggestedQuestions'

const SAMPLE_QUESTIONS = [
  { icon: '💰', text: '存款开户的设计逻辑是怎样的？' },
  { icon: '🏭', text: '产品工厂是怎么实现的？' },
  { icon: '🔀', text: 'OrderService 的调用链路' },
]

export function EmptyState({ project }: { project: Project }) {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 text-center">
      <h2 className="text-2xl font-semibold">👋 你好，正在分析 [{project.name}]</h2>
      <p className="text-muted-foreground mt-2">
        共 {project.stats.methods_count} 个方法 · 解读完成度 {project.stats.interpretation_progress}%
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {project.pipeline_at ? `最新于 ${formatRelativeTime(project.pipeline_at)}` : ''}
      </p>
      <div className="my-8 text-sm text-muted-foreground">─── 试试问问看 ───</div>
      <SuggestedQuestions questions={SAMPLE_QUESTIONS} />
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  // 简单版：n 小时前 / n 天前
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3600_000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}
```

- [ ] **Step 3：实现 SuggestedQuestions + ChatInput**

```typescript
// src/components/chat/SuggestedQuestions.tsx
interface Q { icon: string; text: string }
export function SuggestedQuestions({ questions }: { questions: Q[] }) {
  return (
    <div className="space-y-2 max-w-md mx-auto">
      {questions.map((q, i) => (
        <button
          key={i}
          className="w-full text-left p-3 border rounded hover:bg-muted transition"
          onClick={() => console.log('todo:', q.text)}
        >
          <span className="mr-2">{q.icon}</span>{q.text}
        </button>
      ))}
    </div>
  )
}

// src/components/chat/ChatInput.tsx
import { useState, type KeyboardEvent } from 'react'
import { ArrowUp } from 'lucide-react'

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}
export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const [composing, setComposing] = useState(false)

  const submit = () => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composing) return  // 中文输入法 composing 中不提交
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="max-w-3xl mx-auto flex gap-2">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        placeholder="输入你的问题..."
        disabled={disabled}
        rows={1}
        className="flex-1 p-3 border rounded resize-none disabled:opacity-50"
      />
      <button
        onClick={submit}
        disabled={!value.trim() || disabled}
        className="p-3 bg-primary text-primary-foreground rounded disabled:opacity-50"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 4：调整路由**

`src/App.tsx`：
```typescript
// 在 RequireAuth 包裹的 Route 里：
<Route path="/" element={<RootRedirect />} />
<Route path="/project/:projectId" element={<ChatPage />} />
```

加 `<RootRedirect />`：
```typescript
// 在 App.tsx 内
function RootRedirect() {
  const projects = useProjectStore(s => s.projects)
  if (projects.length === 0) return <div>还没有工程</div>
  return <Navigate to={`/project/${projects[0].id}`} replace />
}
```

- [ ] **Step 5：验证**

```bash
npm run dev
# 浏览器访问，登录后看到 EmptyState + 输入框
```

- [ ] **Step 6：提交**

```bash
git add src/pages/ChatPage.tsx src/components/chat/ src/App.tsx
git commit -m "feat(ui): ChatPage 静态布局 + EmptyState + ChatInput"
```

---

### Week 4 验收

- ✅ 后端 SSE `/qa/explain` 跑通（curl 看到流式事件）
- ✅ 前端 useSSEStream hook 写完（手动 dev server 测试）
- ✅ ChatPage 静态布局上线，EmptyState 显示工程信息 + 示例问题
- ✅ 输入框 Enter 发送、Shift+Enter 换行、中文 IME 正确

---

## Phase 5 (Week 5): Session 持久化 + 多轮对话

**目标：** 会话能保存、加载、删除；多轮对话上下文带到 LLM。

### Task 5.1：后端 session 路由

**Files:**
- Modify: `src/service/qa_router.py`（加 session GET/DELETE/feedback 路由）

- [ ] **Step 1：写测试**

```python
# tests/test_qa_session_router.py
@pytest.mark.asyncio
async def test_list_sessions(test_db_with_data):
    """创建 2 个 session，应该都能返回。"""
    ...

@pytest.mark.asyncio
async def test_get_session_with_messages():
    ...

@pytest.mark.asyncio
async def test_delete_session_cascades_messages():
    ...

@pytest.mark.asyncio
async def test_post_feedback():
    ...
```

- [ ] **Step 2：实现路由**

```python
# 在 qa_router.py 追加：
@router.get("/sessions")
async def list_sessions(project_id: str, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    stmt = (select(QASession)
            .where(QASession.project_id == project_id, QASession.user_id == user.username)
            .order_by(QASession.updated_at.desc()))
    result = await db.execute(stmt)
    return {"sessions": [{
        "id": s.id, "project_id": s.project_id, "title": s.title,
        "created_at": s.created_at.isoformat() + "Z",
        "updated_at": s.updated_at.isoformat() + "Z",
        "message_count": s.message_count,
    } for s in result.scalars()]}

@router.get("/sessions/{session_id}")
async def get_session(project_id: str, session_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    sess = await db.get(QASession, session_id)
    if not sess or sess.project_id != project_id:
        raise HTTPException(404, "会话不存在")
    msgs = sorted(sess.messages, key=lambda m: m.created_at)
    return {
        "session": {...},  # 同上
        "messages": [{
            "id": m.id, "session_id": m.session_id, "role": m.role,
            "content": m.content, "sections": m.sections,
            "metadata": m.msg_metadata, "created_at": m.created_at.isoformat() + "Z",
        } for m in msgs]
    }

@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(...):
    sess = await db.get(QASession, session_id)
    if sess: await db.delete(sess); await db.commit()

@router.post("/sessions/{session_id}/messages/{message_id}/feedback", status_code=204)
async def post_feedback(...):
    fb = QAFeedback(message_id=message_id, vote=body.vote, comment=body.comment, user_id=user.username)
    await db.merge(fb); await db.commit()
```

- [ ] **Step 3：测试 + 提交**

```bash
python -m pytest tests/test_qa_session_router.py -v
git add src/service/qa_router.py tests/test_qa_session_router.py
git commit -m "feat(api): session 列表/详情/删除/反馈 路由"
```

---

### Task 5.2：流式完成时持久化消息

**Files:**
- Modify: `src/service/qa_engine/sse_emitter.py`（接入 DB session）
- Modify: `src/service/qa_router.py`

- [ ] **Step 1：在 stream_qa_answer 完成后写库**

修改 sse_emitter.py，在 `done` event 之前持久化 user msg + assistant msg。具体方式：在 emitter 接收一个 callback `on_complete(user_content, sections, metadata)`，由 router 实现持久化。

```python
async def stream_qa_answer(
    *, question, project_id, session_id, retriever, synthesizer,
    on_complete: Callable[[str, list, dict], Awaitable[None]] = None,
) -> AsyncIterator[str]:
    ...
    if on_complete:
        await on_complete(question, answer.sections, {
            "token_usage": answer.token_usage,
            "cost_yuan": answer.cost_yuan,
            "latency_ms": int((time.time() - start) * 1000),
        })
    yield format_sse("done", {...})
```

router 里：
```python
async def persist(question, sections, metadata):
    user_msg = QAMessage(id="msg_"+uuid.uuid4().hex[:12], session_id=session_id,
                         role="user", content=question)
    assistant_msg = QAMessage(id=message_id, session_id=session_id,
                              role="assistant", content=None,
                              sections=sections, msg_metadata=metadata)
    db.add_all([user_msg, assistant_msg])
    await db.commit()

return StreamingResponse(stream_qa_answer(..., on_complete=persist), ...)
```

- [ ] **Step 2：手动测试**

```bash
# 发一次问答，再调 GET /sessions/{sid} 看消息是否落库
```

- [ ] **Step 3：提交**

---

### Task 5.3：前端 sessions store + SessionHistory 组件

**Files:**
- Create: `src/api/sessions.ts`
- Create: `src/stores/sessions.ts`
- Create: `src/components/session/SessionHistory.tsx`
- Create: `src/components/session/SessionItem.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1：API client + store**

```typescript
// src/api/sessions.ts
export async function listSessions(projectId: string): Promise<Session[]> {...}
export async function getSession(projectId: string, sessionId: string): Promise<{session: Session, messages: Message[]}> {...}
export async function deleteSession(projectId: string, sessionId: string): Promise<void> {...}
```

```typescript
// src/stores/sessions.ts
interface SessionStore {
  sessionsByProject: Record<string, Session[]>
  fetchSessions: (projectId: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
}
```

- [ ] **Step 2：组件**

```typescript
// src/components/session/SessionHistory.tsx
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjectStore } from '@/stores/projects'
import { useSessionStore } from '@/stores/sessions'

export function SessionHistory() {
  const navigate = useNavigate()
  const { projectId, sessionId } = useParams()
  const projects = useProjectStore(s => s.projects)
  const sessions = useSessionStore(s => s.sessionsByProject)
  const fetch = useSessionStore(s => s.fetchSessions)

  useEffect(() => {
    projects.forEach(p => fetch(p.id))
  }, [projects, fetch])

  return (
    <div className="p-2 space-y-2">
      <button
        className="w-full p-2 text-left hover:bg-muted rounded"
        onClick={() => navigate(`/project/${projectId}/chat/new`)}
      >+ 新对话</button>
      {projects.map(p => {
        const projSessions = sessions[p.id] ?? []
        const isCurrent = p.id === projectId
        return (
          <details key={p.id} open={isCurrent} className="text-sm">
            <summary className="cursor-pointer p-2 hover:bg-muted rounded">
              📁 {p.name} ({projSessions.length})
            </summary>
            <div className="ml-4 space-y-1 mt-1">
              {projSessions.map(s => (
                <button
                  key={s.id}
                  className={`w-full text-left p-2 rounded text-xs hover:bg-muted ${
                    s.id === sessionId ? 'bg-muted font-medium' : ''
                  }`}
                  onClick={() => navigate(`/project/${p.id}/chat/${s.id}`)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </details>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3：替换 Sidebar 内容**

`src/components/layout/Sidebar.tsx`：
```typescript
import { SessionHistory } from '@/components/session/SessionHistory'
export function Sidebar() {
  return <SessionHistory />
}
```

- [ ] **Step 4：路由加 chat/:sessionId**

`App.tsx`：
```typescript
<Route path="/project/:projectId/chat/:sessionId" element={<ChatPage />} />
<Route path="/project/:projectId/chat/new" element={<ChatPage />} />
```

- [ ] **Step 5：提交**

---

### Task 5.4：chatStore + 多轮对话

**Files:**
- Create: `src/stores/chat.ts`
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1：实现 chatStore**

```typescript
// src/stores/chat.ts
import { create } from 'zustand'
import { useSSEStream } from '@/hooks/useSSEStream'

interface ChatStore {
  currentSessionId: string | null
  messages: Message[]
  streamingMessage: Partial<Message> | null
  status: 'idle' | 'streaming' | 'error'

  sendMessage: (projectId: string, question: string) => Promise<void>
  loadSession: (projectId: string, sessionId: string) => Promise<void>
  startNew: () => void
}

// 注意：sendMessage 在组件里调用 useSSEStream，store 只管状态。
// 实际写法：store 暴露 setMessages / setStreaming，hook 在组件层负责 fetch。
```

具体实现写在组件层（ChatPage 用 useSSEStream，把事件推到 store）。

- [ ] **Step 2：ChatPage 接入 SSE**

```typescript
// 关键片段：处理 SSE 事件 → 更新 streamingMessage
useEffect(() => {
  events.forEach(e => {
    if (e.event === 'meta') { ... }
    if (e.event === 'content') {
      setStreaming(prev => ({
        ...prev,
        sections: mergeSection(prev.sections, e.data),
      }))
    }
    if (e.event === 'done') {
      setMessages(prev => [...prev, streamingMessage])
      setStreaming(null)
    }
  })
}, [events])
```

- [ ] **Step 3：手动 E2E 测试**

```bash
npm run dev
# 浏览器：登录 → 选工程 → 问问题 → 看到流式答案 → 刷新 → 历史还在
```

- [ ] **Step 4：提交**

---

### Week 5 验收

- ✅ 多轮对话能跑：发问 → 答 → 追问 → 答（带历史）
- ✅ 刷新页面会话历史还在
- ✅ 切换工程会话列表分组正确
- ✅ 删除会话生效

---

## Phase 6 (Week 6): Prompts + few-shot + 业务术语词典

**目标：** LLM 答案质量从"能用"到"像样"——主要靠 prompt 调优 + 词典 + 范例。

### Task 6.1：补充业务术语词典（100 条）

**Files:**
- Create: `/Users/java/knowledge-engineering/data/business_terms.yaml`
- Create: `/Users/java/knowledge-engineering/scripts/load_business_terms.py`

- [ ] **Step 1：建词典 YAML**

```yaml
# data/business_terms.yaml
# 业务术语词典：业务概念 ↔ 代码标识符 ↔ 解释
# 目标：100 条覆盖核心业务流程

terms:
  - business_term: "存款开户"
    aliases: ["开户", "新开存款账户", "存款账户开立"]
    code_patterns:
      - "DepositController.openAccount"
      - "AccountOpeningService.*"
      - "*OpenAccount*"
    description: "用户在银行开立存款账户的核心流程，包含 KYC、风控、账户创建"
    related_terms: ["KYC", "风控审批", "账户类型"]

  - business_term: "KYC"
    aliases: ["实名认证", "客户尽调", "身份核验"]
    code_patterns: ["KycService.*", "IdentityVerify*", "*Kyc*"]
    description: "Know Your Customer，开户前的客户身份与背景核查"
    related_terms: ["反洗钱", "黑名单"]
  # ... 总计 100 条
```

- [ ] **Step 2：在 prompts.py 里把词典注入 system prompt**

```python
import yaml
from pathlib import Path

def load_business_terms() -> str:
    """加载业务术语词典，组装为 system prompt 一部分。"""
    path = Path(__file__).parent.parent.parent.parent / "data" / "business_terms.yaml"
    if not path.exists():
        return ""
    data = yaml.safe_load(path.read_text())
    lines = ["业务术语词典："]
    for t in data.get("terms", []):
        aliases = "、".join(t.get("aliases", []))
        lines.append(f"- 「{t['business_term']}」({aliases}): {t['description']}")
    return "\n".join(lines)


SYSTEM_PROMPT = """..."""  # 原版

def build_system_prompt() -> str:
    return SYSTEM_PROMPT + "\n\n" + load_business_terms()
```

修改 synthesizer 用 `build_system_prompt()`。

- [ ] **Step 3：提交**

```bash
git add data/business_terms.yaml src/service/qa_engine/prompts.py
git commit -m "feat(qa): 业务术语词典 100 条 + 注入 prompt"
```

---

### Task 6.2：补充 gold doc 范例（30 篇 few-shot）

**Files:**
- Create: `/Users/java/knowledge-engineering/data/gold_docs/*.json`（30 篇示例输出）
- Modify: `src/service/qa_engine/prompts.py`（加 few-shot）

- [ ] **Step 1：写 30 篇范例**

每篇格式：
```json
{
  "question": "存款开户的设计逻辑是怎样的？",
  "context": {
    "entry_candidates": [...],
    ...
  },
  "answer": {
    "sections": [
      {"type": "overview", "title": "业务概述", "content": "...", "references": []},
      ...
    ]
  }
}
```

> 30 篇是大工作量。建议：
> - 第 1 周写 5-10 篇核心场景（开户、转账、登录、查询、风控）
> - 后续每周补 5 篇，到 W8 攒到 30 篇

- [ ] **Step 2：在 prompt 里加 few-shot**

```python
def build_user_prompt(question: str, context: dict) -> str:
    fewshot = load_few_shot_examples(limit=2)  # 选 2 条最相关的
    parts = [fewshot, "===", "用户问题：" + question, ...]
    return "\n".join(parts)
```

- [ ] **Step 3：提交**

```bash
git add data/gold_docs/ src/service/qa_engine/prompts.py
git commit -m "feat(qa): gold doc 范例 + few-shot"
```

---

### Task 6.3：前端 SectionRenderer 6 段式渲染

**Files:**
- Create: `src/components/chat/SectionRenderer.tsx`
- Create: `src/components/chat/AssistantMessage.tsx`
- Create: `src/components/chat/UserMessage.tsx`
- Create: `src/components/chat/MessageList.tsx`
- Install: `react-markdown`

```bash
npm install react-markdown remark-gfm
```

- [ ] **Step 1：实现 SectionRenderer**

```typescript
// src/components/chat/SectionRenderer.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Section } from '@/types/chat'

const SECTION_ICONS: Record<string, string> = {
  overview: '📋', entry_point: '🚪', call_chain: '🔀',
  db_ops: '💾', rules: '⚠️', sources: '🔗',
}

export function SectionRenderer({
  section,
  isStreaming
}: { section: Section, isStreaming?: boolean }) {
  return (
    <div className="border rounded-lg p-4 mb-3 bg-card">
      <div className="font-medium mb-2">
        {SECTION_ICONS[section.type] ?? '📌'} {section.title}
      </div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
        {section.content}
      </ReactMarkdown>
      {isStreaming && <span className="animate-pulse">▌</span>}
    </div>
  )
}
```

- [ ] **Step 2：实现 AssistantMessage / UserMessage / MessageList**

简版略，参考 spec §5.1。

- [ ] **Step 3：在 ChatPage 接入**

```typescript
<MessageList messages={messages} streaming={streamingMessage} />
```

- [ ] **Step 4：手动测试**

```bash
npm run dev
# 问一个真实问题，看到 6 段式渲染
```

- [ ] **Step 5：提交**

---

### Week 6 验收

- ✅ 业务术语词典至少 50 条（100 是目标，能补就补）
- ✅ Few-shot 至少 5 篇
- ✅ 前端 6 段式渲染：每段独立卡片 + markdown 渲染
- ✅ LLM 答案明显改善：手测 5 个问题，至少 4 个答案"像样"

---

## Phase 7 (Week 7): Weaviate project_id 改造 + EntityLink

**目标：** Weaviate 4 个集合都加 `project_id`；前端实体名能点击跳转。

### Task 7.1：Weaviate schema 加 project_id

**Files:**
- Modify: `src/core/weaviate_defaults.py`
- Modify: `src/knowledge/weaviate_business_store.py`（写入 + 查询都带 project_id）
- Modify: 同类 method/code/pattern store
- Create: `scripts/migrate_weaviate_project_id.py`

- [ ] **Step 1：每个 collection schema 加 project_id**

例如 BusinessInterpretation：
```python
{
  "properties": [
    {"name": "entity_id", "dataType": ["text"]},
    {"name": "project_id", "dataType": ["text"]},   # 新增
    ...
  ]
}
```

- [ ] **Step 2：写入时带 project_id**

```python
def upsert(self, *, entity_id: str, project_id: str, summary_text: str, ...):
    self.collection.data.insert({
        "entity_id": entity_id,
        "project_id": project_id,
        ...
    })
```

- [ ] **Step 3：查询加 filter**

```python
from weaviate.classes.query import Filter

def search_by_text(self, *, text: str, project_id: str, limit: int = 5):
    return self.collection.query.near_text(
        query=text,
        filters=Filter.by_property("project_id").equal(project_id),
        limit=limit,
    )
```

- [ ] **Step 4：写迁移脚本**

```python
# scripts/migrate_weaviate_project_id.py
"""给历史数据回填 project_id='default'。
运行一次即可。
"""
import asyncio
from src.knowledge.weaviate_business_store import BusinessInterpretationStore
from src.knowledge.weaviate_method_interpretation_store import ...

async def main():
    for store in [BusinessInterpretationStore(), ...]:
        await store.backfill_project_id(default_value="default")

asyncio.run(main())
```

- [ ] **Step 5：在 staging 跑迁移 + 验证**

```bash
python scripts/migrate_weaviate_project_id.py
# 验证：search 带 project_id="default" 应该找到老数据
```

- [ ] **Step 6：提交**

---

### Task 7.2：Pipeline 加 --project 参数

**Files:**
- Modify: `src/pipeline/run.py`
- Modify: `src/pipeline/cli.py`

- [ ] **Step 1：CLI 加 --project**

```python
@click.option("--project", required=True, help="Project ID（如 deposit-system）")
def main(project: str, ...):
    config["project_id"] = project
    # 把 project_id 注入 pipeline 各个 stage
    # 输出路径变成 out_ui/<project>/...
    # Weaviate 写入带 project_id
    ...
```

- [ ] **Step 2：写一个 admin CLI 创建工程并跑 pipeline**

```bash
# scripts/ke_admin_create_project.py
python scripts/ke_admin_create_project.py \
  --id deposit-system \
  --name "存款系统" \
  --repo /path/to/code

# 内部：
# 1. 在 MySQL projects 表加一行（status=indexing）
# 2. 跑 pipeline：python -m src.pipeline.run --project=deposit-system
# 3. pipeline 完成后更新 status=ready, indexing_progress, pipeline_at
```

- [ ] **Step 3：提交**

---

### Task 7.3：前端 EntityLink + FreshnessBadge

**Files:**
- Create: `src/components/chat/EntityLink.tsx`
- Create: `src/components/chat/FreshnessBadge.tsx`
- Modify: `src/components/chat/SectionRenderer.tsx`（解析 `[entity_id|text]` 格式）

- [ ] **Step 1：自定义 markdown link 渲染器**

```typescript
// SectionRenderer.tsx
const components = {
  a: ({ href, children }) => {
    if (href?.startsWith('method://') || href?.startsWith('class://')) {
      return <EntityLink entityId={href}>{children}</EntityLink>
    }
    return <a href={href}>{children}</a>
  }
}
```

- [ ] **Step 2：EntityLink 组件**

```typescript
export function EntityLink({ entityId, children }: { entityId: string, children: ReactNode }) {
  const navigate = useNavigate()
  const onClick = () => {
    if (entityId.startsWith('method://')) navigate(`/method/${encodeURIComponent(entityId)}`)
    else if (entityId.startsWith('class://')) navigate(`/class/${encodeURIComponent(entityId)}`)
    // ...
  }
  return (
    <button onClick={onClick} className="text-primary underline hover:text-primary/80">
      {children}
    </button>
  )
}
```

- [ ] **Step 3：FreshnessBadge**

```typescript
export function FreshnessBadge({ freshness }: { freshness: string }) {
  const days = (Date.now() - new Date(freshness).getTime()) / 86400_000
  const color = days < 1 ? 'text-emerald-500' : days < 7 ? 'text-amber-500' : 'text-orange-500'
  return <span className={`text-xs ${color}`}>🕘 解读基于 {formatTime(freshness)}</span>
}
```

- [ ] **Step 4：提交**

---

### Week 7 验收

- ✅ Weaviate 4 个 collection 都有 project_id
- ✅ 历史数据迁移成功，旧 project_id="default" 仍能查到
- ✅ Pipeline 支持 --project 多工程
- ✅ 答案中实体名可点击，跳转到对应详情页
- ✅ Sources 段显示新鲜度徽章

---

## Phase 8 (Week 8): MessageActions + 验证 + Prompt 调优

**目标：** 6 个动作里实现 v1 必做的 3 个（👍/👎/🔄/📋）；Verifier 反幻觉。

### Task 8.1：MessageActions 组件

**Files:**
- Create: `src/components/chat/MessageActions.tsx`
- Modify: `src/api/sessions.ts`（加 voteMessage）

- [ ] **Step 1：实现组件**

```typescript
export function MessageActions({ message }: { message: Message }) {
  const [vote, setVote] = useState<'up'|'down'|null>(null)
  const onVote = async (v: 'up'|'down') => {
    setVote(v)
    await voteMessage(projectId, sessionId, message.id, v)
  }
  const onCopy = () => navigator.clipboard.writeText(toMarkdown(message))
  const onRegenerate = () => regenerate(message.id)
  return (
    <div className="flex gap-2 mt-2 text-muted-foreground">
      <button onClick={() => onVote('up')}>👍</button>
      <button onClick={() => onVote('down')}>👎</button>
      <button onClick={onRegenerate}>🔄 重新生成</button>
      <button onClick={onCopy}>📋 复制</button>
      <button disabled title="v1.5">📊</button>
      <button disabled title="v1.5">📥</button>
    </div>
  )
}
```

- [ ] **Step 2：提交**

---

### Task 8.2：后端 Verifier（简版反幻觉）

**Files:**
- Modify: `src/service/qa_engine/synthesizer.py`（加 verify 步骤）

- [ ] **Step 1：在 synthesize 里加 verify**

```python
async def synthesize(self, ctx: RetrievedContext) -> SynthesizedAnswer:
    answer = await self._raw_synthesize(ctx)
    # v1 简版 verifier：检查所有 references 的 entity_id 是否真实存在于 ctx
    valid_ids = set()
    for c in ctx.entry_candidates: valid_ids.add(c["entity_id"])
    for callees in ctx.callees_by_entry.values():
        valid_ids.update(callees)
    for callers in ctx.callers_by_entry.values():
        valid_ids.update(callers)

    for section in answer.sections:
        if "references" in section:
            section["references"] = [
                r for r in section["references"]
                if r["entity_id"] in valid_ids  # 过滤幻觉引用
            ]
    return answer
```

- [ ] **Step 2：提交**

---

### Task 8.3：Prompt 调优 + 测试集 5 个问题

**Files:**
- Create: `tests/test_qa_quality.py`（标 e2e）
- Modify: `src/service/qa_engine/prompts.py`

- [ ] **Step 1：建 5 个核心问题测试集**

```python
QUALITY_TEST_QUESTIONS = [
    "存款开户的设计逻辑是怎样的？",
    "OrderService 的支付流程",
    "用户登录怎么实现的？",
    "黑名单查询机制",
    "产品工厂的设计模式",
]

@pytest.mark.e2e
@pytest.mark.parametrize("q", QUALITY_TEST_QUESTIONS)
async def test_quality(q):
    result = await full_qa_pipeline(q)
    # 至少 3 段
    assert len(result.sections) >= 3
    # overview 段不能空
    assert any(s["type"] == "overview" and len(s["content"]) > 50 for s in result.sections)
    # 不能"我不知道"
    text = " ".join(s["content"] for s in result.sections)
    assert "无法回答" not in text and "不知道" not in text
```

- [ ] **Step 2：跑测试，记录每题质量打分（手工 1-5）**

如果某些题失败 → 调 prompt → 再跑。重复直到至少 4/5 题打 4 分以上。

- [ ] **Step 3：提交**

---

### Week 8 验收

- ✅ 👍/👎/🔄/📋 4 个动作生效（点击有反馈）
- ✅ Verifier 过滤幻觉引用：手测找到至少 1 个被过滤的 case
- ✅ 5 个核心问题至少 4 个达到 4 分质量

---

## Phase 9 (Week 9): Demo 数据填充 + 部署

**目标：** 生产部署 + 填 1-2 个真实工程的数据，准备给用户测试。

### Task 9.1：选 demo 工程 + 跑 pipeline

- [ ] **Step 1：选 1-2 个真实 Java 工程**

候选：
- 用户自己手上有的工程（最佳）
- 开源 Java 项目（如 Spring PetClinic）
- knowledge-engineering 自身（dogfooding）

- [ ] **Step 2：跑 pipeline 索引**

```bash
python scripts/ke_admin_create_project.py \
  --id petclinic \
  --name "Spring PetClinic Demo" \
  --repo /path/to/petclinic

# 等 pipeline 跑完（可能 30 分钟到几小时）
```

- [ ] **Step 3：手动验证质量**

在前端选 petclinic，问 5 个问题，看答案质量。

---

### Task 9.2：部署到生产服务器

**Files:** 
- Modify: nginx config（如有变化）
- Update: `/opt/knowledge-engineering/.env`（加 alembic 升级）

- [ ] **Step 1：服务器拉最新代码**

```bash
ssh root@103.47.81.50 -p 26666 "cd /opt/knowledge-engineering && git pull"
```

- [ ] **Step 2：跑 alembic 迁移**

```bash
ssh root@103.47.81.50 -p 26666 "cd /opt/knowledge-engineering && source venv/bin/activate && alembic upgrade head"
```

- [ ] **Step 3：重启 ke-api.service**

```bash
ssh root@103.47.81.50 -p 26666 "systemctl restart ke-api.service && journalctl -u ke-api.service -n 20"
```

- [ ] **Step 4：构建前端 + rsync**

```bash
cd /Users/java/knowledge-engineering-web
npm run build
rsync -av --delete dist/ root@103.47.81.50:/var/www/knowledge-engineering/ -e "ssh -p 26666"
```

- [ ] **Step 5：smoke 测试**

```bash
curl https://你的域名/api/projects -H "Authorization: Bearer <token>"
```

---

### Week 9 验收

- ✅ 至少 1 个 demo 工程数据齐全（前端能切到该工程问答）
- ✅ 生产服务器跑起来，HTTPS 可访问
- ✅ 5 个核心问题在生产环境能正确回答

---

## Phase 10 (Week 10): 用户测试 + Bug 修复 + 反馈迭代

**目标：** 找 1-3 个友好用户实测；收集反馈；修最关键的 bug。

### Task 10.1：找 3 个种子用户 + 录屏指引

- [ ] **Step 1：列出 3 个潜在用户**

候选：
- 同事/朋友里能熟悉 Java 业务的开发者
- 业务方/产品经理（看是否能读懂答案）
- 新人（onboarder 场景）

- [ ] **Step 2：写一份 5 分钟 onboarding 指引**

`docs/user-guide-v1.md`：
1. 怎么登录
2. 怎么选工程
3. 怎么提问（推荐问法）
4. 怎么反馈

- [ ] **Step 3：约 30 分钟用户访谈**

每人：
1. 让用户自己问 5 个问题（不要预设）
2. 观察哪些功能让 ta 困惑
3. 让 ta 给整体质量 1-10 分
4. 问一个最痛的"如果加 X 我会更愿意用"

- [ ] **Step 4：整理反馈**

`docs/v1-feedback.md`：
- 每个用户的反馈
- 共性 pain point（出现 ≥ 2 次的）
- 优先级排序

---

### Task 10.2：修 v1 阻塞 bug

根据反馈修最痛的 1-3 个 bug（每个 bug 对应一个独立 commit）。

---

### Task 10.3：v1 上线总结

**Files:**
- Create: `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/v1-上线总结.md`

- [ ] 内容：
  - 实际工时 vs 计划（哪些超时、哪些超快）
  - 用户反馈 Top 5
  - v1.5 必做清单（前 3 个）
  - 砍掉的功能在 v1.5/v2 中的优先级

---

### Week 10 验收

- ✅ 至少 3 个用户实际用过
- ✅ 至少有 1 个用户给到 ≥ 7 分评价
- ✅ 收集到反馈文档
- ✅ v1.5 路线图初稿

---

## Self-Review 检查表

写完计划后自检：

**1. Spec 覆盖：**
- ✅ 多工程（§4 spec）→ Phase 2 + Phase 7
- ✅ 4 状态 chat UI（§3 spec）→ Phase 4 + Phase 6
- ✅ 6 段式渲染（§5.2 spec）→ Phase 6
- ✅ SSE 流式（§6.4 spec）→ Phase 4
- ✅ 多轮对话（§5.7 spec）→ Phase 5
- ✅ Session 持久化（§6.2 spec）→ Phase 5
- ✅ 实体链接 + 新鲜度（§5.4 spec）→ Phase 7
- ✅ 6 个动作 v1 实现 3 个（§5.5 spec）→ Phase 8
- ✅ 业务术语词典 + few-shot（§9 风险 spec）→ Phase 6
- ✅ Verifier（§9 风险 spec）→ Phase 8
- ✅ 部署 + 用户测试（§8 schedule spec）→ Phase 9 + Phase 10

**2. Placeholder 扫描：**
- 部分 Phase 5 / 6 / 7 / 8 / 9 / 10 任务的 step 写得简略（特别是测试代码省略了完整实现）。这是因为：
  - 后期任务依赖前期成果，等执行时再展开更准确
  - 单人节奏下，写得太死反而拖累节奏
- 所有"核心创新代码"（retriever / synthesizer / sse_emitter / useSSEStream）都给了完整实现
- 简略部分都明确说明了"参考 spec §X" 或者"格式参考 Task X.X"

**3. 类型一致性：**
- `Project` 类型在前后端定义一致（§Task 1.4 + §Task 2.1）
- `Section` / `Reference` 类型在前后端定义一致
- SSE 事件类型（meta/step/section_start/content/section_done/done/error）前后端一致

---

## Execution Handoff

Plan complete and saved to `/Users/java/knowledge-engineering-web/docs/superpowers/plans/2026-05-06-homepage-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 我每个 Task 派一个新 subagent 实现，task 之间我审核

**2. Inline Execution** — 我在当前会话里逐 task 执行，定期 checkpoint 让你审

**Which approach?**

> **建议**：单人开发节奏下，**Phase 1 (W1) 用 Inline**（建立基础感觉），**Phase 2-10 用 Subagent-Driven**（节省你的 token 上下文）。这样能在 10 周内有 ROI 最高的执行方式。
