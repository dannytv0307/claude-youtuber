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
- **Dựng câu chuyện trước, chia cảnh sau** (xem "Quy tắc kể chuyện" trong CLAUDE.md). Nghĩ ra 2–3 hướng kể khác nhau, mỗi hướng có câu hỏi lớn, khung truyện và người dẫn chuyện riêng. Chọn hướng hấp dẫn nhất với khán giả trong brief, và ghi các hướng còn lại vào plan để người dùng có thể đổi.
- Viết `projects/<id>/plan.md` theo khung sau:
  ```markdown
  # Kế hoạch: <tiêu đề>
  ## Câu chuyện
  - Câu hỏi lớn: <một câu>
  - Khung truyện: <bí ẩn | hành trình nhân vật | chuỗi nhân quả | vấn đề → giải pháp | đếm ngược leo thang>
  - Người dẫn chuyện: <ai, tính cách, xưng hô, có xuất hiện trong ảnh không>
  - Mạch truyện: <3–5 câu tóm tắt từ đầu tới cuối>
  - Lời hứa ở hook → được trả ở cảnh: <…>
  - Bước ngoặt: <cảnh nào, chuyện gì bất ngờ>
  - Callback ở kết: <chi tiết đầu video quay lại thế nào>
  - Hướng kể khác đã cân nhắc: <1 dòng mỗi hướng>
  ## Bảng cảnh
  | # | id | Vai trò (hook / bối cảnh / leo thang / bước ngoặt / cao trào / kết) | Ý chính | Nối sang cảnh sau | ~s |
  ## Hình ảnh, giọng đọc, nhạc
  <kiểu visual của từng cảnh: ảnh AI, layout (title/big-number/list/timeline/quote/compare) hay custom (mô tả hình sẽ vẽ); phong cách và màu (accentColor, backgroundColor); giọng đọc (preset AI + tên giọng, hoặc "không giọng"); nhạc: trackId, hoặc tiêu chí tìm trên YouTube Audio Library>
  ```
- Cột **Nối sang cảnh sau** phải bắt đầu bằng "nhưng", "vì vậy", "hoá ra", "thế là"… Tự rà cột này trước khi đưa người dùng xem. Ô nào chỉ nối được bằng "và" hay "ngoài ra" thì sửa lại mạch truyện.
- Tóm tắt plan cho người dùng, **bắt đầu bằng câu chuyện** (câu hỏi lớn, người dẫn chuyện, mạch truyện), sau đó mới tới bảng cảnh. Nhắc thêm các hướng kể khác. Rồi **dừng chờ duyệt**.

## Bước 3: Script ⏸
- Giao cho agent `script-writer` viết `projects/<id>/spec.json` từ brief và plan, hoặc tự viết nếu video ngắn và đơn giản.
- Hook PostToolUse tự chạy `validate-spec`. Sửa tới khi hết lỗi và cảnh báo.
- Giao agent `story-editor` rà mạch truyện. Agent này sửa trực tiếp những chỗ nối yếu và báo lại. Đọc báo cáo, và nếu nó đánh giá "chưa đạt" thì sửa tiếp (tự sửa hoặc giao lại `script-writer`) cho tới khi đạt.
- Video dài, hoặc hình ảnh cần nhất quán nhân vật (kể cả người dẫn chuyện xuất hiện trong ảnh): giao agent `visual-director` rà lại `visualPrompt` và `style.visual`.
- Cho người dùng xem: một câu nhắc lại câu hỏi lớn, bảng `cảnh | lời đọc | onScreenText` và tổng thời lượng ước tính. Rồi **dừng chờ duyệt**.

## Bước 4: Assets ⏸
- Xem preset đang dùng trong `ai-providers.json` (hoặc `spec.providers`). Nếu cả ảnh và giọng đều là `none` (**chế độ không dùng AI**, xem CLAUDE.md):
  - Không gọi API, nên không cần dừng hỏi.
  - Viết component cho các cảnh `custom` ở `src/custom/<id>/`, đăng ký trong `src/custom/index.ts`, rồi chạy `npm run typecheck`.
  - Chạy `npm run validate -- <id>`, rồi chuyển sang Bước 5.
- Báo trước: "Sẽ dùng <preset ảnh/giọng trong ai-providers.json> tạo N đoạn giọng đọc và N ảnh", kèm chi phí ước tính nếu là API trả phí. **Chờ đồng ý.**
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
