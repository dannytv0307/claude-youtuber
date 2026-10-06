// PostToolUse hook: after Claude writes/edits projects/<id>/spec.json,
// run scripts/validate-spec.ts and feed problems back to Claude.
// Exit 2 = blocking feedback (stderr is shown to Claude).
import { spawnSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = input?.tool_input?.file_path ?? "";
const m = filePath.replace(/\\/g, "/").match(/\/projects\/([a-z0-9-]+)\/spec\.json$/);
if (!m) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
// m[1] is restricted to [a-z0-9-] by the regex, safe to put in a shell string
const res = spawnSync(`npx tsx scripts/validate-spec.ts ${m[1]}`, {
  cwd: projectDir,
  encoding: "utf8",
  shell: true,
});
const output = `${res.stdout ?? ""}${res.stderr ?? ""}`.trim();

if (res.status !== 0) {
  console.error(`validate-spec thất bại cho "${m[1]}":\n${output}`);
  process.exit(2);
}
if (output.includes("⚠")) {
  console.error(`validate-spec có cảnh báo cho "${m[1]}" — xem xét sửa:\n${output}`);
  process.exit(2);
}
console.log(output);
