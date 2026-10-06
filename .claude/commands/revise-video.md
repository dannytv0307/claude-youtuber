---
description: Sửa một video đã có (lời đọc, hình, nhạc, thời lượng…) và chỉ tạo lại phần thay đổi
argument-hint: "<id> <yêu cầu sửa>"
---

Yêu cầu: $ARGUMENTS

1. Đọc `projects/<id>/spec.json` và `plan.md` để nắm hiện trạng.
2. Sửa `spec.json` theo yêu cầu. Hook sẽ tự validate. Nếu sửa lời đọc, thêm, bớt hoặc đổi thứ tự cảnh, phải giữ mạch truyện (xem "Quy tắc kể chuyện" trong CLAUDE.md): kiểm tra lại câu nối với cảnh trước và cảnh sau. Thay đổi lớn thì giao agent `story-editor` rà lại.
3. Xác định cảnh nào cần tạo lại:
   - `narration` hoặc `voice` đổi → tạo lại giọng: `npm run voice -- <id> --scene=<sceneId>`. Đổi voice cho toàn bộ video thì dùng `--force`.
   - `visualPrompt` hoặc `style.visual` đổi → tạo lại ảnh: `npm run images -- <id> --scene=<sceneId>`, hoặc `--force` nếu đổi style chung.
   - `musicPrompt` đổi → tạo lại nhạc AI: `npm run music -- <id> --force`.
   - Chỉ đổi `onScreenText`, `transition`, `music`, `captionStyle` → không cần gọi API, chạy `npm run validate -- <id>` là đủ.
4. Trước khi gọi API, báo số cảnh sẽ tạo lại và chờ đồng ý.
5. Render một still kiểm tra phần đã sửa. Nhắc người dùng refresh Studio.
