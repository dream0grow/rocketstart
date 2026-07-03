// 파이썬 추출 엔진 실행기.
// 빌드 가이드 §1 대로, Electron 메인이 기존 파이썬 코어(src/)를
//   python -m src.extract "<파일경로>" --json   (AI 포함 시 --ai)
// 로 자식 프로세스로 실행하고, stdout 의 JSON(§2 계약)을 파싱해 돌려줍니다.
// 추출 로직은 절대 다시 만들지 않습니다.
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

// src/ 코어가 있는 저장소 루트 (app/ 의 상위).
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// 사용할 파이썬 실행 파일 (환경변수 GYOMU_PYTHON 으로 덮어쓰기 가능).
// Windows: python.org 설치본은 `python`(과 `py` 런처)만 제공하고 `python3` 는
//   없는 경우가 많습니다. 그래서 Windows 에서는 기본값을 `python` 으로 둡니다.
// macOS/Linux: 관례대로 `python3` 를 씁니다.
function pythonBin() {
  if (process.env.GYOMU_PYTHON) return process.env.GYOMU_PYTHON;
  return process.platform === "win32" ? "python" : "python3";
}

// 파일 1개를 추출 → §2 데이터 계약 JSON 객체 반환.
function extractFile(filePath, withAi = false) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`파일을 찾을 수 없습니다: ${filePath}`));
    }
    const args = ["-m", "src.extract", filePath, "--json"];
    if (withAi) args.push("--ai");

    // cwd 를 저장소 루트로 두어야 `python -m src.extract` 가 동작합니다.
    const proc = spawn(pythonBin(), args, {
      cwd: REPO_ROOT,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString("utf-8")));
    proc.stderr.on("data", (d) => (err += d.toString("utf-8")));
    proc.on("error", (e) => reject(e));
    proc.on("close", (code) => {
      // extract.py 는 실패 시에도(파싱 불가 등) JSON 을 출력하고 exit 1 을 냅니다.
      try {
        const json = JSON.parse(out);
        resolve(json);
      } catch (e) {
        reject(
          new Error(
            `엔진 출력을 해석하지 못했습니다 (code ${code}).\nstderr: ${err}\nstdout: ${out.slice(0, 500)}`
          )
        );
      }
    });
  });
}

module.exports = { extractFile, REPO_ROOT, pythonBin };
