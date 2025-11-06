from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import random
import json
import sqlite3 
import time 
from io import StringIO


# IMPORT CÁC MODULE MỚI 
from tlu_api import (
    authenticate_tlu, 
    fetch_student_marks,
    fetch_current_semester_id, 
    fetch_student_schedule     
)
from recommender import (
    process_tlu_data_to_progress, 
    get_recommendation_logic, 
    predict_future_logic,
    get_insight_logic,
    process_schedule_to_courses 
)

app = Flask(__name__)
CORS(app)

CORS(app, origins=["https://smart-learning-system-hz6mzo0zf-tranvuquanghuy12s-projects.vercel.app"])
import sqlite3
import time
import json
import pandas as pd # Cần import pandas để xử lý to_json/DataFrame

# --- THIẾT LẬP CACHE (BỘ NHỚ ĐỆM) ---
DB_NAME = "tlu_cache.db"
CACHE_DURATION = 3600 # 1 giờ

# Khởi tạo kết nối toàn cục (để tránh lỗi ghi đè)
# Tuy nhiên, trong Flask đa luồng an toàn hơn là mở và đóng kết nối
# Chúng ta sẽ giữ nguyên logic mở/đóng, nhưng sửa lỗi truy vấn.

def init_db():
    """ Khởi tạo CSDL SQLite (chạy 1 lần) """
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Tạo bảng cache (student_id, data_type, json_data, timestamp)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS api_cache (
        student_id TEXT,
        data_type TEXT,
        json_data TEXT,
        timestamp REAL,
        PRIMARY KEY (student_id, data_type)
    )
    ''')
    conn.commit()
    conn.close()

    
def get_from_cache(student_id, data_type):
    """ Lấy dữ liệu từ cache (nếu có và chưa hết hạn) """
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 🚨 SỬA LỖI 2: THÊM LỆNH TRUY VẤN
    cursor.execute('''
        SELECT json_data, timestamp 
        FROM api_cache 
        WHERE student_id = ? AND data_type = ?
    ''', (student_id, data_type))
    
    result = cursor.fetchone()
    conn.close()
    
    if result:
        # Lấy dữ liệu và timestamp
        json_data, cache_timestamp = result
        
        # 🚨 SỬA LỖI 3: KIỂM TRA THỜI GIAN HẾT HẠN
        if time.time() - cache_timestamp > CACHE_DURATION:
            print(f"CACHE EXPIRED: Du lieu {data_type} da het han. Goi lai API TLU.")
            return None
            
        print(f"CACHE HIT: Tra ve du lieu {data_type} cho {student_id} tu CSDL.")
        
        try:
            # Dữ liệu được lưu dưới dạng JSON String (pd.to_json)
            # Dùng pd.read_json để đọc ra DataFrame
            # Anh nên dùng data=json_data chứ không phải result[0]
            # Đảm bảo dữ liệu đọc ra là DataFrame
            json_io = StringIO(json_data) 
            return pd.read_json(json_io, orient='records')

        except Exception as e:
            # In ra lỗi nếu không thể đọc JSON (Serialization Error)
            print(f"ERROR: Khong the doc/convert JSON tu cache CSDL: {e}")
            return None 
    
    print(f"CACHE MISS: Khong tim thay {data_type} cho {student_id} trong CSDL.")
    return None

def set_to_cache(student_id, data_type, data):
    """ Lưu dữ liệu vào cache CSDL """
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    try:
        # 🚨 SỬA LỖI LOGIC: Chắc chắn đầu vào là list/dict trước khi tạo DataFrame
        if isinstance(data, pd.DataFrame):
             data_to_serialize = data
        elif isinstance(data, list) and all(isinstance(i, dict) for i in data):
             # Nếu đầu vào là List of Dicts (như từ API TLU), ta tạo DataFrame
             data_to_serialize = pd.DataFrame(data)
        else:
             print(f"ERROR: Du lieu {data_type} khong the luu vao cache (phai la list/DataFrame).")
             return

        # Chuyển DataFrame thành JSON (Text) dùng orient='records'
        json_data = data_to_serialize.to_json(orient='records') 
        
        cursor.execute(
            "INSERT OR REPLACE INTO api_cache (student_id, data_type, json_data, timestamp) VALUES (?, ?, ?, ?)",
            (student_id, data_type, json_data, time.time())
        )
        conn.commit()
        print(f"CACHE SET: Da luu du lieu {data_type} cho {student_id} vao CSDL.")
    except Exception as e:
        print(f"ERROR: Khong the luu vao cache. Ly do: {e}")
    finally:
        conn.close()
# --- KẾT THÚC THIẾT LẬP CACHE ---

# Lưu trữ phiên đăng nhập (token và info) tạm thời
user_sessions = {} 


@app.route('/api/login', methods=['POST'])
def login():
    """
    API đăng nhập. Nhận MSV và Mật khẩu từ frontend.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "Yeu cau khong co JSON body."}), 400
            
        student_id = data.get('student_id')
        password = data.get('password') 
        
        if not student_id or not password: 
            return jsonify({"success": False, "message": "Vui long cung cap MSV va mat khau."}), 400

        auth_result = authenticate_tlu(student_id, password) 

        if auth_result and auth_result.get("success"):
            user_sessions[student_id] = {
                "access_token": auth_result["access_token"],
                "name": auth_result["name"],
                "student_info": auth_result
            }
            
            return jsonify({
                "success": True,
                "student": {
                    "student_id": auth_result["student_id"],
                    "name": auth_result["name"],
                    "major": auth_result["major"]
                }
            }), 200
        
        return jsonify({"success": False, "message": "Sai ma sinh vien hoac mat khau."}), 401
    
    except Exception as e:
        print(f"LOI CRITICAL TAI API LOGIN: {e}")
        return jsonify({"success": False, "message": "Loi server khi dang nhap."}), 500


def get_ALL_marks_data(student_id): 
    """ 
    Hàm hỗ trợ: Lấy dữ liệu ĐIỂM TỔNG KẾT (Tất cả các môn đã học).
    """
    cached_data = get_from_cache(student_id, "marks")
    if cached_data is not None: # 🚨 SỬA LỖI: Kiểm tra 'is not None' (vì DataFrame có thể rỗng)
        return cached_data, None 

    session = user_sessions.get(student_id)
    if not session or "access_token" not in session:
        return None, "Phien dang nhap het han."

    access_token = session.get("access_token")
    
    tlu_marks = fetch_student_marks(access_token)
    
    if tlu_marks is None: 
        return None, "Khong the lay du lieu diem tong ket tu TLU API."
    
    progress_data = process_tlu_data_to_progress(tlu_marks, student_id)
    
    set_to_cache(student_id, "marks", progress_data)

    return progress_data, None


@app.route('/api/progress/<student_id>', methods=['GET'])
def get_progress(student_id):
    """ 
    API lấy tiến độ học tập (dùng cho Dashboard).
    Sử dụng API Điểm tổng kết (Đã có Cache).
    """
    progress_data, error = get_ALL_marks_data(student_id) 
    if error:
        return jsonify({"message": error}), 500
        
    # 🚨 SỬA LỖI TYPEERROR: 
    # Chuyển DataFrame (Pandas) về JSON (orient='records') để gửi cho Frontend
    return jsonify(progress_data.to_dict(orient='records'))


@app.route('/api/recommendation/<student_id>', methods=['GET'])
def get_recommendation(student_id):
    """ 
    API lấy lộ trình gợi ý học tập (dùng cho trang Gợi ý).
    Sử dụng API Điểm tổng kết.
    """
    progress_data, error = get_ALL_marks_data(student_id) 
    if error:
        return jsonify({"message": error}), 500
        
    recommendations = get_recommendation_logic(progress_data)
    return jsonify(recommendations)


@app.route('/api/insight', methods=['GET'])
def get_insight():
    """ 
    API Phân tích AI tổng quan (dùng cho Dashboard).
    Sử dụng API Điểm tổng kết (của sinh viên đầu tiên đăng nhập).
    """
    student_id = list(user_sessions.keys())[0] if user_sessions else None
    if not student_id:
           return jsonify({"insights": ["Chua co sinh vien dang nhap de phan tich."]})

    progress_data, error = get_ALL_marks_data(student_id) 

    if error or progress_data.empty: # 🚨 SỬA LỖI: Kiểm tra DataFrame rỗng
        return jsonify({"insights": ["Khong du du lieu de phan tich tuong quan."]})
        
    insights = get_insight_logic(progress_data)
    return jsonify(insights)


@app.route('/api/predict/<student_id>', methods=['GET'])
def predict_future(student_id):
    """ API Dự báo tiến độ học tập """
    progress_list, error = get_ALL_marks_data(student_id)
    if error:
        return jsonify({"message": error}), 500
        
    # CHUYỂN DANH SÁCH TIẾN ĐỘ THÀNH DATAFRAME TRƯỚC KHI DỰ ĐOÁN
    try:
        progress_data = pd.DataFrame(progress_list)
    except Exception as e:
        # Xử lý nếu list rỗng hoặc format sai
        return jsonify({"message": f"Loi khi tao DataFrame tu tien do: {e}"}), 500

    predictions = predict_future_logic(progress_data) # <-- Giờ đây là DataFrame
    return jsonify(predictions)


# --- API CHO TRANG "CÁC MÔN ĐANG HỌC" (MỚI, ĐÃ CÓ CACHE) ---

@app.route('/api/current-schedule/<student_id>', methods=['GET'])
def get_current_schedule(student_id):
    """
    API lấy các môn ĐANG HỌC (cho trang SchedulePage.js)
    Sử dụng API Lịch học (fetch_student_schedule) thay vì API Điểm.
    """
    cached_data = get_from_cache(student_id, "schedule")
    if cached_data is not None: # 🚨 SỬA LỖI: Kiểm tra 'is not None'
        return jsonify(cached_data.to_dict(orient='records')) # 🚨 SỬA LỖI: Chuyển DataFrame về JSON

    session = user_sessions.get(student_id)
    if not session or "access_token" not in session:
        return jsonify({"error": "Phien dang nhap het han."}), 401

    access_token = session.get("access_token")

    current_semester_id = fetch_current_semester_id(access_token)
    if not current_semester_id:
        return jsonify({"error": "Khong the lay du lieu hoc ky hien tai."}), 500

    schedule_data = fetch_student_schedule(access_token, current_semester_id)
    
    if schedule_data is None: 
        return jsonify({"error": "Khong the lay du lieu lich hoc."}), 500
    
    processed_schedule = process_schedule_to_courses(schedule_data, student_id)
    
    set_to_cache(student_id, "schedule", processed_schedule)
    
    return jsonify(processed_schedule.to_dict(orient='records')) # 🚨 SỬA LỖI: Chuyển DataFrame về JSON


@app.route('/')
def home():
    return jsonify({"message": "Smart Learning System Backend Ready (TLU Integrated) 🚀"})


if __name__ == '__main__':
    init_db() 
    app.run(debug=True, port=5000)