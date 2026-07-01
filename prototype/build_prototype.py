"""
교무부장 도우미 — 시각 프로토타입 생성기 (MVP-5 홈 대시보드 미리보기)

무엇을 하나:
    공문 폴더 하나를 훑어(MVP-1~4 규칙 추출) → 홈 대시보드 + 교무수첩을
    담은 '단일 HTML 파일' 하나를 만듭니다. 더블클릭하면 브라우저에서 열립니다.
    (인터넷·설치 불필요. 100% 로컬. Manus 로 실제 앱을 만들 때 '설계 참고'로도 씀)

사용:
    python prototype/build_prototype.py "공문폴더"            # 그 폴더의 공문들로
    python prototype/build_prototype.py "공문폴더" 2026-07-01  # 오늘 날짜 지정

설계서 근거:
    화면0 홈(아이젠하워 5칸) + 화면2 교무수첩 + 공문 4성격 자동 배치.
"""

import glob
import html
import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.extract import extract_file
from src.extractor import parse_filename, build_notebook_entry

SUPPORTED = (".pdf", ".hwp", ".hwpx", ".odt", ".xlsx", ".xls")


def build_cards(folder: str, today: date):
    """폴더의 공문들을 카드 데이터로 만듭니다. 파일명은 실제 이름 그대로 사용."""
    cards = []
    for path in sorted(glob.glob(os.path.join(folder, "*"))):
        if not path.lower().endswith(SUPPORTED):
            continue
        result = extract_file(path)
        # 실제 파일명으로 파일명정보 파싱 (제목·발신기관 정확)
        fn = parse_filename(os.path.basename(path)).to_dict()
        entry = build_notebook_entry(
            fn, result.deadline_info, result.extension, result.ok, result.message,
            today=today,
        )
        card = entry.to_dict()
        card["quadrant"] = _eisenhower(card)
        cards.append(card)
    return cards


def _eisenhower(card: dict) -> str:
    """공문 4성격·마감·발신을 아이젠하워 5칸 중 하나로 배치 (설계서 힌트)."""
    category = card.get("category")
    # 할일형이 아니면 대시보드(할 일) 밖 — 자료실/배포함/보관
    if category != "할일형":
        return "기타"

    d = card.get("d_day")
    urgent = d is not None and d <= 3          # 3일 이내(또는 지남) = 급함
    important = (card.get("sender_level") == "상급기관"
                or card.get("task_type") in ("연수/교육", "행사/사업", "보고/제출"))

    if urgent and important:
        return "급함+중요"
    if not urgent and important:
        return "안급하지만 중요"   # 🔴 가장 먼저! (설계 철학)
    if urgent and not important:
        return "급함(덜중요)"
    return "해야할일"


# 아이젠하워 칸 정의 (색·설명·순서)
QUADRANTS = [
    ("안급하지만 중요", "🔴", "★가장 먼저! (기획·계획)"),
    ("급함+중요", "🟡", "지금 처리"),
    ("급함(덜중요)", "🟠", "빨리 처리"),
    ("해야할일", "🟢", "틈날 때"),
    ("기타", "⚪", "자료실·배포함·보관"),
]


def render_html(cards, today: date) -> str:
    """카드 목록으로 단일 HTML 대시보드를 만듭니다."""
    today_iso = today.isoformat()
    data_json = json.dumps(cards, ensure_ascii=False)

    # 요약 통계
    tasks = [c for c in cards if c["category"] == "할일형"]
    overdue = sum(1 for c in tasks if (c.get("d_day") is not None and c["d_day"] < 0))
    this_week = sum(1 for c in tasks if (c.get("d_day") is not None and 0 <= c["d_day"] <= 7))

    return _TEMPLATE.format(
        today=today_iso,
        total=len(cards),
        task_n=len(tasks),
        week_n=this_week,
        overdue_n=overdue,
        data=data_json,
    )


# ── HTML 템플릿 (인라인 CSS/JS — 오프라인 더블클릭으로 열림) ──────────────
_TEMPLATE = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>교무부장 도우미 — 홈 대시보드 (프로토타입)</title>
<style>
:root{{--red:#e74c3c;--yellow:#f1c40f;--orange:#e67e22;--green:#27ae60;--gray:#95a5a6;}}
*{{box-sizing:border-box;margin:0;padding:0;}}
body{{font-family:'Malgun Gothic','맑은 고딕',sans-serif;background:#f4f6f8;color:#2c3e50;}}
.top{{background:#34495e;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;}}
.top .lock{{background:#27ae60;padding:4px 10px;border-radius:12px;font-size:13px;}}
.layout{{display:flex;min-height:calc(100vh - 48px);}}
.side{{width:170px;background:#2c3e50;color:#ecf0f1;padding:16px 0;flex-shrink:0;}}
.side a{{display:block;padding:10px 20px;color:#ecf0f1;text-decoration:none;font-size:15px;}}
.side a.active{{background:#3d566e;border-left:3px solid #1abc9c;font-weight:bold;}}
.side .sep{{border-top:1px solid #465c70;margin:10px 0;}}
.main{{flex:1;padding:20px;}}
.strip{{background:#fff;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;gap:24px;box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:15px;}}
.strip b{{font-size:20px;}}
.strip .over{{color:var(--red);}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:14px;}}
.q{{background:#fff;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);min-height:120px;}}
.q.full{{grid-column:1 / span 2;}}
.q h3{{font-size:15px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #eee;}}
.q .desc{{font-size:12px;color:#7f8c8d;font-weight:normal;}}
.card{{border:1px solid #e0e0e0;border-radius:8px;padding:9px 11px;margin-bottom:8px;cursor:pointer;transition:.15s;background:#fdfdfd;}}
.card:hover{{box-shadow:0 2px 8px rgba(0,0,0,.12);transform:translateY(-1px);}}
.card .t{{font-size:13.5px;font-weight:bold;line-height:1.35;margin-bottom:5px;}}
.card .m{{font-size:11.5px;color:#7f8c8d;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}}
.badge{{padding:1px 7px;border-radius:10px;color:#fff;font-size:11px;font-weight:bold;}}
.dday{{background:#c0392b;}} .dday.soon{{background:#e67e22;}} .dday.ok{{background:#16a085;}} .dday.over{{background:#7f8c8d;}}
.tag{{background:#ecf0f1;color:#34495e;padding:1px 6px;border-radius:8px;font-size:11px;}}
.left-red h3{{color:var(--red);}} .left-yellow h3{{color:#c9a400;}}
.left-orange h3{{color:var(--orange);}} .left-green h3{{color:var(--green);}} .left-gray h3{{color:var(--gray);}}
#detail{{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;}}
#detail .box{{background:#fff;border-radius:12px;padding:22px;max-width:560px;width:90%;max-height:80vh;overflow:auto;}}
#detail h2{{font-size:17px;margin-bottom:12px;}}
#detail .row{{margin:7px 0;font-size:14px;}} #detail .k{{color:#7f8c8d;display:inline-block;width:90px;}}
#detail .close{{margin-top:16px;background:#34495e;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;}}
.note{{font-size:12px;color:#95a5a6;margin-top:14px;}}
</style></head>
<body>
<div class="top"><div><b>📒 교무부장 도우미</b> <span style="opacity:.7;font-size:13px;">홈 대시보드 (프로토타입)</span></div>
<div><span class="lock">🔒 로컬 작동중 · 오늘 {today}</span></div></div>
<div class="layout">
<div class="side">
<a class="active">🏠 홈</a><a>📥 들어온 공문</a><a>📒 교무수첩</a><a>✍ 공문 작성</a>
<a>📝 회의록</a><a>📤 배포·수합</a><div class="sep"></div><a>📚 과거 공문</a><a>⚙ 설정</a>
</div>
<div class="main">
<div class="strip">
<div>전체 공문 <b>{total}</b>건</div>
<div>할 일 <b>{task_n}</b>건</div>
<div>이번 주 마감 <b>{week_n}</b>건</div>
<div class="over">지난 마감 <b>{overdue_n}</b>건 ⚠</div>
</div>
<div class="grid" id="grid"></div>
<div class="note">※ 규칙으로 자동 배치했습니다. 카드를 드래그해 옮기거나(실제 앱에서) 클릭해 상세를 봅니다.
마감일·발신기관은 규칙 추출(정확), 성격·배치는 자동 초안이라 부장이 조정합니다.</div>
</div></div>
<div id="detail" onclick="if(event.target.id==='detail')this.style.display='none'"><div class="box" id="detailBox"></div></div>
<script>
const CARDS = {data};
const QUADS = [
  ["안급하지만 중요","🔴","★가장 먼저! (기획·계획)","left-red"],
  ["급함+중요","🟡","지금 처리","left-yellow"],
  ["급함(덜중요)","🟠","빨리 처리","left-orange"],
  ["해야할일","🟢","틈날 때","left-green"],
  ["기타","⚪","자료실·배포함·보관 (마감 없는 참고/규정/배포)","left-gray"],
];
function ddayBadge(c){{
  if(c.d_day===null||c.d_day===undefined) return '';
  let cls='ok',txt=c.d_day_text;
  if(c.d_day<0)cls='over'; else if(c.d_day<=3)cls='dday soon'; else if(c.d_day<=7)cls='dday soon';
  if(c.d_day<0)cls='dday over';
  return `<span class="badge dday ${{cls}}">${{txt}}</span>`;
}}
function cardHtml(c,i){{
  return `<div class="card" onclick="showDetail(${{i}})">
    <div class="t">${{esc(c.title||'(제목 없음)')}}</div>
    <div class="m">${{ddayBadge(c)}}<span class="tag">${{c.category}}</span>
    <span class="tag">${{c.task_type}}</span><span>${{esc(c.sender||'')}}</span></div></div>`;
}}
function esc(s){{return (s||'').replace(/[&<>]/g,x=>({{'&':'&amp;','<':'&lt;','>':'&gt;'}}[x]));}}
function render(){{
  const grid=document.getElementById('grid');
  QUADS.forEach((q,qi)=>{{
    const items=CARDS.map((c,i)=>[c,i]).filter(([c])=>c.quadrant===q[0]);
    const full = q[0]==='기타' ? 'full' : '';
    const inner = items.length? items.map(([c,i])=>cardHtml(c,i)).join('')
                              : '<div style="color:#bbb;font-size:12px;">(없음)</div>';
    grid.innerHTML += `<div class="q ${{full}} ${{q[3]}}"><h3>${{q[1]}} ${{q[0]}}
      <span class="desc">${{q[2]}} · ${{items.length}}건</span></h3>${{inner}}</div>`;
  }});
}}
function showDetail(i){{
  const c=CARDS[i];
  let dl = c.deadline_iso? `[${{c.deadline_label}}] ${{c.deadline_raw}} <b>${{c.d_day_text}}</b>` : '없음 (기한 없는 공문)';
  let others = (c.other_deadlines||[]).map(o=>`[${{o.label}}] ${{o.raw}}`).join(', ');
  document.getElementById('detailBox').innerHTML = `<h2>${{esc(c.title||'')}}</h2>
    <div class="row"><span class="k">발신기관</span>${{esc(c.sender||'')}} (${{c.sender_level}})</div>
    <div class="row"><span class="k">문서번호</span>${{esc(c.doc_number||'')}}</div>
    <div class="row"><span class="k">공문 성격</span>▣ ${{c.category}} → ${{c.placement}}</div>
    <div class="row"><span class="k">업무 유형</span>${{c.task_type}}</div>
    <div class="row"><span class="k">마감일</span>${{dl}}</div>
    ${{others?`<div class="row"><span class="k">다른 기한</span>${{others}}</div>`:''}}
    <div class="row" style="color:#95a5a6;font-size:12.5px;margin-top:10px;">
      ※ 한 줄 요약·세부 할 일은 로컬 AI(Ollama)가 제안하는 부분입니다 (MVP-4).</div>
    <button class="close" onclick="document.getElementById('detail').style.display='none'">닫기</button>`;
  document.getElementById('detail').style.display='flex';
}}
render();
</script></body></html>"""


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else "."
    if len(sys.argv) > 2:
        y, m, d = (int(x) for x in sys.argv[2].split("-"))
        today = date(y, m, d)
    else:
        today = date.today()

    cards = build_cards(folder, today)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboard.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(render_html(cards, today))
    print(f"공문 {len(cards)}건으로 대시보드 생성 완료:\n  {out}")
    print("→ 이 파일을 더블클릭하면 브라우저에서 홈 대시보드가 열립니다.")


if __name__ == "__main__":
    main()
