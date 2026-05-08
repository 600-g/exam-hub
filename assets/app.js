// exam-hub 공통 — 시험별 데이터/storage 헬퍼
// localStorage 네임스페이스: exam_<id>_<key>
// URL 파라미터로 시험 분기: ?id=ai900 또는 ?id=sqld

(function (global) {
  const ExamHub = {
    examMeta: null, // exams.json 캐시

    /**
     * URL ?id=xxx 추출 (없으면 null)
     */
    getExamIdFromUrl() {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('id');
    },

    /**
     * 시험 메타 로드 (exams.json)
     */
    async loadExams() {
      if (this.examMeta) return this.examMeta;
      const r = await fetch('data/exams.json', { cache: 'no-cache' });
      this.examMeta = await r.json();
      return this.examMeta;
    },

    async getExam(id) {
      const meta = await this.loadExams();
      return meta.exams.find((e) => e.id === id) || null;
    },

    async loadQuestions(examId) {
      const r = await fetch(`data/${examId}/questions.json`, { cache: 'no-cache' });
      return await r.json();
    },

    /* localStorage 네임스페이스 헬퍼 */
    _key(examId, suffix) {
      return `exam_${examId}_${suffix}`;
    },
    getJSON(examId, suffix, fallback) {
      try {
        const v = localStorage.getItem(this._key(examId, suffix));
        return v ? JSON.parse(v) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    setJSON(examId, suffix, value) {
      try {
        localStorage.setItem(this._key(examId, suffix), JSON.stringify(value));
      } catch (e) {
        console.warn('localStorage 저장 실패', e);
      }
    },

    /* 오답 목록 */
    getWrongList(examId) {
      return this.getJSON(examId, 'wrong_list', []);
    },
    addWrong(examId, qid) {
      const set = new Set(this.getWrongList(examId));
      set.add(qid);
      this.setJSON(examId, 'wrong_list', [...set]);
    },
    removeWrong(examId, qid) {
      const list = this.getWrongList(examId).filter((x) => x !== qid);
      this.setJSON(examId, 'wrong_list', list);
    },

    /* 통계 — 도메인/토픽별 정답률 */
    getStats(examId) {
      return this.getJSON(examId, 'stats', {
        totalAnswered: 0,
        totalCorrect: 0,
        byDomain: {}, // { domainId: { answered, correct } }
        byTopic: {}, // { tag: { answered, correct } }
        history: [], // [{ts, qid, correct, domain, tags}]
      });
    },
    recordAnswer(examId, q, isCorrect) {
      const s = this.getStats(examId);
      s.totalAnswered += 1;
      if (isCorrect) s.totalCorrect += 1;
      const d = q.domain || q.subject || 'unknown';
      s.byDomain[d] = s.byDomain[d] || { answered: 0, correct: 0 };
      s.byDomain[d].answered += 1;
      if (isCorrect) s.byDomain[d].correct += 1;
      (q.tags || []).forEach((t) => {
        s.byTopic[t] = s.byTopic[t] || { answered: 0, correct: 0 };
        s.byTopic[t].answered += 1;
        if (isCorrect) s.byTopic[t].correct += 1;
      });
      s.history.push({
        ts: Date.now(),
        qid: q.id,
        correct: !!isCorrect,
        domain: d,
        tags: q.tags || [],
      });
      // history는 최근 1000개만 유지
      if (s.history.length > 1000) s.history = s.history.slice(-1000);
      this.setJSON(examId, 'stats', s);
    },
    resetStats(examId) {
      this.setJSON(examId, 'stats', {
        totalAnswered: 0,
        totalCorrect: 0,
        byDomain: {},
        byTopic: {},
        history: [],
      });
    },

    /* 모의고사 결과 */
    saveMockResult(examId, result) {
      const list = this.getJSON(examId, 'mock_results', []);
      list.push(result);
      this.setJSON(examId, 'mock_results', list.slice(-50));
    },
    getMockResults(examId) {
      return this.getJSON(examId, 'mock_results', []);
    },

    /* 셔플 */
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    /* 약점 분석 — 토픽별 정답률 낮은 순 */
    getWeakTopics(examId, limit = 5) {
      const s = this.getStats(examId);
      const arr = Object.entries(s.byTopic)
        .filter(([_, v]) => v.answered >= 3) // 3회 이상 풀어본 것만
        .map(([k, v]) => ({
          topic: k,
          answered: v.answered,
          correct: v.correct,
          rate: v.correct / v.answered,
        }))
        .sort((a, b) => a.rate - b.rate)
        .slice(0, limit);
      return arr;
    },

    /* HTML 이스케이프 (XSS 방지) */
    escape(s) {
      if (s == null) return '';
      return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
    },

    /* SQL 코드 + 결과 테이블 렌더 */
    renderQuestionBody(q) {
      let html = '';
      if (q.code) {
        html += `<pre><code>${this.escape(q.code)}</code></pre>`;
      }
      html += `<div style="margin:12px 0;white-space:pre-wrap;">${this.escape(q.question)}</div>`;
      if (q.has_image && q.image_path) {
        html += `<img src="${this.escape(q.image_path)}" alt="문제 이미지" style="max-width:100%;border-radius:8px;border:1px solid var(--border);" />`;
      }
      return html;
    },

    /* 해설 4단 렌더 */
    renderExplanation(q) {
      const e = q.explanation_detail || {};
      const fb = q.explanation || '';
      let html = '<div class="explain">';
      if (e.simple) html += `<h4>🌱 쉬운 설명</h4><div>${this.escape(e.simple)}</div>`;
      if (e.steps && e.steps.length) {
        html += `<h4>📋 단계별 풀이</h4><ol style="margin:0;padding-left:20px;">`;
        e.steps.forEach((s) => (html += `<li>${this.escape(s)}</li>`));
        html += `</ol>`;
      }
      if (e.practical) html += `<h4>💡 실무 활용</h4><div>${this.escape(e.practical)}</div>`;
      if (e.pitfall) html += `<h4>⚠️ 헷갈리지 말 것</h4><div>${this.escape(e.pitfall)}</div>`;
      if (!e.simple && fb) html += `<div>${this.escape(fb)}</div>`;
      html += '</div>';
      return html;
    },
  };

  global.ExamHub = ExamHub;
})(window);
