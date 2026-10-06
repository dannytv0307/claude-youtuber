# youtuber-by-vtv

Tạo video YouTube **Short (9:16)** hoặc **video dài (16:9)** bằng **Claude Code + Remotion**:
- Claude lên kế hoạch, viết kịch bản, dựng video và viết metadata YouTube.
- **Gemini** tạo hình ảnh và giọng đọc. Có thể đổi sang AI khác, kể cả AI chạy local, xem mục [Dùng AI khác](#dùng-ai-khác-kể-cả-ai-chạy-local).
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
- `story-editor`: rà mạch truyện, nối các cảnh thành một câu chuyện
- `visual-director`: chỉnh prompt ảnh
- `youtube-seo`: viết metadata

## Chạy tay
```bash
npm run validate -- <id>     # kiểm tra spec, ước tính thời lượng
npm run voice -- <id>        # Gemini TTS → public/projects/<id>/voice/
npm run images -- <id>       # Gemini Image → public/projects/<id>/images/
npm run studio               # preview, chọn composition "Video", đặt projectId (và playbackRate nếu muốn)
npm run render -- <id>       # → out/<id>.mp4
npm run render -- <id> --playback-rate=1.25   # giọng nhanh hơn 25%, video tự ngắn lại
```
Thêm `--scene=<sceneId>` để chỉ tạo lại một cảnh, hoặc `--force` để tạo lại tất cả.

## Dùng AI khác (kể cả AI chạy local)
Mặc định ảnh và giọng đọc dùng Gemini. File `ai-providers.json` khai báo các **preset** cho từng loại (`image`, `voice`). Mỗi lần chạy sẽ dùng preset theo thứ tự ưu tiên sau:

1. Cờ dòng lệnh: `npm run images -- <id> --provider=sd-webui`
2. Trường `providers` trong `spec.json` của video: `"providers": { "image": "comfyui", "voice": "piper" }`
3. Giá trị `default` trong `ai-providers.json`

| `type` | Ảnh | Giọng | Dùng cho |
|---|---|---|---|
| `gemini` | ✓ | ✓ | Gemini qua Vertex AI hoặc AI Studio, theo `.env` như trước |
| `openai` | ✓ | ✓ | OpenAI (`gpt-image-1`, `gpt-4o-mini-tts`) **hoặc bất kỳ server tương thích OpenAI**: LocalAI, Kokoro-FastAPI, openedai-speech… Đổi `baseUrl` sang server của bạn |
| `a1111` | ✓ | | Stable Diffusion WebUI (AUTOMATIC1111, Forge, SD.Next) chạy với `--api` |
| `comfyui` | ✓ | | ComfyUI. Workflow xuất bằng *Save (API format)*, có các placeholder `{{prompt}}`, `{{width}}`, `{{height}}`, `{{seed}}`. Mẫu SDXL: `ai-workflows/comfyui-sdxl.json` |
| `elevenlabs` | | ✓ | ElevenLabs, cần `voiceId` |
| `command` | ✓ | ✓ | **Mọi công cụ khác**: một lệnh shell bất kỳ, ví dụ Piper, script Python, `curl` tới API riêng |

**Preset `command`:** dự án thay placeholder vào lệnh rồi chạy. Lệnh phải ghi kết quả ra file `{{out}}`.
- Ảnh: `{{prompt_file}}` (file chứa prompt), `{{width}}`, `{{height}}`, `{{aspect}}`
- Giọng: `{{text_file}}` (file chứa lời đọc), `{{voice}}`, `{{language}}`
- Mỗi placeholder cũng có dạng biến môi trường, ví dụ `YT_OUT`, `YT_TEXT_FILE`. Đặt `outputExt` nếu công cụ ghi ra định dạng khác (`mp3`, `jpg`…).

**Định dạng đầu ra:** bạn không cần lo. Ảnh JPEG được đổi sang PNG. Audio MP3, OGG hay WAV float được đổi sang WAV 16-bit bằng ffmpeg có sẵn trong Remotion.

**API key:** để trong `.env`. Preset chỉ ghi *tên biến*: `apiKeyEnv`, mặc định `OPENAI_API_KEY` hoặc `ELEVENLABS_API_KEY`. Server local không cần key.

**Lưu ý:**
- Với provider khác Gemini, tên giọng lấy từ `voice` của preset. Nếu preset không có, dự án dùng `spec.voice.name`, vốn là tên giọng Gemini.
- Không nên đổi provider ảnh giữa chừng một video, vì phong cách ảnh sẽ lệch nhau.

## Không dùng AI (0 đồng)
Preset có sẵn `none` sẽ bỏ qua bước tạo ảnh và tạo giọng. Đây là **mặc định hiện tại** trong `ai-providers.json`. Ở chế độ này Claude dựng toàn bộ video bằng code:
- Mỗi cảnh trong `spec.json` có trường `visual`:
  - Một trong các layout có sẵn ở `src/layouts/`: `title`, `big-number`, `list`, `timeline`, `quote`, `compare`.
  - Hoặc `custom`: một component React/SVG do Claude viết ở `src/custom/<id>/` và đăng ký trong `src/custom/index.ts`. Mẫu: `src/custom/example/Sunrise.tsx`.
- Không có giọng đọc. Lời đọc hiện thành phụ đề, và nhạc nền là âm thanh duy nhất. Muốn chậm lại cho người xem kịp đọc thì đặt `playbackRate` khoảng 0.8–0.9.
- Khi có API trở lại, đổi `default` thành `gemini` (hoặc preset khác) rồi chạy `npm run voice -- <id>`. Thời lượng sẽ tự khớp với giọng thật. Các cảnh `image` cũng dùng được trở lại.

Ví dụ một cảnh:
```json
{ "id": "so-lieu", "narration": "Đại Kim tự tháp cao gần một trăm năm mươi mét.",
  "visual": { "type": "big-number", "value": 146.6, "decimals": 1, "suffix": " m", "label": "Chiều cao ban đầu" } }
```

## Cấu trúc
```
projects/<id>/         brief.json, plan.md, spec.json, youtube-metadata.md (file soạn thảo, đưa vào git)
public/projects/<id>/  images/, voice/, render.json (sinh tự động, gitignore)
public/audio-library/  music/, sfx/, catalog.json
src/                   Remotion: Root.tsx, VideoFromSpec.tsx, components/, schema/video-spec.ts
scripts/               gen-voice, gen-images, validate-spec, scan-audio-library, render
                       lib/image-providers.ts, lib/voice-providers.ts: các backend AI
ai-providers.json      preset AI tạo ảnh và giọng (không chứa key)
ai-workflows/          workflow mẫu cho ComfyUI
.claude/               settings.json (quyền, hook validate, plugin), commands/, agents/, hooks/
CLAUDE.md              system prompt của dự án
```

Ví dụ có sẵn: `projects/sample-short-vi` (Short 30 giây, tiếng Việt). Bạn có thể xem preview ngay cả khi chưa có ảnh và giọng, vì dự án dùng placeholder.

Lưu ý giấy phép: Remotion miễn phí cho cá nhân và nhóm ≤ 3 người, xem https://remotion.pro/license.
