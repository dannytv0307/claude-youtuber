---
description: Cập nhật catalog nhạc/SFX từ các file tải về YouTube Audio Library
---

1. Chạy `npm run scan-audio`.
2. Mở `public/audio-library/catalog.json`. Với các track mới còn thiếu `genre`, `mood`:
   - Đoán từ tên bài và nghệ sĩ nếu rõ ràng, nhưng **hỏi người dùng xác nhận** các thông tin YouTube hiển thị: Genre, Mood, và "Attribution required" hay không.
   - Track cần ghi công thì đặt `attributionRequired: true` và chép nguyên văn dòng ghi công YouTube cung cấp vào `attributionText`.
3. Ghi lại `catalog.json` (giữ đúng schema `AudioCatalogSchema` trong `src/schema/video-spec.ts`).
4. Tóm tắt catalog: số bài music và sfx, phân theo mood.

Nếu thư mục trống, hướng dẫn người dùng:
- Vào https://studio.youtube.com → **Audio Library**, lọc theo Genre, Mood, Duration, rồi tải về.
- Đặt nhạc nền vào `public/audio-library/music/`, hiệu ứng vào `public/audio-library/sfx/`. Giữ tên file dạng `Tên bài - Nghệ sĩ.mp3`.
- Không bao giờ tự tải nhạc từ YouTube giúp người dùng.
