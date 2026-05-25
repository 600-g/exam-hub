# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`exam-hub` is a **static, build-free single-page-per-mode site** for multi-exam study (currently AI-900 and SQLD). Deployed to `exam.600g.net` via GitHub Pages — every `git push origin main` is the deploy.

There is **no build step, no test runner, no package.json**. Editing `data/<exam>/questions.json` is the primary way to strengthen the product; UI code rarely needs changes.

## Commands

```bash
# Local preview (any static server works)
python3 -m http.server 8000   # then open http://localhost:8000

# Validate questions JSON before commit
python3 -c "import json; data=json.load(open('data/sqld/questions.json')); print(len(data), 'questions OK')"

# Generate new SQLD questions via Claude API
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...
python3 scripts/generate_sqld.py --topic "조인" --count 5
python3 scripts/generate_sqld.py --subject S1 --topic "정규화" --count 3

# Deploy
git push origin main   # GitHub Pages auto-builds in ~1-2 min
```

There are no lint or test commands — validation is JSON-load + manual browser check after deploy. After pushing, the `version.json` controls the in-page version banner that prompts users to hard-refresh.

## Architecture

### Two-axis URL routing
Every page (`exam.html`, `quiz.html`, `mock.html`, `review.html`, `stats.html`) reads `?id=<exam_id>` from the URL and branches on the exam metadata. `index.html` is just the picker. Adding a new exam never requires touching page HTML — only `data/exams.json` + `data/<id>/questions.json`.

### `exam.subjects` (SQLD) vs `exam.domains` (AI-900) — critical divergence
The two exams have different organizing units, and the code branches on whichever is defined:
- **SQLD** uses `subjects` (`S1`/`S2`) with `questionCount`, `score`, and `subjectFailThreshold` (per-subject pass threshold, e.g. 40% per subject for SQLD's 과락).
- **AI-900** uses `domains` with `weight` (proportional sampling for mock exams).

When editing `mock.html` or `stats.html`, look for the `if (exam.subjects) { ... } else if (exam.domains) { ... }` pattern (mock.html:94/102, stats.html similar). A change to one branch usually needs the mirror in the other.

Question records use `subject` (SQLD) **or** `domain` (AI-900) as the section key. `app.js` normalizes via `q.domain || q.subject` everywhere, so when reading questions in new code, follow that idiom rather than hardcoding either.

### `ExamHub` (assets/app.js) — single shared helper
All pages include `assets/app.js` which exposes a global `ExamHub` object. The important methods:
- `loadExams()` — caches `data/exams.json`, must be awaited before `getExam(id)`
- `getStats(examId)` / `recordAnswer(examId, q, isCorrect)` — per-exam stats tracked in localStorage
- `getWrongList(examId)` — answered-wrong question IDs
- `shuffleOptions(q)` — randomizes A/B/C/D positions, returns new question with `_origAnswer` preserved (prevents position memorization)
- `buildPracticeSet(examId, all, exam, wrongIds, n)` — review.html's "범위 확장" mode: 50% wrong + 25% weak-topic + 25% random
- `buildDifficultyBalancedSet(all, exam, n)` — mock.html's "난이도 균형" mode; auto-fills shortage if a difficulty bucket is under-supplied (note: requires `difficulty` field on questions)
- `getWeakTopics(examId, limit)` — only counts topics with ≥3 attempts (avoids noise)

### localStorage namespace
**Always** use `exam_<id>_<key>` via `ExamHub.getJSON/setJSON`. Never read/write localStorage directly with un-namespaced keys — exams must stay isolated. The `admin_<examId>_questions_draft` key is the in-browser-only draft store (`admin.html` does not push to the server).

### Question schema (data/<exam>/questions.json)
```json
{
  "id": "sqld_s2_001",          // exam_section_seqno, must be unique
  "subject": "S2",               // SQLD: S1/S2  |  AI-900 uses "domain" instead
  "topic": "GROUP BY/HAVING",    // free-form, must match exam.subjects[*].topics for stats grouping
  "tags": ["GROUP BY", "..."],   // used by getWeakTopics() — these are the weak-topic keys
  "difficulty": "중",            // "상" | "중" | "하" — required for 난이도 균형 mode
  "question": "...",
  "code": "(optional SQL/data)",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "answer": "C",
  "explanation_detail": {
    "simple":   "비전공자도 이해할 쉬운 설명",
    "steps":    ["풀이 단계 1", "..."],
    "practical":"실무 활용",
    "pitfall":  "함정·주의"
  }
}
```
**Keep all four `explanation_detail` keys** even when content is short — page rendering assumes the 4-pane structure.

### admin.html is browser-local only
The editor at `admin.html` writes drafts to localStorage (`admin_<examId>_questions_draft`) and exports JSON via download. **It does not write to `data/<id>/questions.json`** — there's no server. To merge draft → committed: download the JSON, replace the file on disk, `git push`.

## Workflow conventions

- **Content > infra.** Most user-visible improvements are achieved by adding/editing questions, not by writing code. Resist building admin/import features without a real server.
- **Bump `version.json`** when shipping noticeable changes. The in-page version banner shows users when to hard-refresh past the GitHub Pages cache.
- **Question additions are append-only.** Don't renumber existing IDs — `localStorage` wrong-lists and stats reference them by id. New questions get a new id (`<exam>_<section>_<nextseq>` or `gen_<ts>_<idx>` from the generator script).
- **Korean is the content language.** Question/option/explanation text is Korean; identifiers and code are English.

## Known footguns

- **LAST_VALUE-style window-frame defaults**: when adding window-function questions, remember the SQL semantics, not just the test taxonomy.
- **mock.html's WHERE filter on OUTER JOIN tables** silently turns LEFT JOIN into INNER JOIN — there's an actual test question on this (s2_057). Authoring similar questions: keep examples consistent with how the engine renders `q.code` (the `<pre><code>` block in `renderQuestionBody`).
- **`difficulty` is non-optional for new questions.** Code falls back to `'중'` when missing (app.js:182), so omissions silently distort the 난이도 균형 mode without throwing.
- **`exam_<id>_stats.byTopic`** uses tag strings as keys. Renaming a tag fragments stats across the old/new name — if you must rename, plan a migration in `app.js`.
- **shuffleOptions ↔ 해설 letter 동기화**: `assets/app.js:shuffleOptions` 가 보기 위치 셔플 + 정답키 remap + 해설(평문 `explanation` 및 4단 `explanation_detail`) 의 letter 참조(`정답은 B`, `(A)`, `→ A`) 까지 같은 매핑으로 함께 remap. 신규 화면에서 해설을 렌더할 때 반드시 셔플본(`shuffled`)을 넘길 것 — 원본(`origQ`) 넘기면 풀이가 어긋남 (commit `6659831` 에서 review.html 이 그래서 깨져 있었음). 헬퍼 `_remapAnswerLetters` 는 라틴/숫자 인접 letter(`API`·`2D`·`A4`·`C2PA`·`D3`·`B2B`) 와 `"A/B 테스트"` 같은 고정 용어를 보호함.
- **Gemini 2.5 Flash thinking 모델**: `admin.html` 의 AI 생성 + `assets/app.js` ⚙️ 설정 모달의 연결 테스트가 호출하는 `gemini-2.5-flash` 는 thinking 모델. `generationConfig` 에 `thinkingConfig:{thinkingBudget:0}` 빠지면 사고 토큰이 8192 예산을 잠식해 JSON 잘림 → 파싱 실패. 신규 Gemini 모델 추가 시 동일 체크.
- **AI-900 = `source: dump_pdf` 출처**: 668문제는 실제 기출 덤프 기계번역. 평문 `explanation` 만 있고 `difficulty`/`tags` 없음(폴백으로 동작은 함). 과거 끝이 빈 `참고:` 헤더로 잘린 24건 + URL 슬러그가 해설 자리에 들어간 6건(`q_022`·`051`·`112`·`138`·`150`·`171`) 발견됨 (commit `702d4af`). 신규 dump import 시 `grep -E '[a-z]+/[a-z\-]+'` 와 짧은 해설(<25자) 체크 권장. SQLD/AIPOT 은 4단 schema 완비라 깨끗.
- **CF proxy + 브라우저 캐시**: exam.600g.net 은 GitHub Pages → Cloudflare proxy. `questions.json` 은 `cache:'no-cache'` 로 페치되지만 사용자가 페이지 **열어둔 상태**면 다음 페이지 진입까지 옛 데이터 유지 — "고친 게 안 보임" 신고 시 강력 새로고침(Cmd+Shift+R) 유도 또는 `version.json` bump 으로 배너 트리거. 라이브 검증: `curl -s "https://exam.600g.net/data/<exam>/questions.json?cb=$(date +%s)"`. `assets/app.js` 또는 `assets/style.css` 변경 시엔 7개 HTML 의 `?v=YYYYMMDDx` 를 같이 bump 해야 CF·브라우저 캐시 우회됨 (`sed -i '' 's#app.js?v=...#app.js?v=...#' *.html`).
