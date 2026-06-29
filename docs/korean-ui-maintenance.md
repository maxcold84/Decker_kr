# Korean UI Maintenance Notes

이 문서는 Decker 한국어 UI 작업을 다시 빌드하거나 수정할 때 같은 실패를 반복하지 않기 위한 운영 메모다.

## Source Of Truth

- 고정 앱 UI 문자열: `resources/ko-ui/strings.json`
- 문자열 검증 규칙: `resources/ko-ui/strings.schema.json`, `tests/ko_ui_inventory.mjs`, `tests/ko_ui_scope_guard.mjs`
- 생성기: `scripts/build_ko_ui_assets.mjs`
- 생성 산출물:
  - `js/ko-ui-strings.js`
  - `js/ko-ui-font.js`
  - `c/ko_ui_strings.h`
  - `c/ko_ui_font.h`

`js/ko-ui-*.js`와 `c/ko_ui_*.h`를 직접 고치지 말고, `resources/ko-ui/strings.json` 또는 생성기를 고친 뒤 아래를 실행한다.

```powershell
node scripts\build_ko_ui_assets.mjs
node scripts\build_ko_ui_assets.mjs --check
```

## Windows Native Build

이 저장소의 native Windows 빌드는 MSYS2 MinGW64 경로가 기준이다. Visual Studio `cl.exe`만으로는 현재 Makefile의 native SDL2 빌드를 완료할 수 없다.

필요한 패키지:

```powershell
C:\tools\msys64\usr\bin\pacman.exe -Sy --noconfirm make mingw-w64-x86_64-gcc mingw-w64-x86_64-SDL2 mingw-w64-x86_64-SDL2_image
```

실행할 때는 bare `bash`를 쓰지 않는다. Windows에서 bare `bash`는 WSL로 연결될 수 있어 경로와 도구가 엉킨다. 이 환경에서는 다음처럼 절대 경로를 사용한다.

```powershell
C:\tools\msys64\usr\bin\bash.exe --noprofile --norc .omo\evidence\decker-ko-ui\native\build-native-msys2.sh
```

성공한 native 빌드는 `c/build/decker.exe`를 만든다. 검증 로그의 기준 예시는 `.omo/evidence/decker-ko-ui/native/task-11-native-build-msys2-fixed.txt`다.

## `c/resources.h` Generation

`scripts/resources.sh`는 native binary에 포함할 web Decker HTML/JS 리소스를 `xxd -i`로 `c/resources.h`에 묶는다. 리소스 순서는 중요하다.

현재 필수 순서:

1. `js/lil.js`
2. `js/danger.js`
3. `js/ko-ui-strings.js`
4. `js/ko-ui-font.js`
5. `js/decker.html`
6. `js/decker.js`
7. `examples/decks/tour.deck`

주의: MSYS2에서 Git-for-Windows `xxd.exe`가 잡히는 경우, 여러 줄의 `xxd ... >> c/resources.h` append 방식은 파일 앞부분을 덮어써서 `c/resources.h`를 망가뜨릴 수 있다. 실제 실패에서는 헤더가 `examples_decks_tour_deck[]`로 시작했고 `js_lil_js`, `js_danger_js`, `js_ko_ui_strings_js`, `js_ko_ui_font_js`, `js_decker_html` 심볼이 빠져 native compile이 실패했다.

따라서 `scripts/resources.sh`는 반드시 하나의 grouped redirection으로 유지한다.

```sh
{
	printf "%s\n" "// auto-generated from web-decker source!"
	xxd -i js/lil.js
	xxd -i js/danger.js
	xxd -i js/ko-ui-strings.js
	xxd -i js/ko-ui-font.js
	xxd -i js/decker.html
	xxd -i js/decker.js
	xxd -i "$DECK"
} > "$DST"
```

반복 append 형태로 되돌리지 않는다.

```sh
# Do not do this on Windows/MSYS2.
xxd -i js/lil.js > "$DST"
xxd -i js/danger.js >> "$DST"
```

리소스 헤더를 바꾼 뒤에는 최소한 아래 심볼을 확인한다.

```powershell
Select-String -Path c\resources.h -Pattern 'unsigned char js_lil_js|unsigned char js_danger_js|unsigned char js_ko_ui_strings_js|unsigned char js_ko_ui_font_js|unsigned char js_decker_html|unsigned char js_decker_js|unsigned char examples_decks_tour_deck'
```

## Native Visual QA Meaning

`tests/ko_ui_native_visual.mjs`는 현재 Windows에서 native GUI를 실제로 클릭하고 screenshot을 찍는 자동화가 아니다. 다음을 검증하는 preflight다.

- native binary 존재 여부
- MSYS2/Visual Studio 도구 탐지
- SDL2 도구 탐지
- blocker 여부를 `report.json`에 명확히 기록

`report.json`의 `ok: true`는 native build/preflight가 통과했다는 뜻이다. `screenshots: []`이면 native GUI screenshot evidence는 없는 것이다. 최종 완료에서 이것을 실제 screenshot QA로 쓰려면 안 된다. 이 gap은 사용자가 명시적으로 수락했을 때만 최종 완료 근거가 될 수 있다.

확인:

```powershell
node tests\ko_ui_native_visual.mjs c\build\decker.exe .omo\evidence\decker-ko-ui\native
Get-Content .omo\evidence\decker-ko-ui\native\report.json
```

## Final Regression Checklist

한국어 UI 관련 변경 뒤에는 아래를 한 번에 확인한다.

```powershell
powershell -ExecutionPolicy Bypass -File .omo\evidence\decker-ko-ui\task-12-final-checks.ps1
```

이 스크립트는 다음을 포함해야 한다.

- generated assets freshness
- asset contract
- inventory coverage/parity
- scope guard
- build integration
- web/native text path checks
- native visual preflight
- native binary 존재 확인
- `c/resources.h` 필수 심볼 확인

## Scope Guardrails

- `Readme.md`와 `Readme.ko.md`는 기존 dirty/untracked 상태가 있을 수 있으므로, 사용자 요청 없이 정리하거나 되돌리지 않는다.
- Kakao CDN signed URL은 provenance에만 남긴다. build path에 넣지 않는다.
- `fixed-ui-label`과 `fixed-ui-format`만 한국어로 번역한다.
- `internal-token`, `dynamic-user-content`, script/API token, deck/user content는 번역하지 않는다.
- Hangul UI label을 DeckRoman `drom_to_ord`, `draw_text`, `font_textsize`, native `font_g*` byte path로 보내지 않는다. UI-only atlas path를 사용한다.
