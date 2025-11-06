import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Recommendation.css";
import CourseCard from "./CourseCard";
import CourseModal from "./CourseModal";

export default function Recommendation({ studentId, studentName }) {
  const [recommendations, setRecommendations] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    axios
      .get(`https://smart-learning-system.onrender.com/api/recommendation/${studentId}`)
      .then((res) => {
        // API trả dữ liệu JSON, có thể chứa mã Unicode \uXXXX → parse lại để hiển thị tiếng Việt đúng
        const fixedData = JSON.parse(
          JSON.stringify(res.data).replace(/\\u[\dA-F]{4}/gi, (m) =>
            String.fromCharCode(parseInt(m.replace(/\\u/g, ""), 16))
          )
        );

        setRecommendations(fixedData.recommendations || []);
        setMessage(fixedData.message || "");
      })
      .catch((err) => {
        console.error(err);
        setMessage("⚠️ Không thể tải dữ liệu gợi ý học tập.");
      });
  }, [studentId]);

  return (
    <div className="recommend-wrapper fade-in">
      <h2>📚 Lộ trình học tập được gợi ý</h2>
      <p className="student-intro">
        Xin chào <b>{studentName}</b> 👋 – đây là các môn bạn nên tập trung cải thiện:
      </p>
      <p className="recommend-msg">{message}</p>

      {recommendations.length > 0 ? (
        <div className="recommend-grid">
          {recommendations.map((rec, index) => {
            // Xử lý gợi ý thật từ API
            const lessons =
              (rec.roadmap || []).map((tip, i) => ({
                title: `Chương ${i + 1}`,
                note: tip,
                match: Math.floor(Math.random() * 10) + 70, // random độ phù hợp
                document: "#",
                video: "#",
              })) || [];

            return (
              <CourseCard
                key={index}
                course={{
                  title: rec.course,
                  progress: rec.progress,
                  lessons: lessons,
                }}
                onSelect={setSelectedCourse}
              />
            );
          })}
        </div>
      ) : (
        <p className="good-job">
          🎉 Bạn không có môn nào cần cải thiện – hãy tiếp tục phát huy!
        </p>
      )}

      {/* Modal hiển thị khi chọn khóa học */}
      <CourseModal
        course={selectedCourse}
        onClose={() => setSelectedCourse(null)}
      />
    </div>
  );
}
