import React, { useState } from "react";
import axios from "axios";
import "./Login.css";

export default function Login({ onLoginSuccess }) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState(""); // <-- 1. Thêm state cho mật khẩu
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("https://smart-learning-system.onrender.com/api/login", {
        student_id: studentId,
        password: password, // <-- 2. Gửi mật khẩu đi
      });

      if (res.data.success) {
        onLoginSuccess(res.data.student);
      } else {
        // Cập nhật thông báo lỗi cho chính xác hơn
        setError(res.data.message || "Sai mã sinh viên hoặc mật khẩu!"); 
      }
    } catch (err) {
      setError("Lỗi kết nối server!");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🎓 Smart Learning System</h2>
        <p>Đăng nhập bằng tài khoản TLU</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Nhập mã sinh viên..."
            required
          />

          {/* 3. Thêm ô nhập mật khẩu */}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu..."
            required
          />
          
          <button type="submit">Đăng nhập</button>
        </form>

        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}