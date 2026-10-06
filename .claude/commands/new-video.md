---
description: Tạo video YouTube mới (Short hoặc Long) từ brief tới bản preview
argument-hint: "[mô tả ngắn: chủ đề, độ dài, phong cách, ngôn ngữ…]"
---

Tạo một video YouTube mới theo **Quy trình chuẩn** trong CLAUDE.md.

Yêu cầu ban đầu của người dùng: $ARGUMENTS

## Bước 1: Brief
- Lấy thông tin từ yêu cầu trên. Còn thiếu trường bắt buộc (`format`, `targetDurationSec`, `language`, `topic`) thì hỏi **một lần**, gộp mọi câu hỏi, kèm gợi ý mặc định. Ví dụ: "Short 45s tiếng Việt, phong cách năng động?"
- Đặt `id` dạng slug ngắn: chữ thường không dấu, nối bằng gạch ngang, có hậu tố ngôn ngữ, ví dụ `ca-phe-viet-vi`. Không trùng thư mục có sẵn trong `projects/`.
- Ghi `projects/<id>/brief.json` (xem mẫu `projects/sample-short-vi/brief.json`).

## Bước 2: Plan ⏸
- Đọc `public/audio-library/catalog.json` để biết nhạc có sẵn.
- Viết `projects/<id>/plan.md`: mục tiêu, hook, bảng cảnh (id, ý chính, thời lượng), phong cách hình ảnh, giọng đọc (tên voice Gemini), nhạc đề xuất (trackId, hoặc tiêu chí tìm trên YouTube Audio Library nếu catalog chưa có bài phù hợp).
- Tóm tắt plan cho người dùng và **dừng chờ duyệt**.

## Bước 3: Script ⏸
- Giao cho agent `script-writer` viết `projects/<id>/spec.json` từ brief và plan, hoặc tự viết nếu video ngắn và đơn giản.
- Hook PostToolUse tự chạy `validate-spec`. Sửa tới khi hết lỗi và cảnh báo.
- Video dài, hoặc hình ảnh cần nhất quán nhân vật: giao agent `visual-director` rà lại `visualPrompt` và `style.visual`.
- Cho người dùng xem bảng `cảnh | lời đọc | onScreenText` cùng tổng thời lượng ước tính, rồi **dừng chờ duyệt**.

## Bước 4: Assets ⏸
- Báo trước: "Sẽ gọi Gemini tạo N đoạn giọng đọc và N ảnh". **Chờ đồng ý.**
- Chạy `npm run voice -- <id>`, sau đó `npm run images -- <id>`.
- Cảnh lỗi (bị chặn safety, rỗng…): sửa `visualPrompt` hoặc `narration`, chạy lại với `--scene=<sceneId>`.
- Chạy lại `npm run validate -- <id>`. Giờ thời lượng đã là thời lượng thật của giọng đọc.

## Bước 5: Preview
- Ghi file props `{"projectId":"<id>"}` vào thư mục tạm, render 2–3 still ở các frame đại diện (`npx remotion still Video out/<id>-check-<n>.png --frame=<n> --props=<file>`), rồi dùng Read xem. Kiểm tra phụ đề có bị che, chữ có tràn, ảnh có hợp nội dung không. Sửa nếu cần.
- Chạy `npx remotion studio` ở chế độ nền, đưa URL cho người dùng, nhắc chọn composition `Video` và đặt prop `projectId` = `<id>`.

## Bước 6: Metadata
- Giao agent `youtube-seo` viết `projects/<id>/youtube-metadata.md`, có ghi công nhạc nếu bắt buộc.

## Kết thúc
Tóm tắt: đường dẫn các file, thời lượng thật, việc còn lại (ví dụ thiếu nhạc nền). Hỏi người dùng có muốn render không. Render bằng `/render-video <id>`.
