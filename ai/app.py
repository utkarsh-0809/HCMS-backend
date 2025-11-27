from flask import Flask, request, jsonify, g
from flask_cors import CORS
from pymongo import MongoClient
from bson import ObjectId
import google.generativeai as genai
import os
import jwt
from functools import wraps
from dotenv import load_dotenv
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True)

# MongoDB Connection
MONGO_URI = "mongodb+srv://tannisa:YXmXxB8C19yRxAFr@arogya-vault.3bg8o.mongodb.net/arogya-vault"
client = MongoClient(MONGO_URI)
db = client["arogya-vault"]
db = client["arogya-vault"]
collection = db["healthrecords"]
collection2=db["vaccinations"]
users_collection = db["users"]
appointments_collection = db["appointments"]
health_records_collection = db["healthrecords"]
vaccination_collection = db["vaccinations"]


GEMINI_API_KEY = os.getenv("GEMINI_API")
JWT_SECRET = os.getenv("JWT_SECRET")  # Add this to your .env file

if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API key is missing! Set it in the .env file.")

if not JWT_SECRET:
    raise ValueError("❌ JWT_SECRET is missing! Set it in the .env file.")

# Configure Gemini AI
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-pro")

# Helper function to fetch user names by ID
def get_user_name(user_id):
    user = users_collection.find_one({"_id": ObjectId(user_id)}, {"name": 1})
    return user["name"] if user else "Unknown"

# Auth middleware function with updated token structure
def auth_middleware(roles=[]):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            print("---- Auth Middleware Debug ----")
            print("All cookies:", request.cookies)
            token = request.cookies.get('jwt')
            print("JWT cookie present:", token is not None)
            
            if not token:
                # Also check Authorization header as fallback
                auth_header = request.headers.get('Authorization')
                if auth_header and auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                    print("Using token from Authorization header")
                else:
                    print("No JWT token found in cookies or Authorization header")
                    return jsonify({"message": "Unauthorized"}), 401
                
            try:
                # Decode the JWT token - ensure proper options
                decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"require": ["exp"]})
                print(f"JWT decoded successfully. User ID: {decoded.get('id')}, Role: {decoded.get('role')}")

                # Store user in Flask's g object - note we're mapping 'id' to '_id'
                g.user = {
                    "_id": decoded.get('id'),  # Map 'id' from token to '_id' in g.user
                    "role": decoded.get('role')
                }
                
                # Check if user has required role
                if roles and g.user.get('role') not in roles:
                    print(f"Access denied. User role: {g.user.get('role')}, Required roles: {roles}")
                    return jsonify({"message": "Access Denied"}), 403
                    
                return f(*args, **kwargs)
                
            except jwt.ExpiredSignatureError:
                print("Token expired")
                return jsonify({"message": "Token expired"}), 401
            except jwt.InvalidTokenError as e:
                print(f"Invalid token: {str(e)}")
                return jsonify({"message": f"Invalid token: {str(e)}"}), 403
            except Exception as e:
                print(f"Error: {str(e)}")
                return jsonify({"message": f"Internal Server Error: {str(e)}"}), 500
                
        return decorated_function
    return decorator

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            print("---- Auth Middleware Debug ----")
            print("All cookies:", request.cookies)
            token = request.cookies.get('jwt')
            print("JWT cookie present:", token is not None)
            
            if not token:
                # Also check Authorization header as fallback
                auth_header = request.headers.get('Authorization')
                if auth_header and auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                    print("Using token from Authorization header")
                else:
                    print("No JWT token found in cookies or Authorization header")
                    return jsonify({"message": "Unauthorized"}), 401
                
            try:
                # Decode the JWT token - matched to Express structure
                decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                print(f"JWT decoded successfully. User ID: {decoded.get('id')}, Role: {decoded.get('role')}")
                
                # Store user in Flask's g object - note we're mapping 'id' to '_id'
                g.user = {
                    "_id": decoded.get('id'),  # Map 'id' from token to '_id' in g.user
                    "role": decoded.get('role')
                }
                
                # Check if user has required role
                if roles and g.user.get('role') not in roles:
                    print(f"Access denied. User role: {g.user.get('role')}, Required roles: {roles}")
                    return jsonify({"message": "Access Denied"}), 403
                    
                return f(*args, **kwargs)
                
            except jwt.ExpiredSignatureError:
                print("Token expired")
                return jsonify({"message": "Token expired"}), 401
            except jwt.InvalidTokenError as e:
                print(f"Invalid token: {str(e)}")
                return jsonify({"message": f"Invalid token: {str(e)}"}), 403
            except Exception as e:
                print(f"Error: {str(e)}")
                return jsonify({"message": f"Internal Server Error: {str(e)}"}), 500
                
        return decorated_function
    return decorator

# Helper function to convert MongoDB ObjectId to string
def convert_objectid(data):
    """Recursively converts ObjectId fields to strings in a dictionary or list"""
    if isinstance(data, list):
        return [convert_objectid(doc) for doc in data]
    if isinstance(data, dict):
        return {k: str(v) if isinstance(v, ObjectId) else v for k, v in data.items()}
    return data

# Debug endpoint to test authentication
@app.route("/auth-test", methods=["GET"])
@auth_middleware([])  # No role restriction for testing
def auth_test():
    """Simple endpoint to test if authentication works"""
    return jsonify({
        "message": "Authentication successful!",
        "user_id": g.user.get('_id'),
        "role": g.user.get('role')
    })

@app.route("/disease_prediction", methods=["POST"])
def disease_prediction():
    # No auth required for this endpoint
    try:
        data = request.json
        symptoms = data.get("symptoms")

        if not symptoms:
            return jsonify({"error": "Symptoms are required"}), 400

        # Convert symptoms list to a formatted string
        symptoms_text = ", ".join(symptoms)

        # Secure Gemini AI prompt
        gemini_prompt = f"""
        A patient is experiencing the following symptoms: {symptoms_text}.
        Based on these symptoms, predict the most likely disease or condition.
        Provide a detailed explanation along with possible treatments.
        Do not include any technical terms, IDs, or unnecessary database details.
        """

        # Generate response using Gemini AI
        response = model.generate_content(gemini_prompt)
        final_prediction = response.text if response and response.text else "Gemini AI could not generate a prediction."

        return jsonify({"status": "success", "prediction": final_prediction})

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


# ✅ AI-Powered Medical Record Retrieval (No IDs)
@app.route("/ask_question", methods=["POST"])
@auth_middleware(["aanganwadi_staff"])
def ask_question():
    try:
        data = request.json
        user_question = data.get("question")
        
        # Get student ID from the JWT token and convert to ObjectId
        student_id = g.user.get('_id')
        print(f"Using student ID from token: {student_id}")

        if not user_question:
            return jsonify({"error": "Question is required"}), 400

        # Fetch student name
        student = users_collection.find_one({"_id": ObjectId(student_id)}, {"name": 1})
        student_name = student["name"] if student else "Unknown Patient"

        # Fetch medical records - convert string ID to ObjectId
        records = list(collection.find({"studentId": ObjectId(student_id)}))
        if not records:
            return jsonify({"error": "No medical history found for this patient"}), 404

        enriched_records = []
        for record in records:
            doctor = users_collection.find_one({"_id": ObjectId(record["doctorId"])}, {"name": 1})
            doctor_name = doctor["name"] if doctor else "Unknown Doctor"

            enriched_records.append({
                "Date": record.get("createdAt", "Unknown"),
                "Diagnosis": record.get("diagnosis", "Not specified"),
                "Doctor": doctor_name,
                "Treatment": record.get("treatment", "Not specified"),
                "Prescription": record.get("prescription", "Not specified")
            })

        # Secure Gemini AI prompt
        gemini_prompt = f"""
        You are assisting {student_name} with their medical history.
        Do **not** include any database-related terms, IDs, or unnecessary details.

        Patient: {student_name}

        Medical History:
        {enriched_records}

        Answer the following question in a natural and professional manner:
        "{user_question}"
        """

        # Generate response using Gemini AI
        response = model.generate_content(gemini_prompt)
        final_answer = response.text if response and response.text else "I couldn't generate an answer."

        return jsonify({"status": "success", "answer": final_answer})

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500
    
@app.route("/vaccinationrelated", methods=["POST"])
@auth_middleware(["aanganwadi_staff"])
def vaccination_related_question():
    try:
        data = request.json
        user_question = data.get("question")
        
        # Get student ID from the JWT token and convert to ObjectId
        student_id = g.user.get('_id')
        print(f"Using student ID from token: {student_id}")

        if not user_question:
            return jsonify({"error": "Question is required"}), 400

        # Fetch vaccination records - convert string ID to ObjectId
        records = list(collection2.find({"studentId": ObjectId(student_id)}))
        if not records:
            return jsonify({"error": "No vaccination history found for this student"}), 404

        formatted_records = convert_objectid(records)

        # Prepare Gemini AI prompt
        gemini_prompt = f"""
        The following is the student's vaccination record history:
        {formatted_records}
        
        Based on this data, answer the following question:
        "{user_question}"
        """

        # Generate response using Gemini AI
        response = model.generate_content(gemini_prompt)

        final_answer = response.text if response and response.text else "Gemini AI could not generate an answer."

        return jsonify({"status": "success", "answer": final_answer})

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

    

# ✅ AI-Powered Doctor Insights (Secure)
@app.route("/doctor_insights", methods=["POST"])
@auth_middleware(["doctor"])
def doctor_insights():
    try:
        data = request.json
        user_question = data.get("question")

        # Get doctor ID from the JWT token and convert to ObjectId
        doctor_id = g.user.get('_id')
        print(f"Using doctor ID from token: {doctor_id}")

        if not user_question:
            return jsonify({"error": "Question is required"}), 400

        # Fetch doctor details including available slots
        doctor = users_collection.find_one({"_id": ObjectId(doctor_id)}, {"name": 1, "availableSlots": 1})
        if not doctor:
            return jsonify({"error": "Doctor not found"}), 404
        
        doctor_name = doctor.get("name", "Unknown Doctor")
        available_slots = doctor.get("availableSlots", [])

        # Extract only non-booked slots
        free_slots = [slot["dateTime"] for slot in available_slots if not slot.get("isBooked", True)]

        # Fetch doctor's upcoming appointments
        appointments = list(appointments_collection.find({"doctorId": ObjectId(doctor_id)}))
        enriched_appointments = []
        for appointment in appointments:
            student_name = get_user_name(appointment["studentId"])
            
            # Handle the single slotDateTime field
            appointment_time = appointment.get("slotDateTime", "Unknown")
            
            enriched_appointments.append({
                "Patient": student_name,
                "DateTime": appointment_time,
                "Status": appointment.get("status", "Unknown")
            })

        # Fetch health records of treated patients
        health_records = list(health_records_collection.find({"doctorId": ObjectId(doctor_id)}))
        enriched_health_records = []
        for record in health_records:
            student_name = get_user_name(record["studentId"])
            
            # Try multiple potential date field names
            record_date = record.get("createdAt") or record.get("date") or record.get("dateTime") or record.get("timestamp") or "Unknown"
            
            enriched_health_records.append({
                "Patient": student_name,
                "Diagnosis": record.get("diagnosis", "Not specified"),
                "Treatment": record.get("treatment", "Not specified"),
                "Prescription": record.get("prescription", "Not specified"),
                "DateTime": record_date
            })

        # AI Prompt (Using consistent DateTime field names)
        gemini_prompt = f"""
        You are assisting Dr. {doctor_name} with patient records.

        Available Appointment Slots:
        {free_slots}

        Your Upcoming Appointments:
        {enriched_appointments}

        Your Past Treatments:
        {enriched_health_records}

        Answer the following question:
        "{user_question}"
        """

        # Add debugging to see what's being passed to the AI
        print(f"Sending prompt to Gemini AI:\n{gemini_prompt}")

        response = model.generate_content(gemini_prompt)
        final_answer = response.text if response and response.text else "I couldn't generate an answer."

        return jsonify({"status": "success", "answer": final_answer})

    except Exception as e:
        print(f"Doctor insights error: {str(e)}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500
    try:
        data = request.json
        user_question = data.get("question")

        # Get doctor ID from the JWT token and convert to ObjectId
        doctor_id = g.user.get('_id')
        print(f"Using doctor ID from token: {doctor_id}")

        if not user_question:
            return jsonify({"error": "Question is required"}), 400

        # Fetch doctor details including available slots
        doctor = users_collection.find_one({"_id": ObjectId(doctor_id)}, {"name": 1, "availableSlots": 1})
        if not doctor:
            return jsonify({"error": "Doctor not found"}), 404
        
        doctor_name = doctor.get("name", "Unknown Doctor")
        available_slots = doctor.get("availableSlots", [])

        # Extract only non-booked slots
        free_slots = [slot["dateTime"] for slot in available_slots if not slot.get("isBooked", True)]

        # Fetch doctor's upcoming appointments
        appointments = list(appointments_collection.find({"doctorId": ObjectId(doctor_id)}))
        enriched_appointments = []
        for appointment in appointments:
            student_name = get_user_name(appointment["studentId"])
            enriched_appointments.append({
                "Patient": student_name,
                "Date": appointment.get("date", "Unknown"),
                "Time": appointment.get("timeSlot", "Unknown"),
                "Status": appointment.get("status", "Unknown")
            })

        # Fetch health records of treated patients
        health_records = list(health_records_collection.find({"doctorId": ObjectId(doctor_id)}))
        enriched_health_records = []
        for record in health_records:
            student_name = get_user_name(record["studentId"])
            enriched_health_records.append({
                "Patient": student_name,
                "Diagnosis": record.get("diagnosis", "Not specified"),
                "Treatment": record.get("treatment", "Not specified"),
                "Prescription": record.get("prescription", "Not specified"),
                "Date": record.get("createdAt", "Unknown")
            })

        # AI Prompt (Ensuring Available Slots are Passed)
        gemini_prompt = f"""
        You are assisting Dr. {doctor_name} with patient records.

        Available Appointment Slots:
        {free_slots}

        Your Upcoming Appointments:
        {enriched_appointments}

        Your Past Treatments:
        {enriched_health_records}

        Answer the following question:
        "{user_question}"
        """

        response = model.generate_content(gemini_prompt)
        final_answer = response.text if response and response.text else "I couldn't generate an answer."

        return jsonify({"status": "success", "answer": final_answer})

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500


  

# Run Flask app
if __name__ == "__main__":
    app.run(host="localhost", port=5000, debug=True)
