# Exam Hub

자격증 시험 준비 — 다중 시험 통합 관리 (AI-900, SQLD ...)

## 구조

```
exam-hub/
├── index.html       시험 선택 랜딩
├── exam.html        시험별 메뉴
├── quiz.html        학습 모드 (퀴즈 + 즉시 피드백)
├── mock.html        실전 모의고사 (시간제한 + 합격컷 + 과락)
├── review.html      오답 복습
├── stats.html       약점 분석 (도메인·토픽별 정답률)
├── data/
│   ├── exams.json   시험 메타 (이름·합격점·시간·도메인)
│   ├── ai900/questions.json
│   └── sqld/questions.json
├── assets/          공통 스타일·JS
└── scripts/
    └── generate_sqld.py   Claude API로 SQLD 문제 자동 생성
```

## 데이터 모델

### `data/exams.json`
시험 메타 정의. SQLD는 과목별 과락 임계값(`subjectFailThreshold`) 적용.

### `data/<exam>/questions.json`
각 문제는:
```json
{
  "id": "sqld_s2_001",
  "subject": "S2",
  "topic": "GROUP BY/HAVING",
  "tags": ["GROUP BY", "HAVING", "집계함수"],
  "question": "...",
  "code": "(선택) SQL 코드",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "answer": "C",
  "explanation_detail": {
    "simple": "비전공자도 이해할 쉬운 설명",
    "steps": ["풀이 단계 1", "..."],
    "practical": "실무 활용",
    "pitfall": "헷갈리는 부분"
  }
}
```

## 문제 추가 (SQLD)

```bash
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# 조인 토픽 5문제 생성
python3 scripts/generate_sqld.py --topic "조인" --count 5

# 1과목 정규화 3문제
python3 scripts/generate_sqld.py --subject S1 --topic "정규화" --count 3
```

## 시험 추가

`data/exams.json`의 `exams` 배열에 새 시험 객체 추가 + `data/<id>/questions.json` 생성하면 끝. 모든 페이지가 `?id=<exam_id>` 파라미터로 자동 분기.

## localStorage 네임스페이스

시험별로 완전히 분리:
- `exam_<id>_wrong_list` — 오답 목록
- `exam_<id>_stats` — 도메인·토픽별 정답률
- `exam_<id>_mock_results` — 모의고사 이력

## 배포

GitHub Pages — 정적 호스팅. 빌드 불필요. 푸시만 하면 자동 반영.
