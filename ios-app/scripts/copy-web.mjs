// copy-web.mjs — 웹 코드를 앱 상자(www 폴더)에 담는 스크립트
//
// 왜 필요한가요?
//   아이폰 앱은 인터넷의 파일이 아니라 '앱 안에 들어 있는 파일'을 실행합니다.
//   그래서 상위 폴더의 study/(웹앱 원본)를 이 프로젝트의 www/ 폴더로 복사해 두고,
//   Capacitor가 www/를 통째로 앱 속에 넣습니다.
//
// 언제 실행하나요?
//   study/ 코드를 고칠 때마다 `npm run sync` 한 번이면 됩니다.
//   (sync = 이 복사 스크립트 + 앱 프로젝트에 반영, package.json 참고)

import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// 이 스크립트 파일의 위치를 기준으로 경로를 계산합니다.
// (어느 폴더에서 실행해도 항상 올바른 위치를 가리키게 하기 위해서예요.)
const here = path.dirname(fileURLToPath(import.meta.url)); // ios-app/scripts
const src = path.join(here, "..", "..", "study");          // 저장소의 study/ (원본)
const dest = path.join(here, "..", "www");                 // ios-app/www (복사본)

// 1) 예전 복사본을 통째로 지웁니다. (지운 파일이 남아있지 않게 '깨끗이 새로'가 원칙)
rmSync(dest, { recursive: true, force: true });

// 2) study/ 전체를 www/로 복사합니다.
cpSync(src, dest, { recursive: true });

console.log("✅ 복사 완료: study/ → ios-app/www/");
console.log("   다음 단계: npx cap sync ios (또는 npm run sync 하나로 둘 다 실행)");
