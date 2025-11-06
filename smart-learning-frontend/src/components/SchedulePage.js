import React, { useEffect, useState } from "react";
import axios from "axios";
import "./SchedulePage.css"; // Đảm bảo file SchedulePage.css tồn tại (từ các bước trước)
import CourseCard from "./CourseCard"; // Tái sử dụng component Card
import CourseModal from "./CourseModal"; // Tái sử dụng component Modal (đã được nâng cấp)

// Trang này sẽ là trang "Các môn đang học"
export default function SchedulePage({ studentId, studentName }) {
  const [courses, setCourses] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    // 1. GỌI API ĐÚNG
    // API này (trong app.py) đã được thiết kế để trả về dữ liệu môn học hiện tại
    axios
      .get(`https://smart-learning-system.onrender.com/api/current-schedule/${studentId}`)
      .then((res) => {
        // 2. ÁP DỤNG LOGIC SỬA LỖI UNICODE TIẾNG VIỆT
        const fixedData = JSON.parse(
          JSON.stringify(res.data).replace(/\\u[\dA-F]{4}/gi, (m) =>
            String.fromCharCode(parseInt(m.replace(/\\u/g, ""), 16))
          )
        );

        // API trả về 1 danh sách các môn học
        // (đã được xử lý bởi recommender.py)
        setCourses(fixedData || []);
        
        if (fixedData.length > 0) {
           setMessage(`Hệ thống tìm thấy ${fixedData.length} môn học bạn đang theo học.`);
        } else {
           setMessage("Không tìm thấy môn học nào trong học kỳ hiện tại.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Lỗi khi gọi API /api/current-schedule/: ", err);
        setMessage("⚠️ Không thể tải dữ liệu các môn đang học.");
        setLoading(false);
      });
  }, [studentId]);

  if (loading) {
      return (
        <div className="recommend-wrapper fade-in">
            <h2>Đang tải danh sách môn học...</h2>
        </div>
      )
  }

  return (
    // 3. TÁI SỬ DỤNG GIAO DIỆN CỦA TRANG "GỢI Ý"
    // (Dùng className="recommend-wrapper" để đồng bộ CSS)
    <div className="recommend-wrapper fade-in">
      <h2>🗓️ Các môn đang học (Học kỳ này)</h2>
      <p className="student-intro">
        Xin chào <b>{studentName}</b> 👋 – đây là các môn học của bạn:
      </p>
      <p className="recommend-msg">{message}</p>

      {courses.length > 0 ? (
        <div className="recommend-grid">
          {courses.map((course, index) => {
            
            // Dữ liệu từ API (app.py -> recommender.py)
            // có dạng { course: "Tên môn", progress: 80, subjectCode: "CSE123", teacherName: "Giảng viên A" }
            
            // Tạo 'lessons' giả lập để truyền vào Modal (vì Modal cần)
            // Anh (Backend Lead) có thể nâng cấp API để trả về 'lessons' thật
             const mockLessons = [
                { title: "Bài tập", note: "Danh sách bài tập (PDF/DOCX)", document: "#" },
                { title: "Quiz", note: "Danh sách link Quiz (Google Form/Kahoot)", video: "#" },
                { title: "Cố vấn AI", note: "Chat với AI về môn học này", ai: true }
             ];

            return (
              <CourseCard
                key={index}
                course={{
                  title: course.course,
                  progress: course.progress,
                  // Thêm thông tin Giảng viên/Mã môn để CourseCard (nếu được nâng cấp) có thể hiển thị
                  lecturer: course.teacherName || "N/A", 
                  code: course.subjectCode || "N/A",
                  lessons: mockLessons // Truyền dữ liệu giả lập
                }}
                onSelect={setSelectedCourse}
              />
            );
          })}
        </div>
      ) : (
        !loading && (
             <p className="good-job">
               🎉 Không tìm thấy dữ liệu môn học cho học kỳ này.
             </p>
        )
      )}

      {/* Modal (Pop-up) sẽ được mở ở đây. 
        Modal này đã được nâng cấp (ở file CourseModal.js) để hiển thị 3 tab mới.
      */}
      <CourseModal
        course={selectedCourse}
        onClose={() => setSelectedCourse(null)}
      />
    </div>
  );
}

