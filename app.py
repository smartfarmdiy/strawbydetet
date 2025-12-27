import cv2
import supervision as sv
from ultralytics import YOLO
import numpy as np
from flask import Flask, render_template, request, jsonify, Response
import os
import time
import logging
import threading
import base64
from io import BytesIO

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Load the YOLO model
model_path = "best.pt"
if not os.path.exists(model_path):
    logging.error(f"Model file '{model_path}' not found in the current directory.")
    model = None
else:
    try:
        model = YOLO(model_path)
        logging.info("YOLO model loaded successfully.")
        dummy_input = np.zeros((640, 640, 3), dtype=np.uint8)
        model.predict(dummy_input, verbose=False)
        logging.info("Model validation successful.")
    except Exception as e:
        logging.error(f"Failed to load or validate YOLO model: {e}")
        model = None
class_names = ['Anthracnose Fruit Rot', 'Gray Mold', 'Powdery Mildew Fruit', 'Powdery Mildew Leaf', 'Ripe', 'Unripe', 'Rotten']

# Initialize annotators
box_annotator = sv.BoxAnnotator()
label_annotator = sv.LabelAnnotator()

# Directories for uploads and static files
UPLOAD_FOLDER = 'static/uploads'
STATIC_FOLDER = 'static'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Shared state for video and camera processing
frame = None
video_path = None
cumulative_counts = {name: 0 for name in class_names}  # Track cumulative counts for video
camera_counts = {name: 0 for name in class_names}  # Track cumulative counts for camera
final_percentages = {name: 0 for name in class_names}  # Store final percentages for video
lock = threading.Lock()
counts_lock = threading.Lock()
camera_lock = threading.Lock()
video_processing_complete = False

def process_video():
    global frame, video_path, cumulative_counts, final_percentages, video_processing_complete
    while True:
        if video_path is None:
            time.sleep(0.1)
            continue
        
        logging.info(f"Processing video: {video_path}")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logging.error(f"Error: Could not open video {video_path}")
            video_path = None
            continue
        
        width, height = 640, 480
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        
        frame_count = 0
        video_processing_complete = False
        
        while True:
            ret, current_frame = cap.read()
            if not ret:
                logging.info("End of video or read error")
                break
            
            current_frame = cv2.resize(current_frame, (width, height))
            frame_count += 1
            
            # Real-time object detection
            try:
                results = model(current_frame, verbose=False)[0]
                detections = sv.Detections.from_ultralytics(results)
            except Exception as e:
                logging.error(f"Model prediction failed: {e}")
                continue
            
            # Update detection counts for the frame
            frame_counts = {name: 0 for name in class_names}
            if detections.class_id is not None and len(detections.class_id) > 0:
                for class_id in detections.class_id:
                    class_name = model.names[class_id]
                    if class_name in frame_counts:
                        frame_counts[class_name] += 1
                        with counts_lock:
                            cumulative_counts[class_name] += 1  # Accumulate counts
            
            logging.info(f"Frame {frame_count}: Detections - {frame_counts}")
            
            # Annotate frame
            annotated_frame = box_annotator.annotate(scene=current_frame, detections=detections)
            annotated_frame = label_annotator.annotate(scene=annotated_frame, detections=detections)
            
            with lock:
                frame = annotated_frame.copy()
            
            time.sleep(0.033)  # ~30 FPS
        
        cap.release()
        logging.info(f"Video processing complete: {frame_count} frames processed")
        
        # Calculate and store final percentages
        with counts_lock:
            total = sum(cumulative_counts.values())
            final_percentages = {name: (count / total * 100) if total > 0 else 0 for name, count in cumulative_counts.items()}
            logging.info(f"Final percentages: {final_percentages}")
            cumulative_counts = {name: 0 for name in class_names}
        
        os.remove(video_path)
        video_path = None
        video_processing_complete = True

def generate_frames():
    while True:
        with lock:
            if frame is None:
                time.sleep(0.01)
                continue
            try:
                ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
                if not ret:
                    logging.error("Failed to encode frame to JPEG")
                    continue
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            except Exception as e:
                logging.error(f"Error encoding frame: {e}")
                continue
            time.sleep(0.01)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'})
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No image selected'})
    
    if not model:
        return jsonify({'error': 'Model not loaded. Please ensure best.pt is in the current directory and compatible with the latest Ultralytics YOLOv8.'})
    
    if file.filename.endswith(('.jpg', '.jpeg', '.png')):
        try:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
            file.save(filepath)
            
            image = cv2.imread(filepath)
            if image is None:
                os.remove(filepath)
                return jsonify({'error': 'Error: Could not load image'})
            
            try:
                results = model(image)[0]
                detections = sv.Detections.from_ultralytics(results)
            except Exception as e:
                logging.error(f"Model prediction failed: {e}")
                os.remove(filepath)
                return jsonify({'error': f'Model prediction failed: {str(e)}'})
            
            annotated_image = box_annotator.annotate(scene=image.copy(), detections=detections)
            annotated_image = label_annotator.annotate(scene=annotated_image, detections=detections)
            
            output_filename = f"annotated_{file.filename}"
            output_path = os.path.join(STATIC_FOLDER, output_filename)
            cv2.imwrite(output_path, annotated_image)
            
            class_counts = {name: 0 for name in class_names}
            if detections.class_id is not None:
                for class_id in detections.class_id:
                    class_name = model.names[int(class_id)]
                    if class_name in class_counts:
                        class_counts[class_name] += 1
            
            total = sum(class_counts.values())
            percentages = {name: (count / total * 100) if total > 0 else 0 for name, count in class_counts.items()}
            
            os.remove(filepath)
            
            logging.info(f"Image processed successfully: {output_filename}, Percentages: {percentages}")
            return jsonify({
                'image_url': f'/{output_path}',
                'percentages': percentages
            })
        except Exception as e:
            logging.error(f"Error processing image: {e}")
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'error': f'Error processing image: {str(e)}'})
    
    return jsonify({'error': 'Unsupported image format'})

@app.route('/upload_video', methods=['POST'])
def upload_video():
    global video_path, video_processing_complete
    if 'video' not in request.files:
        return jsonify({'error': 'No video uploaded'})
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No video selected'})
    
    if not model:
        return jsonify({'error': 'Model not loaded. Please ensure best.pt is in the current directory and compatible with the latest Ultralytics YOLOv8.'})
    
    if file and file.filename.endswith(('.mp4', '.avi')):
        try:
            filename = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
            file.save(filename)
            video_path = filename
            with counts_lock:
                cumulative_counts = {name: 0 for name in class_names}  # Reset counts
            video_processing_complete = False
            logging.info(f"Uploaded video saved as: {filename}")
            return jsonify({'success': 'Video uploaded, streaming started'})
        except Exception as e:
            logging.error(f"Error uploading video: {e}")
            return jsonify({'error': f'Error uploading video: {str(e)}'})
    
    return jsonify({'error': 'Unsupported video format'})

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/camera_feed', methods=['POST'])
def camera_feed():
    global frame, camera_counts
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'})
        
        # Decode base64 image
        img_data = base64.b64decode(data['image'].split(',')[1])
        np_arr = np.frombuffer(img_data, np.uint8)
        current_frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if current_frame is None:
            logging.error("Failed to decode camera frame")
            return jsonify({'error': 'Failed to decode camera frame'})
        
        # Process frame
        try:
            results = model(current_frame, verbose=False)[0]
            detections = sv.Detections.from_ultralytics(results)
        except Exception as e:
            logging.error(f"Model prediction failed: {e}")
            return jsonify({'error': f'Model prediction failed: {str(e)}'})
        
        # Update detection counts
        frame_counts = {name: 0 for name in class_names}
        if detections.class_id is not None:
            for class_id in detections.class_id:
                class_name = model.names[int(class_id)]
                if class_name in frame_counts:
                    frame_counts[class_name] += 1
                    with camera_lock:
                        camera_counts[class_name] += 1
        
        logging.info(f"Camera frame processed: Detections - {frame_counts}")
        
        # Annotate frame
        annotated_frame = box_annotator.annotate(scene=current_frame, detections=detections)
        annotated_frame = label_annotator.annotate(scene=annotated_frame, detections=detections)
        
        with lock:
            frame = annotated_frame.copy()
        
        # Encode frame for response
        ret, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if not ret:
            logging.error("Failed to encode camera frame")
            return jsonify({'error': 'Failed to encode camera frame'})
        
        frame_bytes = buffer.tobytes()
        return Response(frame_bytes, mimetype='image/jpeg')
    except Exception as e:
        logging.error(f"Error processing camera frame: {e}")
        return jsonify({'error': f'Error processing camera frame: {str(e)}'})

@app.route('/camera_counts')
def camera_counts():
    with camera_lock:
        total = sum(camera_counts.values())
        percentages = {name: (count / total * 100) if total > 0 else 0 for name, count in camera_counts.items()}
        logging.info(f"Serving camera percentages: {percentages}")
        return jsonify(percentages.copy())

@app.route('/detection_counts')
def detection_counts():
    with counts_lock:
        total = sum(cumulative_counts.values())
        percentages = {name: (count / total * 100) if total > 0 else 0 for name, count in cumulative_counts.items()}
        logging.info(f"Serving detection percentages: {percentages}")
        return jsonify(percentages.copy())

@app.route('/final_counts')
def final_counts():
    global video_processing_complete
    with counts_lock:
        return jsonify({
            'complete': video_processing_complete,
            'percentages': final_percentages.copy()
        })

@app.route('/stop_stream', methods=['POST'])
def stop_stream():
    global video_path, cumulative_counts, camera_counts, video_processing_complete
    try:
        if video_path and os.path.exists(video_path):
            os.remove(video_path)
        video_path = None
        with counts_lock:
            cumulative_counts = {name: 0 for name in class_names}
        with camera_lock:
            camera_counts = {name: 0 for name in class_names}
        video_processing_complete = False
        logging.info("Stream stopped and counts reset")
        return jsonify({'success': 'Stream stopped'})
    except Exception as e:
        logging.error(f"Error stopping stream: {e}")
        return jsonify({'error': f'Error stopping stream: {str(e)}'})

@app.route('/stop_camera', methods=['POST'])
def stop_camera():
    global camera_counts
    try:
        with camera_lock:
            camera_counts = {name: 0 for name in class_names}
        logging.info("Camera stopped and counts reset")
        return jsonify({'success': 'Camera stopped'})
    except Exception as e:
        logging.error(f"Error stopping camera: {e}")
        return jsonify({'error': f'Error stopping camera: {str(e)}'})

if __name__ == '__main__':
    threading.Thread(target=process_video, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, debug=True)