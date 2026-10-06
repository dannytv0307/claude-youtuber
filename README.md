# youtuber-by-vtv

Tạo video YouTube **Short (9:16)** hoặc **video dài (16:9)** bằng **Claude Code + Remotion**:
- Claude lên kế hoạch, viết kịch bản, dựng video và viết metadata YouTube.
- **Gemini** tạo hình ảnh và giọng đọc.
- Nhạc nền và hiệu ứng âm thanh lấy từ **YouTube Audio Library**.

## Cài đặt
1. `npm install`
2. Copy `.env.example` thành `.env` và chọn một trong hai cách:
   - **Vertex AI** (khuyên dùng, trừ credit GCP): đặt `GOOGLE_GENAI_USE_VERTEXAI=true` và `GOOGLE_CLOUD_PROJECT`, bật `aiplatform.googleapis.com` trên project, rồi chạy `gcloud auth application-default login`.
   - **AI Studio key**: điền `GEMINI_API_KEY` (lấy tại https://aistudio.google.com/apikey). Free tier không có model ảnh; bản trả phí phải nạp prepaid credit.
3. Plugin Remotion cho Claude Code đã được khai báo trong `.claude/settings.json`. Nếu Claude Code chưa tự cài, chạy:
   ```
   claude plugin marketplace add remotion-dev/claude-code-plugin
   claude plugin install remotion@remotion
   ```

## Nhạc từ YouTube Audio Library
YouTube Audio Library không có API, nên bạn phải tải nhạc thủ công:
1. Vào https://studio.youtube.com, chọn **Audio Library**, lọc theo Genre, Mood, Duration rồi tải về.
2. Đặt nhạc nền vào `public/audio-library/music/`, hiệu ứng vào `public/audio-library/sfx/`. Giữ tên file dạng `Tên bài - Nghệ sĩ.mp3`.
3. Trong Claude Code, chạy `/scan-audio`. Claude sẽ cập nhật `catalog.json` và hỏi bạn về mood và yêu cầu ghi công của từng bài.

## Dùng với Claude Code
| Lệnh | Việc |
|---|---|
| `/new-video Short 45s tiếng Việt về lịch sử áo dài, phong cách hoài cổ` | Đi từ brief, plan, kịch bản, tạo ảnh và giọng, tới preview. Có các điểm dừng để bạn duyệt |
| `/revise-video <id> đổi giọng nam trầm, cảnh 3 dùng ảnh ban đêm` | Sửa video, chỉ tạo lại phần thay đổi |
| `/render-video <id>` | Render ra `out/<id>.mp4` |
| `/scan-audio` | Cập nhật catalog nhạc |

Các agent phụ trong `.claude/agents/`:
- `script-writer`: viết kịch bản
- `visual-director`: chỉnh prompt ảnh
- `youtube-seo`: viết metadata

## Chạy tay
```bash
npm run validate -- <id>     # kiểm tra spec, ước tính thời lượng
npm run voice -- <id>        # Gemini TTS → public/projects/<id>/voice/
npm run images -- <id>       # Gemini Image → public/projects/<id>/images/
npm run studio               # preview, chọn composition "Video", đặt projectId
npm run render -- <id>       # → out/<id>.mp4
```
Thêm `--scene=<sceneId>` để chỉ tạo lại một cảnh, hoặc `--force` để tạo lại tất cả.

## Cấu trúc
```
projects/<id>/         brief.json, plan.md, spec.json, youtube-metadata.md (file soạn thảo, đưa vào git)
public/projects/<id>/  images/, voice/, render.json (sinh tự động, gitignore)
public/audio-library/  music/, sfx/, catalog.json
src/                   Remotion: Root.tsx, VideoFromSpec.tsx, components/, schema/video-spec.ts
scripts/               gen-voice, gen-images, validate-spec, scan-audio-library, render
.claude/               settings.json (quyền, hook validate, plugin), commands/, agents/, hooks/
CLAUDE.md              system prompt của dự án
```

Ví dụ có sẵn: `projects/sample-short-vi` (Short 30 giây, tiếng Việt). Bạn có thể xem preview ngay cả khi chưa có ảnh và giọng, vì dự án dùng placeholder.

Lưu ý giấy phép: Remotion miễn phí cho cá nhân và nhóm ≤ 3 người, xem https://remotion.pro/license.
