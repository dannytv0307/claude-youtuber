---
description: Render video của một project ra out/<id>.mp4
argument-hint: "<id>"
---

Render project `$ARGUMENTS`:

1. Không có id thì liệt kê các thư mục trong `projects/` và hỏi người dùng.
2. Chạy `npm run validate -- <id>`. Nếu còn cảnh thiếu ảnh hoặc giọng, báo người dùng và hỏi có muốn tạo trước không (xem `/new-video` bước 4).
3. Chạy `npm run render -- <id>` ở chế độ nền (có thể mất vài phút). Theo dõi tới khi xong.
4. Kiểm tra `out/<id>.mp4` đã tồn tại. Báo dung lượng và thời lượng, kèm đường dẫn `youtube-metadata.md` để người dùng upload.
5. Nhắc người dùng: nếu dùng nhạc có `attributionRequired`, phải dán dòng ghi công vào mô tả khi upload.
