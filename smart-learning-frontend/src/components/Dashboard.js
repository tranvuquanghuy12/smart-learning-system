import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Dashboard.css";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function Dashboard({ studentId, studentName }) {
  const [progressData, setProgressData] = useState([]);
  const [average, setAverage] = useState(0);
  const [insights, setInsights] = useState([]);
  const [predictions, setPredictions] = useState([]);


  useEffect(() => {
    axios.get(`https://smart-learning-system.onrender.com/api/progress/${studentId}`).then((res) => {
      setProgressData(res.data);
      const avg =
        res.data.reduce((acc, item) => acc + item.progress, 0) / res.data.length;
      setAverage(avg.toFixed(1));
    });

    axios.get(`https://smart-learning-system.onrender.com/api/insight`).then((res) => {
      setInsights(res.data.insights);
    });

    axios.get(`https://smart-learning-system.onrender.com/api/predict/${studentId}`).then((res) => {
      setPredictions(res.data.predictions);
    });

  }, [studentId]);


  const barData = {
    labels: progressData.map((d) => d.course),
    datasets: [
      {
        label: "Tiến độ (%)",
        data: progressData.map((d) => d.progress),
        backgroundColor: "rgba(25, 118, 210, 0.8)",
        borderRadius: 6,
      },
    ],
  };

  const doughnutData = {
    labels: ["Hoàn thành", "Còn lại"],
    datasets: [
      {
        data: [average, 100 - average],
        backgroundColor: ["#1976d2", "#e3f2fd"],
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className="dashboard-wrapper">
      <div className="student-card slide-in">
        <img
          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
            studentName
          )}&background=1976d2&color=fff`}
          alt="Avatar"
          className="student-avatar"
        />
        <div className="student-info">
          <h2>{studentName}</h2>
          <p>Mã sinh viên: <b>{studentId}</b></p>
          <p>Ngành: Hệ thống thông tin</p>
        </div>
      </div>

      <div className="dashboard-grid fade-in">
        <div className="chart-card">
          <h3>📊 Biểu đồ tiến độ học tập</h3>
          <Bar
            data={barData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, max: 100 } },
            }}
            style={{ maxHeight: "320px" }}
          />

          <div className="progress-list">
            {progressData.map((item, index) => (
              <div key={index} className="progress-item">
                <span>{item.course}</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
                <span className="progress-label">{item.progress}%</span>
              </div>
            ))}
          </div>

          <div className="insight-card">
            <h3>🧠 Phân tích AI</h3>
            <ul>
              {insights.map((i, index) => (
                <li key={index}>{i}</li>
              ))}
            </ul>
          </div>

          <div className="predict-card">
            <h3>🔮 Dự báo học tập tuần tới</h3>
            <ul>
              {predictions.map((p, index) => (
                <li key={index}>
                  <b>{p.course}</b> — dự đoán đạt {p.predicted_progress}% 
                  ({p.risk}% rủi ro). {p.advice}
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="summary-card pop-in">
          <h3>🎯 Tổng quan tiến độ</h3>
          <div className="circle-chart">
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "70%",
              }}
            />
          </div>
          <p className="avg-score">Trung bình: <b>{average}%</b></p>
          <p className="status-text">
            {average >= 85
              ? "🔥 Rất tốt! Bạn đang duy trì phong độ xuất sắc."
              : average >= 65
              ? "📘 Cố gắng thêm chút nữa là đạt thành tích cao!"
              : "⚡ Cần củng cố kiến thức ở các môn cơ sở."}
          </p>
        </div>
      </div>
    </div>
  );
}
