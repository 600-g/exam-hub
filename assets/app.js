// exam-hub 공통 — 시험별 데이터/storage 헬퍼
// localStorage 네임스페이스: exam_<id>_<key>
// URL 파라미터로 시험 분기: ?id=ai900 또는 ?id=sqld

(function (global) {
  const ExamHub = {
    examMeta: null, // exams.json 캐시

    /**
     * 테마 적용 — body data-theme 속성 갱신 + localStorage 저장
     */
    applyTheme(theme) {
      const t = theme === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('exam_theme', t);
    },

    /**
     * ⚙️ 설정 모달 — Gemini API 키 + 테마 등 글로벌 설정
     * 페이지마다 topbar의 ⚙️ 버튼이 이 함수를 호출
     */
    openSettings() {
      const existing = document.getElementById('exam-settings-modal');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'exam-settings-modal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
      const currentKey = localStorage.getItem('exam_ai_gen_key') || '';
      const currentTheme = localStorage.getItem('exam_theme') || 'dark';
      overlay.innerHTML = `
        <div style="background:var(--modal-bg);color:var(--modal-text);border:1px solid var(--border);border-radius:10px;padding:22px;max-width:520px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,0.4);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <h2 style="margin:0;flex:1;font-size:18px;">⚙️ 설정</h2>
            <button id="settings-close-x" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-dim);">✕</button>
          </div>

          <h3 style="margin:0 0 8px;font-size:14px;color:var(--accent);">🎨 테마</h3>
          <div style="display:flex;gap:8px;margin-bottom:18px;">
            <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--panel-2);">
              <input type="radio" name="theme" value="dark" ${currentTheme === 'dark' ? 'checked' : ''}> 🌙 다크
            </label>
            <label style="flex:1;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:var(--panel-2);">
              <input type="radio" name="theme" value="light" ${currentTheme === 'light' ? 'checked' : ''}> ☀️ 라이트
            </label>
          </div>

          <h3 style="margin:0 0 6px;font-size:14px;color:var(--accent);">✨ AI 문제 생성 — Google Gemini API</h3>
          <p style="font-size:12px;margin:0 0 10px;color:var(--text-dim);">
            admin "✨ AI 생성"에 사용. Gemini 2.5 Flash 무료 tier (15/min, 1500/day).
            <br>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">→ API 키 발급받기 (무료, Gmail 로그인)</a>
          </p>
          <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;">API 키</label>
          <div style="display:flex;gap:6px;">
            <input type="password" id="settings-api-key" value="${currentKey.replace(/"/g,'&quot;')}" placeholder="AIza..." style="flex:1;padding:8px;border:1px solid var(--input-border);border-radius:6px;font-family:monospace;font-size:13px;background:var(--input-bg);color:var(--text);">
            <button id="settings-show-key" type="button" style="padding:0 12px;border:1px solid var(--input-border);border-radius:6px;background:var(--panel-2);color:var(--text);cursor:pointer;">👁</button>
          </div>
          <div style="margin-top:6px;font-size:11px;color:var(--text-dim);">
            ${currentKey ? '✅ 저장된 키 있음 (' + currentKey.slice(0,7) + '...' + currentKey.slice(-4) + ')' : '⚠️ 저장된 키 없음'}
          </div>
          <div style="font-size:11px;margin-top:8px;background:var(--note-bg);border:1px solid var(--note-border);border-radius:6px;padding:8px;color:var(--text);">
            🔒 키는 이 브라우저의 localStorage에만 저장 · 서버 미전송.
            본인 기기에서만 사용하세요.
          </div>

          <div style="display:flex;gap:8px;margin-top:18px;">
            <button id="settings-save" class="btn primary" style="flex:1;">💾 저장</button>
            <button id="settings-clear" class="btn danger">🗑 키 삭제</button>
            <button id="settings-close" class="btn ghost">닫기</button>
          </div>

          <hr style="margin:18px 0;">
          <h3 style="margin:0 0 6px;font-size:14px;color:var(--accent);">🧪 진단</h3>
          <button id="settings-test" class="btn" style="font-size:12px;">🔌 Gemini 연결 테스트</button>
          <div id="settings-test-result" style="margin-top:8px;font-size:12px;color:var(--text-dim);"></div>

          <hr style="margin:18px 0;">
          <h3 style="margin:0 0 6px;font-size:14px;color:var(--accent);">🔧 개발자 모드</h3>
          <p style="font-size:12px;margin:0 0 10px;color:var(--text-dim);">채팅·터미널·패치 히스토리로 시험앱을 직접 관리</p>
          <button id="settings-doogeun" class="btn" style="font-size:12px;">🔧 개발자 모드 열기</button>
        </div>`;
      document.body.appendChild(overlay);

      // 테마 라디오: 즉시 적용
      overlay.querySelectorAll('input[name="theme"]').forEach((r) => {
        r.addEventListener('change', () => ExamHub.applyTheme(r.value));
      });

      const $ = (sel) => overlay.querySelector(sel);
      const input = $('#settings-api-key');
      const close = () => overlay.remove();
      $('#settings-close-x').onclick = close;
      $('#settings-close').onclick = close;
      overlay.onclick = (e) => { if (e.target === overlay) close(); };

      $('#settings-show-key').onclick = () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      };

      $('#settings-save').onclick = () => {
        const v = input.value.trim();
        if (!v) { alert('API 키를 입력하세요.'); return; }
        localStorage.setItem('exam_ai_gen_key', v);
        $('#settings-test-result').innerHTML = '✅ 저장됨';
        setTimeout(close, 600);
      };

      $('#settings-clear').onclick = () => {
        if (!confirm('저장된 API 키를 삭제할까요?')) return;
        localStorage.removeItem('exam_ai_gen_key');
        input.value = '';
        $('#settings-test-result').innerHTML = '🗑 삭제됨';
      };

      $('#settings-doogeun').onclick = () => {
        if (window.doogeunEmbed && typeof window.doogeunEmbed.open === 'function') {
          window.doogeunEmbed.open();
        } else {
          alert('두근컴퍼니 위젯 로드 실패 — 페이지 새로고침 후 다시 시도해주세요');
        }
      };

      $('#settings-test').onclick = async () => {
        const key = input.value.trim();
        if (!key) { $('#settings-test-result').innerHTML = '⚠️ 키를 먼저 입력하세요.'; return; }
        $('#settings-test-result').innerHTML = '🔄 테스트 중...';
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Reply with just: OK' }] }],
                // gemini-2.5-flash 는 thinking 모델 — thinkingBudget:0 이 없으면
                // maxOutputTokens 를 내부 사고 토큰에 다 써버려 빈 응답이 온다.
                generationConfig: { maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } },
              }),
            }
          );
          if (!r.ok) {
            const t = await r.text();
            let hint = '';
            if (r.status === 400 || r.status === 403) hint = ' — API 키가 잘못되었거나 만료됨. aistudio.google.com 에서 새 키 발급';
            else if (r.status === 429) hint = ' — 무료 한도 초과 (분15·일1500). 잠시 후 재시도';
            $('#settings-test-result').innerHTML = `❌ ${r.status}${hint}<br><span style="opacity:.65;">${ExamHub.escape(t.slice(0, 150))}</span>`;
            return;
          }
          const data = await r.json();
          const txt = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
          if (!txt) {
            $('#settings-test-result').innerHTML = '⚠️ 키는 유효하나 모델 응답 본문이 비어있음 — 잠시 후 재시도';
            return;
          }
          $('#settings-test-result').innerHTML = '✅ Gemini API 정상 작동';
        } catch (e) {
          $('#settings-test-result').innerHTML = `❌ ${ExamHub.escape(e.message)} — 네트워크/CORS 문제일 수 있음`;
        }
      };

      input.focus();
    },

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

    /**
     * 보기(A/B/C/D) 순서 무작위 셔플 — 위치 암기 방지.
     * 같은 문제를 여러 번 만나도 항상 다른 배치로 보임.
     * 정답키 + 해설(평문 explanation / 4단 explanation_detail)의 letter 참조를
     * 같은 매핑으로 함께 remap → 셔플해도 "정답은 B" 같은 풀이가 어긋나지 않음.
     */
    shuffleOptions(q) {
      if (!q.options || Object.keys(q.options).length < 2) return q;
      const entries = Object.entries(q.options); // [[origKey, value], ...]
      const shuffled = this.shuffle(entries);
      const newOptions = {};
      const fwd = {}; // origKey → newKey (해설 remap 에 사용)
      shuffled.forEach(([origKey, val], i) => {
        const newKey = String.fromCharCode(65 + i); // A=65, B=66, ...
        newOptions[newKey] = val;
        fwd[origKey] = newKey;
      });
      const out = {
        ...q,
        options: newOptions,
        answer: fwd[q.answer] || q.answer,
        _origAnswer: q.answer,
      };
      // 해설 letter 동기화 — 평문 explanation + 4단 explanation_detail
      if (q.explanation) out.explanation = this._remapAnswerLetters(q.explanation, fwd);
      if (q.explanation_detail) {
        const ed = q.explanation_detail;
        out.explanation_detail = {
          ...ed,
          simple: this._remapAnswerLetters(ed.simple, fwd),
          steps: Array.isArray(ed.steps) ? ed.steps.map((s) => this._remapAnswerLetters(s, fwd)) : ed.steps,
          practical: this._remapAnswerLetters(ed.practical, fwd),
          pitfall: this._remapAnswerLetters(ed.pitfall, fwd),
        };
      }
      return out;
    },

    /**
     * 해설 텍스트의 보기 letter(A-D)를 셔플 매핑(fwd: origKey→newKey)대로 치환.
     * 셔플로 "정답은 B" 같은 풀이가 어긋나는 것을 막는다.
     * - 라틴문자/숫자에 인접한 letter 는 제외 → API·RAG·2D·3D·A4·C2PA·D3·B2B 보호
     * - "A/B 테스트·결과" 처럼 letter 가 고정 용어인 구간은 문맥 검사로 보존
     * 보기 참조든 예시 라벨(NVL(A,B) 등)이든 일관 치환되어 의미가 깨지지 않는다.
     * lookbehind 미사용 (구형 iOS Safari 호환).
     */
    _remapAnswerLetters(text, fwd) {
      if (!text || typeof text !== 'string') return text;
      const TERM = /[A-D]\s*\/\s*[A-D]\s*(?:테스트|테스팅|결과|실험)/;
      return text.replace(/([^A-Za-z0-9]|^)([A-D])(?![A-Za-z0-9])/g, (m, pre, ch, offset, str) => {
        if (TERM.test(str.slice(Math.max(0, offset - 4), offset + 16))) return m;
        return pre + (fwd[ch] || ch);
      });
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

    /* 난이도 균형 모드: 상/중/하 균등하게 출제 */
    buildDifficultyBalancedSet(allQuestions, exam, targetCount = 50) {
      const out = [];
      const used = new Set();

      // 난이도별 목표 개수
      const perLevel = Math.floor(targetCount / 3);
      const levels = ['하', '중', '상'];

      levels.forEach((level) => {
        const pool = allQuestions.filter(
          (q) => !used.has(q.id) && (q.difficulty || '중') === level
        );
        const shuffled = this.shuffle(pool);
        shuffled.slice(0, perLevel).forEach((q) => {
          out.push(q);
          used.add(q.id);
        });
      });

      // 부족분 보충 (섞여서)
      while (out.length < targetCount) {
        const remain = allQuestions.filter((q) => !used.has(q.id));
        if (!remain.length) break;
        const q = remain[Math.floor(Math.random() * remain.length)];
        out.push(q);
        used.add(q.id);
      }

      return this.shuffle(out.slice(0, targetCount));
    },

    /* 연습 모드 문제 구성: 오답 + 약점 토픽 + 전체 범위 섞기 */
    buildPracticeSet(examId, allQuestions, exam, wrongIds, targetCount = 20) {
      const out = [];
      const used = new Set();

      // 1단계: 오답 문제들 우선 추가 (최대 targetCount/2)
      const wrongQs = allQuestions.filter((q) => wrongIds.includes(q.id));
      const wrongLimit = Math.ceil(targetCount / 2);
      wrongQs.slice(0, wrongLimit).forEach((q) => {
        out.push(q);
        used.add(q.id);
      });

      // 2단계: 약점 토픽 문제 추가 (다음 targetCount/4)
      if (out.length < targetCount) {
        const weakTopics = this.getWeakTopics(examId, 5).map((w) => w.topic);
        const weakQs = allQuestions.filter(
          (q) =>
            !used.has(q.id) &&
            (q.tags || []).some((t) => weakTopics.includes(t))
        );
        const weakLimit = Math.ceil(targetCount / 4);
        weakQs.slice(0, weakLimit).forEach((q) => {
          out.push(q);
          used.add(q.id);
        });
      }

      // 3단계: 전체 범위에서 나머지 채우기 (섞여서)
      if (out.length < targetCount) {
        const remain = allQuestions.filter((q) => !used.has(q.id));
        const shuffled = this.shuffle(remain);
        const needCount = targetCount - out.length;
        shuffled.slice(0, needCount).forEach((q) => {
          out.push(q);
          used.add(q.id);
        });
      }

      // 최종 섞기
      return this.shuffle(out.slice(0, targetCount));
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

  // 페이지 로드 시 저장된 테마 즉시 적용 (FOUC 최소화)
  try {
    const t = localStorage.getItem('exam_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (_) { /* localStorage 차단 환경 무시 */ }

  // ⚙️ 인라인 onclick에서 호출되는 글로벌 함수 — 모달 실패 시 prompt fallback
  global.openExamSettings = function () {
    try {
      if (!global.ExamHub || typeof global.ExamHub.openSettings !== 'function') {
        throw new Error('ExamHub.openSettings 미로딩');
      }
      global.ExamHub.openSettings();
    } catch (e) {
      console.error('settings modal error:', e);
      // Fallback: prompt 기반 단순 입력
      const current = localStorage.getItem('exam_ai_gen_key') || '';
      const masked = current ? current.slice(0, 7) + '...' + current.slice(-4) : '(없음)';
      const v = prompt(
        '⚙️ Gemini API 키 설정\n\n' +
          '발급: https://aistudio.google.com/app/apikey\n\n' +
          '현재 저장된 키: ' + masked + '\n' +
          '(빈 값으로 두면 삭제 / 취소는 변경 없음)\n\n' +
          '※ 모달 모드 오류로 단순 입력창으로 대체됨: ' + e.message,
        current
      );
      if (v === null) return;
      const trimmed = v.trim();
      if (trimmed) {
        localStorage.setItem('exam_ai_gen_key', trimmed);
        alert('✅ API 키 저장됨');
      } else {
        localStorage.removeItem('exam_ai_gen_key');
        alert('🗑 API 키 삭제됨');
      }
    }
  };

  // ───── 웹/모바일 확대 차단 (핀치·더블탭·트랙패드·Ctrl휠) — 고정 레이아웃 보호 ─────
  (function preventZoom() {
    const stop = (e) => e.preventDefault();
    // 더블탭 줌 차단 (일반 탭/클릭은 정상 동작)
    document.documentElement.style.touchAction = 'manipulation';
    // iOS Safari 핀치 줌 제스처 (viewport user-scalable=no 를 iOS 가 무시하므로 필요)
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
      document.addEventListener(evt, stop, { passive: false });
    });
    // 멀티터치(핀치) 차단 — 한 손가락 스크롤은 영향 없음
    document.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches && e.touches.length > 1) e.preventDefault();
      },
      { passive: false }
    );
    // 데스크탑 Ctrl+휠 / 트랙패드 핀치 줌 차단 (일반 스크롤은 그대로)
    document.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey) e.preventDefault();
      },
      { passive: false }
    );
    // Ctrl/⌘ + +/-/0 키보드 줌 (브라우저가 허용하는 범위 내)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].indexOf(e.key) !== -1) {
        e.preventDefault();
      }
    });
  })();
})(window);
