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
