# prototype/ — 홈 대시보드 시각 프로토타입

설계서 화면0(홈 대시보드, 아이젠하워 5칸)을 **눈으로 보는** 프로토타입입니다.
Manus 등으로 실제 앱을 만들 때 **디자인 참고**로도 씁니다.

## 만들기

```bash
# 공문이 든 폴더로 대시보드 생성 (오늘 날짜 지정 가능)
python prototype/build_prototype.py "공문폴더" 2026-07-01
# → prototype/dashboard.html 생성. 더블클릭하면 브라우저에서 열립니다.
```

- 인터넷·설치 불필요, 100% 로컬(파일 읽어 화면만 만듦).
- `dashboard.html` 은 **실제 공문 데이터가 들어가므로 저장소에 커밋하지 않습니다**(.gitignore).

## 파일

- `build_prototype.py` — 폴더의 공문들을 카드로 만들어 대시보드 HTML 생성
- `sample_output.json` — `python -m src.extract --json` 이 주는 **데이터 계약 예시**(합성 데이터).
  Manus 가 UI 를 만들 때 이 JSON 형태만 알면 됩니다. (`docs/Manus빌드가이드.md` 참고)
