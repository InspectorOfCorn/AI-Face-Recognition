from flask import Flask, Response, jsonify, request
import cv2
import mediapipe as mp
from flask_cors import CORS
import pandas as pd
import os
import numpy as np
from sklearn.neighbors import KNeighborsClassifier

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["https://yourdomain.com", "http://localhost:3000"],  # Replace with your specific allowed origins in production
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "referrer_policy": "strict-origin-when-cross-origin"
    }
})

mp_face_detection = mp.solutions.face_detection
face_detection = mp_face_detection.FaceDetection(min_detection_confidence=0.3, model_selection=0)

# Global variable to track user presence
user_detected = False

# Add new global variables
known_faces = {
    'embeddings': [],
    'names': [],
    'ids': []
}
current_face_embedding = None

def load_known_faces():
    global known_faces
    if os.path.exists('public/id-names.csv'):
        df = pd.read_csv('public/id-names.csv')
        # Load face embeddings from a file (you'll need to create this)
        embeddings_file = 'public/face_embeddings.npy'
        if os.path.exists(embeddings_file):
            known_faces['embeddings'] = np.load(embeddings_file)
            known_faces['names'] = df['name'].tolist()
            known_faces['ids'] = df['id'].tolist()
        return df
    return pd.DataFrame(columns=['sequence', 'id', 'name'])

def extract_face_embedding(frame, detection):
    # Get facial landmarks as embedding
    landmarks = []
    for landmark in detection.location_data.relative_keypoints:
        landmarks.extend([landmark.x, landmark.y])
    
    # Convert landmarks to numpy array and reshape for KNN
    landmarks = np.array(landmarks).reshape(1, -1)
    return landmarks

def check_face(face_embedding):
    if face_embedding is None or not isinstance(known_faces['embeddings'], np.ndarray) or len(known_faces['embeddings']) == 0:
        return {'known_user': False, 'name': None}
    
    try:
        knn = KNeighborsClassifier(n_neighbors=1)
        knn.fit(known_faces['embeddings'], known_faces['names'])
        
        predicted_name = knn.predict(face_embedding)[0]
        distances, indices = knn.kneighbors(face_embedding)
        confidence = 1 / (1 + distances[0][0])
        
        if confidence > 0.8:
            return {
                'known_user': True,
                'name': predicted_name
            }
        
        return {'known_user': False, 'name': None}
    except Exception as e:
        print(f"Error in face recognition: {str(e)}")
        return {'known_user': False, 'name': None}

def generate_frames():
    camera = cv2.VideoCapture(0)
    global user_detected, current_face_embedding
    
    try:
        while True:
            success, frame = camera.read()
            if not success:
                print("Error: Could not read frame")
                camera.release()
                camera = cv2.VideoCapture(0)  # Reopen camera if frame read fails
                continue
                
            # Process frame for face detection
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_detection.process(frame_rgb)
            
            # Update user_detected status based on face detection
            user_detected = bool(results.detections)
            
            frame = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
            
            if results.detections:
                for detection in results.detections:
                    bbox = detection.location_data.relative_bounding_box
                    h, w, _ = frame.shape
                    x, y = int(bbox.xmin * w), int(bbox.ymin * h)
                    width, height = int(bbox.width * w), int(bbox.height * h)
                    
                    # Draw rectangle around face
                    cv2.rectangle(frame, (x, y), (x + width, y + height), (0, 255, 0), 2)
                    
                    # Extract face embedding without blocking
                    current_face_embedding = extract_face_embedding(frame_rgb, detection)
                    
                    # Check user directly without blocking
                    try:
                        check_data = check_face(current_face_embedding)
                        if check_data['known_user'] and check_data['name']:
                            cv2.putText(frame, check_data['name'], (x, y-10), 
                                      cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
                    except Exception as e:
                        print(f"Error checking face: {str(e)}")
                        continue

            # Encode frame with lower quality for better performance
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 85]
            ret, buffer = cv2.imencode('.jpg', frame, encode_param)
            if not ret:
                continue
                
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    except Exception as e:
        print(f"Camera error: {str(e)}")
    finally:
        camera.release()

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/user_status')
def user_status():
    global user_detected
    return jsonify({'user_detected': user_detected})

@app.route('/register_user', methods=['POST'])
def register_user():
    global known_faces, current_face_embedding
    try:
        data = request.get_json()
        if not data or 'id' not in data or 'name' not in data:
            return jsonify({'error': 'Invalid input'}), 400

        if current_face_embedding is None:
            return jsonify({'error': 'No face detected'}), 400

        # Save to CSV
        csv_path = 'public/id-names.csv'
        if not os.path.exists(csv_path):
            pd.DataFrame(columns=['sequence', 'id', 'name']).to_csv(csv_path, index=False)

        df = pd.read_csv(csv_path)
        new_row = pd.DataFrame({
            'sequence': [len(df)],
            'id': [str(data['id'])],
            'name': [str(data['name'])]
        })
        df = pd.concat([df, new_row], ignore_index=True)
        df.to_csv(csv_path, index=False)

        # Update known_faces
        if not isinstance(known_faces['embeddings'], np.ndarray) or len(known_faces['embeddings']) == 0:
            known_faces['embeddings'] = current_face_embedding
        else:
            known_faces['embeddings'] = np.vstack([known_faces['embeddings'], current_face_embedding])
            
        known_faces['names'].append(str(data['name']))
        known_faces['ids'].append(str(data['id']))
        
        # Save embeddings to file
        np.save('public/face_embeddings.npy', known_faces['embeddings'])

        return jsonify({'success': True})
    
    except Exception as e:
        print(f"Error registering user: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/check_user')
def check_user():
    global current_face_embedding
    return jsonify(check_face(current_face_embedding))

if __name__ == '__main__':
    app.run(debug=True)
