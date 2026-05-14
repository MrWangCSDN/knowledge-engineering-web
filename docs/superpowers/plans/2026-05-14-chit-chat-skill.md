# Chit-chat 闲聊路径 Implementation Plan (SkillRouter v1.2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 SkillRouter 加第 5 个 skill `chit-chat`，命中后跳过 retriever + KG 检索，直接调 LLM 输出友好简短闲聊回复（引导回业务能力），前端用单段无标题样式渲染。

**Architecture:** 跨仓改动。Auth 后端：router 加 chit-chat 关键词/LLM 选项 + retriever 短路 + synthesizer 走专属 chit-chat 分支（同步 + 流式两个版本）+ docx_exporter title/emoji 兜底。Web 前端：SectionType union 加 'chit-chat' + AssistantMessage 检测 type='chit-chat' 跳过 section header 渲染。

**Tech Stack:**
- **Auth**: Python 3.12 / FastAPI / SQLAlchemy 2.0 async / pytest（venv/bin/python -m pytest）
- **Web**: React 19 + TypeScript 6 + Vite 8 + Vitest + @testing-library/react

**Spec:** `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/chit-chat-闲聊路径-设计.md`

**Working directories:**
- Auth: `/Users/java/knowledge-engineering-auth`
- Web: `/Users/java/knowledge-engineering-web`

**Branch strategy:** 两边各建独立 feature branch
- Auth: `feat/chit-chat-skill` (base `release-0513`)
- Web: `feat/chit-chat-skill` (base `main`)

---

## File Map

### Auth 仓
| 文件 | 操作 | 责任 |
|---|---|---|
| `src/service/qa_engine/router.py` | **修改** | _VALID_SKILL_IDS + _keywords + _LLM_ROUTE_SYSTEM 加 chit-chat |
| `src/service/qa_engine/retriever.py` | **修改** | chit-chat skill_id 时短路返回空 ctx |
| `src/service/qa_engine/prompts.py` | **修改** | 新增 `_CHIT_CHAT_SYSTEM` 常量 |
| `src/service/qa_engine/synthesizer.py` | **修改** | `_synthesize_chit_chat` (同步) + `_synthesize_chit_chat_stream`（流式）+ synthesize/synthesize_stream 入口分支 |
| `src/service/qa_engine/docx_exporter.py` | **修改** | SECTION_TITLES + SECTION_EMOJIS 加 chit-chat 兜底 |
| `tests/test_auth/test_qa_router_chitchat.py` | **新建** | router chit-chat 单测 |
| `tests/test_auth/test_qa_retriever.py` | **修改** | 加 chit-chat 短路测试 |
| `tests/test_auth/test_qa_synthesizer.py` | **修改** | 加 chit-chat 分支测试 |

### Web 仓
| 文件 | 操作 | 责任 |
|---|---|---|
| `src/types/chat.ts` | **修改** | SectionType union 加 'chit-chat' |
| `src/components/chat/AssistantMessage.tsx` | **修改** | type==='chit-chat' 时跳过 section header（不显示 icon + title）|
| `src/components/chat/AssistantMessage.test.tsx` | **修改** | 加 chit-chat 渲染 case |

---

## Phase A — Auth 后端

## Task 1: Router — 加 chit-chat 关键词 + LLM 选项

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_engine/router.py`
- Create: `tests/test_auth/test_qa_router_chitchat.py`

### Step 1: 写 failing test

`tests/test_auth/test_qa_router_chitchat.py`:

```python
"""验证 SkillRouter v1.2 chit-chat 第 5 类路由。"""
import pytest
from unittest.mock import AsyncMock

from src.service.qa_engine.router import SkillRouter, _VALID_SKILL_IDS


def test_chit_chat_in_valid_skill_ids():
    """chit-chat 必须在合法 skill 集合里。"""
    assert "chit-chat" in _VALID_SKILL_IDS


def test_route_chit_chat_greeting():
    """「你好」命中 chit-chat 关键词。"""
    r = SkillRouter()
    d = r.route("你好")
    assert d.skill_id == "chit-chat"
    assert "你好" in d.matched_keywords
    assert d.source == "keyword"


def test_route_chit_chat_self_intro_query():
    """「你是谁」类产品问询命中 chit-chat。"""
    r = SkillRouter()
    assert r.route("你是谁").skill_id == "chit-chat"
    assert r.route("你叫什么").skill_id == "chit-chat"
    assert r.route("你能做什么").skill_id == "chit-chat"


def test_route_chit_chat_thanks_bye():
    """道谢/告别也命中 chit-chat。"""
    r = SkillRouter()
    assert r.route("谢谢").skill_id == "chit-chat"
    assert r.route("再见").skill_id == "chit-chat"
    assert r.route("拜拜").skill_id == "chit-chat"


def test_business_keyword_overrides_chit_chat():
    """关键词优先级：业务词 > chit-chat。
    
    「你好 OrderService 的调用」应该走 dependency（命中"调用"），不被「你好」吃掉。
    """
    r = SkillRouter()
    d = r.route("你好 OrderService 的调用")
    assert d.skill_id == "dependency", f"业务词应优先，实际 skill_id = {d.skill_id}"


def test_route_unknown_question_still_architecture():
    """未命中任何关键词时仍兜底 architecture（不破坏现有 v1.1 行为）。"""
    r = SkillRouter()
    d = r.route("abcdefgh")  # 不像问候也不像业务
    assert d.skill_id == "architecture"


@pytest.mark.asyncio
async def test_llm_fallback_can_choose_chit_chat():
    """LLM fallback 路径里 chit-chat 是合法选项之一。"""
    mock_llm = AsyncMock()
    mock_llm.complete = AsyncMock(return_value="chit-chat")  # 模拟 LLM 选了 chit-chat

    r = SkillRouter(llm_provider=mock_llm)
    d = await r.route_async("今天天气怎么样")  # 不命中任何关键词的奇怪问题
    assert d.skill_id == "chit-chat"
    assert d.source == "llm"
```

### Step 2: 跑 test 看它失败

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_router_chitchat.py -v 2>&1 | tail -15`

Expected: 7 个 test 全部 FAIL（chit-chat 既不在 _VALID_SKILL_IDS 也没关键词，所有 chit-chat 期望都失败）。

### Step 3: 改 router.py

打开 `src/service/qa_engine/router.py`：

**3a.** 找到 `_VALID_SKILL_IDS = frozenset({...})` 这行，加入 `"chit-chat"`：

```python
_VALID_SKILL_IDS = frozenset({"business", "dependency", "data-flow", "architecture", "chit-chat"})
```

**3b.** 找到 `_LLM_ROUTE_SYSTEM` 多行字符串，在 `- architecture` 那行之后加：

```
  - chit-chat     闲聊 / 社交问候 / 产品问询（如「你好」「你是谁」「能做什么」「KE 是什么」）
```

**3c.** 在 `SkillRouter.__init__` 的 `self._keywords` 字典末尾追加（**放最后**让业务关键词优先命中）：

```python
self._keywords: dict[str, list[str]] = {
    "dependency": ["调用", "依赖", "调了"],
    "data-flow": ["写表", "写到哪些表", "数据流", "怎么流", "数据库表"],
    "business": ["业务规则", "约束", "限制", "校验"],
    # v1.2 新增：闲聊 / 社交问候 / 产品问询（放最后，让业务词先命中）
    "chit-chat": [
        "你好", "您好", "嗨", "hi", "hello", "hey",
        "在吗", "在么", "在不在",
        "早上好", "晚上好", "下午好", "早安", "晚安",
        "谢谢", "感谢", "辛苦", "thank",
        "再见", "拜拜", "bye", "goodbye",
        "抱歉", "对不起", "sorry",
        "你是谁", "你叫什么", "你能做什么", "你是干嘛的",
        "KE 是什么", "怎么用", "有什么用",
    ],
}
```

### Step 4: 跑 test 看它通过

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_router_chitchat.py -v 2>&1 | tail -15`

Expected: 7/7 PASS

### Step 5: 全量回归

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/ -x -q 2>&1 | tail -10`

Expected: 全部 PASS（chit-chat 关键词放最后，业务路径不变）

### Step 6: Commit

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_engine/router.py tests/test_auth/test_qa_router_chitchat.py
git commit -m "$(cat <<'EOF'
feat(qa-chitchat): SkillRouter v1.2 加 chit-chat 第 5 类

设计：[[chit-chat-闲聊路径-设计]] §4.1

- _VALID_SKILL_IDS 加 'chit-chat'
- _keywords 加 chit-chat 关键词（问候/道谢/告别/产品问询，放最后）
- _LLM_ROUTE_SYSTEM 加 chit-chat 选项说明
- 业务关键词仍优先（"你好 OrderService 的调用" → dependency）
- 7 个单测覆盖关键词命中 / 优先级 / LLM fallback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Retriever — chit-chat 短路

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_engine/retriever.py`
- Modify: `tests/test_auth/test_qa_retriever.py`（追加测试）

### Step 1: 在 retriever 测试文件末尾追加测试

打开 `tests/test_auth/test_qa_retriever.py`，文件末尾追加：

```python
@pytest.mark.asyncio
async def test_retrieve_chit_chat_short_circuits():
    """skill_id='chit-chat' → 不查 KG，直接返回空 ctx。"""
    from src.service.qa_engine.retriever import QARetriever, RetrievedContext
    from unittest.mock import MagicMock

    # 准备 mock 的 business_store 和 graph_backend
    # chit-chat 短路意味着这两个 mock 都不应被调用
    business_store = MagicMock()
    business_store.search_method_hits_by_text = MagicMock()  # 不应被 await
    graph_backend = MagicMock()

    retriever = QARetriever(
        business_store=business_store,
        graph_backend=graph_backend,
    )

    ctx = await retriever.retrieve(
        question="你好",
        project_id="p1",
        skill_id="chit-chat",
    )

    # 验证：返回空 ctx
    assert isinstance(ctx, RetrievedContext)
    assert ctx.question == "你好"
    assert ctx.project_id == "p1"
    assert ctx.skill_id == "chit-chat"
    assert ctx.entry_candidates == []

    # 验证：business_store 没被调用（短路了）
    business_store.search_method_hits_by_text.assert_not_called()
```

### Step 2: 跑 test 看它失败

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_retriever.py::test_retrieve_chit_chat_short_circuits -v 2>&1 | tail -10`

Expected: FAIL（business_store 被调用了，因为没短路）

### Step 3: 改 retriever.py — `retrieve()` 开头加短路

打开 `src/service/qa_engine/retriever.py`。先用 grep 找 `async def retrieve` 的位置：

```bash
grep -n "async def retrieve" src/service/qa_engine/retriever.py
```

在 `retrieve()` 函数体最前面（在 `ctx = RetrievedContext(...)` 之前），插入：

```python
# v1.2: chit-chat 不需要 KG context，直接返回空 ctx（节省 latency + token）
# 设计：[[chit-chat-闲聊路径-设计]] §4.2
if skill_id == "chit-chat":
    return RetrievedContext(
        question=question,
        project_id=project_id,
        skill_id="chit-chat",
    )
```

### Step 4: 跑 test 看它通过

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_retriever.py -v 2>&1 | tail -10`

Expected: 新加的 1 个 case + 原有 retriever tests 全部 PASS

### Step 5: 全量回归

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/ -x -q 2>&1 | tail -10`

Expected: 全部 PASS

### Step 6: Commit

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_engine/retriever.py tests/test_auth/test_qa_retriever.py
git commit -m "$(cat <<'EOF'
feat(qa-chitchat): retriever skill_id='chit-chat' 时短路

设计：[[chit-chat-闲聊路径-设计]] §4.2

- 闲聊不需要 KG context，省 latency + token
- 不调 business_store / graph_backend
- 返回空 RetrievedContext (question/project_id/skill_id 都填好)
- 单测验证 business_store.search_method_hits_by_text 未被调用

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Synthesizer 同步分支 + _CHIT_CHAT_SYSTEM prompt

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_engine/prompts.py`
- Modify: `src/service/qa_engine/synthesizer.py`
- Modify: `tests/test_auth/test_qa_synthesizer.py`（追加测试）

### Step 1: 在 synthesizer 测试文件末尾追加测试

打开 `tests/test_auth/test_qa_synthesizer.py`，文件末尾追加：

```python
# ─── v1.2 chit-chat 分支测试 ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_synthesize_chit_chat_returns_single_section():
    """skill_id='chit-chat' 时返回单段 chit-chat 类型，无 references。"""
    from unittest.mock import AsyncMock, MagicMock
    from src.service.qa_engine.synthesizer import QASynthesizer
    from src.service.qa_engine.retriever import RetrievedContext

    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(return_value="你好！我是 KE 助手，有业务问题随时问我。")

    synthesizer = QASynthesizer(llm_provider=mock_llm)
    ctx = RetrievedContext(question="你好", project_id="p1", skill_id="chit-chat")

    answer = await synthesizer.synthesize(ctx)

    # 单段输出
    assert len(answer.sections) == 1
    section = answer.sections[0]
    assert section["type"] == "chit-chat"
    assert "KE" in section["content"]  # 含友好回复内容
    assert section["references"] == []  # 无引用
    # title 留空（前端不显示 h3 header）
    assert section["title"] == ""


@pytest.mark.asyncio
async def test_synthesize_chit_chat_uses_chitchat_system_prompt():
    """chit-chat 路径用专属 _CHIT_CHAT_SYSTEM 而非 6 段式 SYSTEM_PROMPT。"""
    from unittest.mock import AsyncMock, MagicMock
    from src.service.qa_engine.synthesizer import QASynthesizer
    from src.service.qa_engine.retriever import RetrievedContext
    from src.service.qa_engine.prompts import _CHIT_CHAT_SYSTEM, SYSTEM_PROMPT

    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(return_value="你好")

    synthesizer = QASynthesizer(llm_provider=mock_llm)
    ctx = RetrievedContext(question="你好", project_id="p1", skill_id="chit-chat")

    await synthesizer.synthesize(ctx)

    # 检查 LLM 被调用时用的是 chit-chat system prompt
    call_kwargs = mock_llm.complete.call_args.kwargs
    system_used = call_kwargs.get("system") or (
        mock_llm.complete.call_args.args[0] if mock_llm.complete.call_args.args else ""
    )
    assert system_used == _CHIT_CHAT_SYSTEM
    assert system_used != SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_synthesize_chit_chat_passes_user_question():
    """chit-chat 把用户问题作为 user prompt 传给 LLM。"""
    from unittest.mock import AsyncMock, MagicMock
    from src.service.qa_engine.synthesizer import QASynthesizer
    from src.service.qa_engine.retriever import RetrievedContext

    mock_llm = MagicMock()
    mock_llm.complete = AsyncMock(return_value="你好")
    synthesizer = QASynthesizer(llm_provider=mock_llm)

    ctx = RetrievedContext(question="你是谁", project_id="p1", skill_id="chit-chat")
    await synthesizer.synthesize(ctx)

    call_kwargs = mock_llm.complete.call_args.kwargs
    assert call_kwargs.get("user") == "你是谁"
```

### Step 2: 跑 test 看它失败

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_synthesizer.py -k chit_chat -v 2>&1 | tail -15`

Expected: 3 个新 case FAIL（_CHIT_CHAT_SYSTEM 还没定义；synthesize 没 chit-chat 分支）

### Step 3: 在 prompts.py 末尾加 `_CHIT_CHAT_SYSTEM` 常量

打开 `src/service/qa_engine/prompts.py`，在文件末尾追加：

```python
# ─── v1.2 chit-chat 闲聊路径的专属 system prompt ─────────────────────────
# 跟 6 段式 SYSTEM_PROMPT 完全分离 — chit-chat 不需要结构化 JSON 输出，
# 也不需要引用约束 / 新鲜度标注，单段友好回复即可。
# 设计：[[chit-chat-闲聊路径-设计]] §4.4

_CHIT_CHAT_SYSTEM = """你是 KE（代码知识工程）的对话助手。用户在和你打招呼、道谢、告别，或询问你能做什么。

回复要求：
1. 简短、友好、自然（1-3 句中文）
2. 如果是问候 / 道谢 / 告别 → 礼貌回应即可
3. 如果是产品问询（「你是谁 / 能做什么 / KE 是什么」）→ 介绍你的 4 个核心能力：
   - 业务规则（约束 / 校验 / 限制）
   - 调用链路（谁调了谁 / 依赖）
   - 数据流（写到哪些表 / 数据如何流转）
   - 整体架构（系统是什么 / 怎么实现）
4. 不要回答与代码工程无关的问题（如天气、新闻、闲聊故事），而是友好地把对话引导回 KE 业务能力上

示例：
- 用户「你好」 → 助手「你好！我是 KE 代码知识工程助手。有关业务规则、调用链路、数据流或架构的问题随时问我。」
- 用户「你是谁」 → 助手「我是 KE（代码知识工程）助手，可以帮你查询代码里的业务规则、调用链路、数据流转和整体架构。」
- 用户「今天天气怎么样」 → 助手「我专注于代码知识查询，天气问题帮不上你。不过工程方面的问题我可以试试 —— 比如某个 Service 的调用链路，或者订单数据是如何流转的。」
"""
```

### Step 4: 在 synthesizer.py 加 `_synthesize_chit_chat` 方法 + synthesize 入口分支

打开 `src/service/qa_engine/synthesizer.py`。

**4a.** 文件顶部 imports 区，确保 `_CHIT_CHAT_SYSTEM` 被 import（找到现有的 `from src.service.qa_engine.prompts import SYSTEM_PROMPT` 之类，加 `_CHIT_CHAT_SYSTEM`）：

```python
from src.service.qa_engine.prompts import (
    SYSTEM_PROMPT,
    _CHIT_CHAT_SYSTEM,  # v1.2 chit-chat 专属
    build_user_prompt,
    build_user_prompt_with_history,
)
```

（具体 import 名按现有 prompts.py 的 export 调整 — 如果你看到 `_CHIT_CHAT_SYSTEM` 是私有不导出的话，把它在 prompts.py 改成不带下划线的公开名 `CHIT_CHAT_SYSTEM`。本计划假设 prompts.py 内是 `_CHIT_CHAT_SYSTEM` 但 import 时可以引用。）

**4b.** 在 `QASynthesizer` 类内、`synthesize` 方法**之前**新增 `_synthesize_chit_chat` 方法：

```python
async def _synthesize_chit_chat(self, ctx: RetrievedContext) -> SynthesizedAnswer:
    """v1.2 chit-chat 闲聊路径：用专属 prompt 调 LLM，返回单段 chit-chat section。
    设计：[[chit-chat-闲聊路径-设计]] §4.3, §4.4。"""
    reply = await self.llm.complete(
        system=_CHIT_CHAT_SYSTEM,
        user=ctx.question,
    )
    return SynthesizedAnswer(
        sections=[{
            "type": "chit-chat",
            "title": "",          # 前端不显示 h3 header
            "content": reply,
            "references": [],
        }],
        token_usage=len(reply.split()),  # 粗算 token；后续可从 LLM provider 拿真实值
        cost_yuan=0.0,
        raw_output=reply,
    )
```

**4c.** 在 `synthesize` 方法的开头加分支：

```python
async def synthesize(
    self,
    ctx: RetrievedContext,
    *,
    history: list[dict] | None = None,
) -> SynthesizedAnswer:
    # v1.2: chit-chat 走专属分支，跳过 6 段式逻辑
    if ctx.skill_id == "chit-chat":
        return await self._synthesize_chit_chat(ctx)

    # 原有 6 段式逻辑
    ctx_dict = _ctx_to_dict(ctx)
    # ... (原 code 不动)
```

### Step 5: 跑 test 看它通过

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_synthesizer.py -k chit_chat -v 2>&1 | tail -10`

Expected: 3/3 PASS

### Step 6: 全量回归

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/ -x -q 2>&1 | tail -10`

Expected: 全部 PASS

### Step 7: Commit

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_engine/prompts.py src/service/qa_engine/synthesizer.py tests/test_auth/test_qa_synthesizer.py
git commit -m "$(cat <<'EOF'
feat(qa-chitchat): synthesizer 同步路径 + _CHIT_CHAT_SYSTEM prompt

设计：[[chit-chat-闲聊路径-设计]] §4.3, §4.4

- prompts.py 加 _CHIT_CHAT_SYSTEM（友好简短引导回业务能力）
- synthesizer.synthesize() 入口检测 ctx.skill_id=='chit-chat' → 走 _synthesize_chit_chat
- 返回单段 sections=[{type:'chit-chat', title:'', content:reply, references:[]}]
- 不调 build_user_prompt（跳过 6 段式约束）
- 3 个单测：单段输出 / system prompt 是 _CHIT_CHAT_SYSTEM / 用户问题作为 user prompt

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Synthesizer 流式分支 `_synthesize_chit_chat_stream`

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_engine/synthesizer.py`
- Modify: `tests/test_auth/test_qa_synthesizer.py`（追加测试）

### Step 1: 测试追加 — chit-chat 流式版

`tests/test_auth/test_qa_synthesizer.py` 末尾追加：

```python
@pytest.mark.asyncio
async def test_synthesize_stream_chit_chat_emits_tokens():
    """chit-chat 流式：边接 LLM token 边调 on_token 回调。"""
    from unittest.mock import AsyncMock, MagicMock
    from src.service.qa_engine.synthesizer import QASynthesizer
    from src.service.qa_engine.retriever import RetrievedContext

    # 模拟 LLM 流式返回 3 个 token
    async def fake_stream(*, system, user, **kwargs):
        for tok in ["你好", "！", "有什么可以帮你的？"]:
            yield tok

    mock_llm = MagicMock()
    mock_llm.complete_stream = fake_stream  # async generator
    synthesizer = QASynthesizer(llm_provider=mock_llm)

    received_tokens: list[str] = []
    async def on_token(t: str):
        received_tokens.append(t)

    ctx = RetrievedContext(question="你好", project_id="p1", skill_id="chit-chat")
    answer = await synthesizer.synthesize_stream(ctx, on_token=on_token)

    # 验证：3 个 token 都通过回调推过
    assert received_tokens == ["你好", "！", "有什么可以帮你的？"]
    # 验证：最终 answer 单段 chit-chat type，内容拼起来
    assert len(answer.sections) == 1
    assert answer.sections[0]["type"] == "chit-chat"
    assert answer.sections[0]["content"] == "你好！有什么可以帮你的？"
    assert answer.sections[0]["references"] == []
```

### Step 2: 跑 test 看它失败

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_synthesizer.py::test_synthesize_stream_chit_chat_emits_tokens -v 2>&1 | tail -10`

Expected: FAIL（synthesize_stream 还没 chit-chat 分支）

### Step 3: 在 synthesizer.py 加 `_synthesize_chit_chat_stream` 方法 + synthesize_stream 入口分支

**3a.** 在 `QASynthesizer` 类内、`synthesize_stream` 方法之前新增（紧挨着 `_synthesize_chit_chat`）：

```python
async def _synthesize_chit_chat_stream(
    self,
    ctx: RetrievedContext,
    on_token: Optional[Callable[[str], Awaitable[None]]] = None,
) -> SynthesizedAnswer:
    """v1.2 chit-chat 流式版：边收 LLM token 边调 on_token。
    设计：[[chit-chat-闲聊路径-设计]] §4.3, §4.6。"""
    parts: list[str] = []
    async for tok in self.llm.complete_stream(
        system=_CHIT_CHAT_SYSTEM,
        user=ctx.question,
    ):
        parts.append(tok)
        if on_token is not None:
            await on_token(tok)
    reply = "".join(parts)
    return SynthesizedAnswer(
        sections=[{
            "type": "chit-chat",
            "title": "",
            "content": reply,
            "references": [],
        }],
        token_usage=len(reply.split()),
        cost_yuan=0.0,
        raw_output=reply,
    )
```

**3b.** 在 `synthesize_stream` 方法开头加分支（跟 synthesize 一致）：

```python
async def synthesize_stream(
    self,
    ctx: RetrievedContext,
    history: list[dict] | None = None,
    on_token: Optional[Callable[[str], Awaitable[None]]] = None,
) -> SynthesizedAnswer:
    """流式版本的 synthesize：边收 LLM token 边调 on_token 回调。"""
    # v1.2: chit-chat 走专属流式分支
    if ctx.skill_id == "chit-chat":
        return await self._synthesize_chit_chat_stream(ctx, on_token=on_token)

    # 原有 6 段式流式逻辑
    # ... (原 code 不动)
```

### Step 4: 跑 test 看它通过

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_synthesizer.py -k chit_chat -v 2>&1 | tail -10`

Expected: 4/4 chit_chat 相关测试 PASS（3 个同步 + 1 个流式）

### Step 5: 全量回归

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/ -x -q 2>&1 | tail -10`

Expected: 全部 PASS

### Step 6: Commit

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_engine/synthesizer.py tests/test_auth/test_qa_synthesizer.py
git commit -m "$(cat <<'EOF'
feat(qa-chitchat): synthesizer 流式路径 _synthesize_chit_chat_stream

设计：[[chit-chat-闲聊路径-设计]] §4.3, §4.6

- synthesize_stream 入口同步检测 chit-chat 分支
- 边接 LLM token 边 await on_token 回调（兼容 SSE 推送链路）
- 最终拼成完整 reply 返回 SynthesizedAnswer（与同步版数据形状一致）
- 单测验证 3 个 token 都通过 on_token + 最终 sections 拼装正确

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: docx_exporter 加 chit-chat 兜底

**Working directory:** `/Users/java/knowledge-engineering-auth`

**Files:**
- Modify: `src/service/qa_engine/docx_exporter.py`

### Step 1: 写 minimal test

由于 docx_exporter 改动是 1 行字典加条目，加一个 minimal regression test 保护即可。

在 `tests/test_auth/test_qa_docx_export.py` 末尾追加（如果不存在文件，新建；如果存在直接 append）：

```python
def test_docx_exporter_handles_chit_chat_section_type():
    """v1.2: chit-chat session 也可以导 docx，title/icon 有兜底。"""
    from src.service.qa_engine.docx_exporter import _SECTION_TITLES, _SECTION_EMOJIS
    assert "chit-chat" in _SECTION_TITLES
    assert "chit-chat" in _SECTION_EMOJIS
    assert _SECTION_TITLES["chit-chat"] == "对话回复"
    assert _SECTION_EMOJIS["chit-chat"] == "💬"
```

### Step 2: 跑 test 看它失败

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_docx_export.py -k chit_chat -v 2>&1 | tail -10`

Expected: FAIL（_SECTION_TITLES["chit-chat"] KeyError）

### Step 3: 改 docx_exporter.py

打开 `src/service/qa_engine/docx_exporter.py`，找到 `_SECTION_TITLES` 字典，追加：

```python
_SECTION_TITLES: dict[str, str] = {
    "overview": "业务概述",
    "entry_point": "入口方法",
    "call_chain": "调用链路",
    "db_ops": "数据库操作",
    "rules": "关键约束与业务规则",
    "sources": "引用来源",
    "chit-chat": "对话回复",  # v1.2: 防 KeyError 兜底（chit-chat 一般不导 docx）
}
```

同理 `_SECTION_EMOJIS`：

```python
_SECTION_EMOJIS: dict[str, str] = {
    "overview": "📋",
    "entry_point": "🚪",
    "call_chain": "🔀",
    "db_ops": "💾",
    "rules": "⚠️",
    "sources": "🔗",
    "chit-chat": "💬",  # v1.2
}
```

### Step 4: 跑 test 看它通过

Run: `cd /Users/java/knowledge-engineering-auth && venv/bin/python -m pytest tests/test_auth/test_qa_docx_export.py -v 2>&1 | tail -10`

Expected: PASS

### Step 5: Commit

```bash
cd /Users/java/knowledge-engineering-auth
git add src/service/qa_engine/docx_exporter.py tests/test_auth/test_qa_docx_export.py
git commit -m "$(cat <<'EOF'
feat(qa-chitchat): docx_exporter title/icon mapping 加 chit-chat 兜底

设计：[[chit-chat-闲聊路径-设计]] §4.5.1

- _SECTION_TITLES['chit-chat'] = '对话回复'
- _SECTION_EMOJIS['chit-chat'] = '💬'
- 防止用户误点导出 docx 时 KeyError
- chit-chat 一般不需要导 docx（不是业务问答），但兜底保证安全

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — Web 前端

## Task 6: 类型扩展 — SectionType union 加 'chit-chat'

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Modify: `src/types/chat.ts`

### Step 1: 改 src/types/chat.ts

打开 `src/types/chat.ts`，找到 `SectionType` union（约 line 32-40），在 `'sources'` 之后加一行：

```typescript
export type SectionType =
  | 'overview'      // 📋 业务概述
  | 'entry_point'   // 🚪 入口方法
  | 'call_chain'    // 🔀 调用链路
  | 'db_ops'        // 💾 数据库操作
  | 'rules'         // ⚠️ 关键约束/规则
  | 'sources'       // 🔗 引用源（含新鲜度徽章）
  | 'chit-chat'     // 💬 闲聊单段（v1.2，前端简化渲染无 h3 header）
```

### Step 2: 跑 tsc 看类型干净

Run: `cd /Users/java/knowledge-engineering-web && npx tsc --noEmit 2>&1 | tail -5`

Expected: 无 error（type 是 union，加一个值不破坏现有 consumer）

### Step 3: 跑全量回归

Run: `cd /Users/java/knowledge-engineering-web && npm test -- --run 2>&1 | tail -5`

Expected: 全部 PASS

### Step 4: Commit

```bash
cd /Users/java/knowledge-engineering-web
git add src/types/chat.ts
git commit -m "$(cat <<'EOF'
feat(qa-chitchat): SectionType union 加 'chit-chat'

设计：[[chit-chat-闲聊路径-设计]] §5.1

- chit-chat 是 v1.2 闲聊路径的 section type（与 6 段式平级，单段使用）
- 前端 AssistantMessage 会检测此 type 跳过 h3 header（Task 7）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: AssistantMessage 渲染分支 + 单测

**Working directory:** `/Users/java/knowledge-engineering-web`

**Files:**
- Modify: `src/components/chat/AssistantMessage.tsx`
- Modify: `src/components/chat/AssistantMessage.test.tsx`（追加测试）

### Step 1: 在测试文件末尾追加测试

打开 `src/components/chat/AssistantMessage.test.tsx`，文件末尾追加：

```typescript
describe('AssistantMessage: chit-chat section', () => {
  it('chit-chat 类型 section 不显示 h3 header (icon + title)', () => {
    const message = {
      id: 'm1',
      session_id: 's1',
      role: 'assistant' as const,
      content: '',
      sections: [{
        type: 'chit-chat' as const,
        title: '',
        content: '你好！有什么业务问题可以问我。',
        references: [],
      }],
      created_at: '2026-05-14T00:00:00Z',
    }
    render(<AssistantMessage message={message} />)

    // h3 标题（含 icon + title 文字）不应出现
    expect(screen.queryByText(/📋|📝|💬\s*业务概述|对话回复/)).not.toBeInTheDocument()
    // 但内容应该展示
    expect(screen.getByText(/你好/)).toBeInTheDocument()
    expect(screen.getByText(/业务问题/)).toBeInTheDocument()
  })

  it('chit-chat section 不渲染 references 区块', () => {
    const message = {
      id: 'm2',
      session_id: 's1',
      role: 'assistant' as const,
      content: '',
      sections: [{
        type: 'chit-chat' as const,
        title: '',
        content: '你好',
        references: [],
      }],
      created_at: '2026-05-14T00:00:00Z',
    }
    render(<AssistantMessage message={message} />)
    // 不显示 "引用来源" 之类的 references 标题
    expect(screen.queryByText(/引用|参考|reference/i)).not.toBeInTheDocument()
  })

  it('普通 6 段式 section 仍然显示 h3 header（不被 chit-chat 改动影响）', () => {
    const message = {
      id: 'm3',
      session_id: 's1',
      role: 'assistant' as const,
      content: '',
      sections: [{
        type: 'overview' as const,
        title: '业务概述',
        content: 'overview 内容',
        references: [],
      }],
      created_at: '2026-05-14T00:00:00Z',
    }
    render(<AssistantMessage message={message} />)
    // overview 类型仍带 emoji + title
    expect(screen.getByText(/📋\s*业务概述/)).toBeInTheDocument()
  })
})
```

### Step 2: 跑 test 看它失败

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/components/chat/AssistantMessage.test.tsx -t chit-chat --run 2>&1 | tail -10`

Expected: 2 个新 case FAIL（chit-chat 类型当前会渲染 h3 header），1 个 overview 现有功能 PASS

### Step 3: 改 AssistantMessage.tsx 加 chit-chat 分支

打开 `src/components/chat/AssistantMessage.tsx`，找到 `sections.map((s, i) => { ... })`（约 line 163-200），把内部的渲染逻辑改成：

**3a.** 找到现有的 sections.map render block：

```tsx
{sections.map((s, i) => {
  const icon = SECTION_ICONS[s.type] ?? '📌'
  const title = s.title || SECTION_TITLES[s.type] || s.type
  // ... (原有代码)
  return (
    <div key={i}>
      <h3 className="font-semibold text-[15px] mb-1.5 text-foreground">
        {icon} {title}
      </h3>
      <div className="text-foreground/85">
        {/* chunks ... */}
      </div>
    </div>
  )
})}
```

**3b.** 把 return 部分改成根据 type 分支：

```tsx
{sections.map((s, i) => {
  const isChitChat = s.type === 'chit-chat'
  const icon = SECTION_ICONS[s.type] ?? '📌'
  const title = s.title || SECTION_TITLES[s.type] || s.type
  const chunks =
    s.type === 'call_chain'
      ? splitMermaidFences(s.content || '')
      : [{ type: 'text' as const, value: s.content || '' }]

  return (
    <div key={i}>
      {/* v1.2: chit-chat 类型跳过 h3 header（单段无标题清爽渲染）*/}
      {!isChitChat && (
        <h3 className="font-semibold text-[15px] mb-1.5 text-foreground">
          {icon} {title}
        </h3>
      )}
      <div className="text-foreground/85">
        {chunks.map((chunk, ci) => {
          // ... (原有 chunk 渲染代码不变)
        })}
      </div>
    </div>
  )
})}
```

注意只加 `const isChitChat = s.type === 'chit-chat'` 和 `{!isChitChat && <h3>...</h3>}` 两处改动，其他逻辑（chunks / mermaid / references / entry_points 等）保持原样。但 references 渲染部分也要加 `!isChitChat` 保护 — 找到原 references / entry_points / freshness 等渲染 JSX，分别加 `!isChitChat &&` 前置（chit-chat 没这些字段，但条件渲染避免渲染空块/null check）。

具体：
- 如果当前代码用 `s.references && s.references.length > 0 && <ReferencesBlock />` — 这种已经 short-circuit ok，不需要再加 isChitChat 判断。
- 如果是 `<ReferencesBlock references={s.references} />` 内部自行判断 — 同样 ok。
- 总之只要 references 是空数组 `[]`，渲染时 short-circuit 不输出即可，**不需要新加 isChitChat 判断**（已经自动）。

主要改动只在 h3 header 一处。

### Step 4: 跑 test 看它通过

Run: `cd /Users/java/knowledge-engineering-web && npm test -- src/components/chat/AssistantMessage.test.tsx -t chit-chat --run 2>&1 | tail -10`

Expected: 3/3 PASS

### Step 5: 全量回归 + tsc

Run:
```bash
cd /Users/java/knowledge-engineering-web
npm test -- --run 2>&1 | tail -6
npx tsc --noEmit 2>&1 | tail -3
```

Expected: 全部测试 PASS；tsc exit 0

### Step 6: Commit

```bash
cd /Users/java/knowledge-engineering-web
git add src/components/chat/AssistantMessage.tsx src/components/chat/AssistantMessage.test.tsx
git commit -m "$(cat <<'EOF'
feat(qa-chitchat): AssistantMessage chit-chat type 简化渲染

设计：[[chit-chat-闲聊路径-设计]] §5.2

- 检测 s.type === 'chit-chat' → 跳过 h3 header（不显示 emoji + section title）
- 内容仍走原有 chunks 渲染（markdown + 不含 mermaid）
- references 因为是空数组自动 short-circuit 不显示
- 业务 section（overview / entry_point / 等）行为不变
- 3 个单测：chit-chat 无 h3 / 无 references / overview 仍有 h3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 集成验证 + Obsidian 变更日志

**Working directory:** 两边

**Files:**
- Modify: `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/chit-chat-闲聊路径-设计.md`（§11 变更日志）

### Step 1: 确认后端 uvicorn 在跑且 reload 生效

Run: `curl -s -o /dev/null -w "/health %{http_code}\n" http://localhost:8000/health`

Expected: HTTP 200

如果 uvicorn 没启动（404 / 连不上）：
```bash
cd /Users/java/knowledge-engineering-auth
pkill -f 'uvicorn.*src.service.api' 2>&1
nohup venv/bin/uvicorn src.service.api:app --host 127.0.0.1 --port 8000 --reload > /tmp/auth-dev.log 2>&1 &
sleep 4
curl -s -o /dev/null -w "/health %{http_code}\n" http://localhost:8000/health
```

### Step 2: 验证 web dev server

Run: `curl -s -o /dev/null -w "web %{http_code}\n" http://localhost:5174/`

Expected: HTTP 200

如果 web dev server 没起：`cd /Users/java/knowledge-engineering-web && npm run dev > /tmp/web-dev.log 2>&1 &`

### Step 3: 手工 §8 验收

打开 http://localhost:5174 → 登录 admin/admin12345 → 选「示例工程（演示用）」 → 在对话框输入：

1. [ ] 输入「你好」 → 期望：响应 1-3 句友好简短回复（包含 KE 介绍 / 4 个业务能力提示），延迟 < 2s
2. [ ] 输入「你是谁」 → 期望：自我介绍 + 4 个业务能力（业务规则 / 调用链路 / 数据流 / 整体架构）
3. [ ] 输入「能做什么」 → 期望：介绍 4 个业务能力
4. [ ] 输入「今天天气怎么样」 → 期望：LLM fallback 选 chit-chat → 引导回业务能力（"我专注于代码知识..."）
5. [ ] 输入「你好 OrderService 的调用链路」 → 期望：业务关键词优先 → 走 dependency → 返回 6 段式答案（不是 chit-chat 单段）
6. [ ] chit-chat session 在 sidebar 正常显示 + 可归档（点 ⋯ → 归档 → session 消失）
7. [ ] chit-chat 段视觉：**没有** "📋 业务概述" 或类似 h3 标题；**没有** 引用区块
8. [ ] light / dark 主题切换都正常
9. [ ] 现有 4 个业务 skill 不回归（问「OrderService 的调用」仍走 dependency 6 段式）

### Step 4: 更新 Obsidian 设计文档变更日志

打开 `/Users/java/obsidian/01 Engineering/knowledge-engineering-web/chit-chat-闲聊路径-设计.md`，在 §11 末尾追加：

```markdown
- 2026-05-14: 实施完成
  - **Auth 后端**（5 commits on `feat/chit-chat-skill`）：router._VALID_SKILL_IDS + _keywords + _LLM_ROUTE_SYSTEM 加 chit-chat / retriever 短路 / prompts._CHIT_CHAT_SYSTEM / synthesizer 同步 + 流式分支 / docx_exporter mapping 兜底
  - **Web 前端**（2 commits on `feat/chit-chat-skill`）：types/chat.ts SectionType union 加 'chit-chat' / AssistantMessage 检测 chit-chat type 跳过 h3 header
  - 自动化验证：Auth tests + Web tests + tsc 全过
  - 手工 §8 验收：[全部 9/9 通过 / X 项不通过见 fix 列表]
  - 实施计划：`knowledge-engineering-web/docs/superpowers/plans/2026-05-14-chit-chat-skill.md`
```

### Step 5: 最终 commit

```bash
cd /Users/java/knowledge-engineering-web
git status
git log --oneline -10
```

如果 plan 文件需要更新（手工验收发现的 fix）就 commit；否则跳过。

---

## Self-Review

### 1. Spec coverage

| Spec § | 内容 | Task |
|---|---|---|
| §3 决策 1 | 友好 + 接到业务能力 | Task 3 (_CHIT_CHAT_SYSTEM prompt) |
| §3 决策 2 | 关键词 + LLM fallback | Task 1 (router) |
| §3 决策 3 | 新 SectionType chit-chat 前端简化 | Task 6 (types) + Task 7 (AssistantMessage) |
| §3 决策 4 | Retriever 短路 | Task 2 |
| §3 决策 5 | 业务关键词优先 > chit-chat | Task 1 step 3c (keyword 字典放最后) + test_business_keyword_overrides_chit_chat |
| §3 决策 6 | SSE 流式 = 6 段式同协议 | Task 4 (synthesize_stream chit-chat 分支用相同 on_token 回调) |
| §3 决策 7 | DB 层不区分 chit-chat 与业务 | 无 task 显式实现（自动满足 — synthesizer 输出存进现有 messages 表 sections JSON）|
| §4.1 router 改动 | _VALID_SKILL_IDS + _keywords + _LLM_ROUTE_SYSTEM | Task 1 |
| §4.2 retriever 短路 | chit-chat 返回空 ctx | Task 2 |
| §4.3 synthesizer 分支 | _synthesize_chit_chat 同步 + 流式 | Task 3 + Task 4 |
| §4.4 _CHIT_CHAT_SYSTEM | prompt 内容 | Task 3 step 3 |
| §4.5 SectionType 后端 | 不需要改 type 文件（确认）| 无 task（已在 spec §4.5 里说明）|
| §4.5.1 docx_exporter 兜底 | title/emoji mapping | Task 5 |
| §4.6 SSE 协议不改 | 沿用现有 meta/section_start/content/section_done/done | 无 task（synthesize_stream 已经按现有协议工作）|
| §5.1 前端 types | SectionType union | Task 6 |
| §5.2 前端渲染 | AssistantMessage 简化 | Task 7 |
| §7 边界 | 9 个 case | Task 1 测试覆盖部分 + Task 8 手工 §8 |
| §8 验收 9 条 | 集成验证 | Task 8 |

无 spec 漏覆盖。

### 2. Placeholder scan

- ❌ Task 3 step 4a 写了 "假设 prompts.py 内是 `_CHIT_CHAT_SYSTEM` 但 import 时可以引用" — 这是软指引，让 implementer 看情况 rename underscore prefix。属可接受（_underscore 名 cross-module import 是合法 Python，只是不优雅；implementer 看具体 prompts.py 现有导出风格决定）。
- ❌ Task 7 step 3b 写 "references 因为是空数组自动 short-circuit 不显示" — 这依赖于现有渲染代码已经做了 short-circuit。如果现有代码没做，implementer 需要补一个 `!isChitChat &&` guard。也属软指引。

不是 hard placeholder（无 TBD/TODO/"implement later"）。

### 3. Type consistency

- skill_id 字符串 `"chit-chat"` 在 Task 1-4 全程一致。
- section type 字符串 `"chit-chat"` 在 Task 3/4/5/6/7 全程一致。
- `_CHIT_CHAT_SYSTEM` 名字在 Task 3 (prompts.py 定义) + Task 3 (synthesizer 引用) + Task 4 (synthesize_stream 引用) 一致。
- `_synthesize_chit_chat` (同步) 和 `_synthesize_chit_chat_stream` (流式) 命名对称。
- `SECTION_TITLES['chit-chat'] = '对话回复'` 和 `SECTION_EMOJIS['chit-chat'] = '💬'` (Task 5) 与 Spec §4.5.1 一致。

无不一致。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-chit-chat-skill.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 task 派一个 fresh subagent 实现，task 之间快速 spec + quality 双 review。跨仓 5 个 task auth + 2 个 task web + 1 个集成 = 8 个 task。

**2. Inline Execution** — 当前会话内顺序跑，到 checkpoint 时停下来 review。

Which approach?
