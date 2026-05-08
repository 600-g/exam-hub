#!/usr/bin/env python3
"""
SQLD 문제 자동 생성 스크립트 — Claude API 사용
사용법:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-...
    python3 generate_sqld.py --topic "조인" --count 5

생성된 문제는 ../data/sqld/questions.json에 append됩니다.
중복 ID 방지: 'gen_<timestamp>_<idx>' 형식.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    from anthropic import Anthropic
except ImportError:
    print("anthropic 패키지가 필요합니다: pip install anthropic", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_FILE = ROOT / "data" / "sqld" / "questions.json"
EXAMS_FILE = ROOT / "data" / "exams.json"

PROMPT_TEMPLATE = """당신은 SQLD(SQL 개발자) 시험 출제 전문가입니다.

다음 조건으로 SQLD 시험 문제 {count}개를 생성하세요:
- 과목: {subject_name}
- 토픽: {topic}
- 난이도: 실제 시험 수준 (한국데이터산업진흥원 출제기준)
- 형식: 4지선다 객관식

각 문제는 반드시 아래 JSON 스키마를 따릅니다:
```json
{{
  "id": "gen_{ts}_<idx>",
  "subject": "{subject_id}",
  "topic": "{topic}",
  "tags": ["관련키워드1", "관련키워드2"],
  "question": "문제 본문 (한국어)",
  "code": "SQL 코드 또는 데이터 (있을 때만)",
  "options": {{ "A": "...", "B": "...", "C": "...", "D": "..." }},
  "answer": "A",
  "explanation_detail": {{
    "simple": "비전공자도 이해할 쉬운 비유 + 핵심 개념 (3-4문장)",
    "steps": ["풀이 단계 1", "단계 2", "단계 3", "결론"],
    "practical": "실무에서 어떻게 쓰이는지 (1-2문장)",
    "pitfall": "헷갈리기 쉬운 함정 + 시험 자주 출제 포인트"
  }}
}}
```

중요:
1. JSON 배열만 출력 (설명·markdown 금지)
2. 모든 문제는 위 4단 해설(simple/steps/practical/pitfall) 필수
3. SQL 코드는 Oracle 문법 기준
4. 'simple'은 진짜 비전공자가 읽고 이해 가능한 수준 — 비유·일상 예시 활용
5. 정답은 무작위로 분포 (A/B/C/D 균등)
6. 같은 토픽 안에서도 다양한 각도에서 출제

출력: JSON 배열 시작은 [ 끝은 ]"""


def load_existing() -> list[dict]:
    if QUESTIONS_FILE.exists():
        return json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
    return []


def load_subjects() -> dict[str, dict]:
    meta = json.loads(EXAMS_FILE.read_text(encoding="utf-8"))
    sqld = next(e for e in meta["exams"] if e["id"] == "sqld")
    return {s["id"]: s for s in sqld["subjects"]}


def generate(topic: str, count: int, subject_id: str) -> list[dict]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ANTHROPIC_API_KEY 환경변수가 필요합니다", file=sys.stderr)
        sys.exit(1)

    subjects = load_subjects()
    subject = subjects.get(subject_id)
    if not subject:
        print(f"알 수 없는 subject: {subject_id} (S1 또는 S2)", file=sys.stderr)
        sys.exit(1)

    ts = int(time.time())
    prompt = PROMPT_TEMPLATE.format(
        count=count,
        subject_id=subject_id,
        subject_name=subject["name"],
        topic=topic,
        ts=ts,
    )

    client = Anthropic(api_key=api_key)
    print(f"📡 Claude API 호출 중 ({subject_id} / {topic} / {count}문제)...")

    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()

    # JSON 추출 (코드 블록 마크다운이 섞여 있을 수도)
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
        if text.endswith("```"):
            text = text[:-3].strip()

    try:
        questions = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"❌ JSON 파싱 실패: {e}", file=sys.stderr)
        print(text[:500], file=sys.stderr)
        sys.exit(1)

    # ID 후처리 — 중복 방지
    for i, q in enumerate(questions):
        q["id"] = f"gen_{ts}_{i:03d}"
        q.setdefault("subject", subject_id)
        q.setdefault("topic", topic)

    return questions


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", required=True, help="출제 토픽 (예: '조인', 'NULL', '윈도우함수')")
    parser.add_argument("--count", type=int, default=5, help="생성할 문제 수 (기본 5)")
    parser.add_argument("--subject", default="S2", help="S1(데이터모델링) 또는 S2(SQL기본/활용). 기본 S2")
    parser.add_argument("--dry-run", action="store_true", help="저장하지 않고 stdout 출력만")
    args = parser.parse_args()

    new_qs = generate(args.topic, args.count, args.subject)

    if args.dry_run:
        print(json.dumps(new_qs, ensure_ascii=False, indent=2))
        return

    existing = load_existing()
    existing_ids = {q["id"] for q in existing}
    added = [q for q in new_qs if q["id"] not in existing_ids]

    merged = existing + added
    QUESTIONS_FILE.write_text(
        json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"✅ {len(added)}문제 추가. 총 {len(merged)}문제.")


if __name__ == "__main__":
    main()
