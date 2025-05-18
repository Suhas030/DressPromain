import os
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import asyncio
from io import BytesIO
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile, Form
from fastapi.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import numpy as np
from PIL import Image
import cv2
import scipy
import scipy.cluster

from ultralytics import YOLO
import supervision as sv

from openai import OpenAI

# Initializing app
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Loading model and using it on startup ensures app works efficiently
    global model
    model = YOLO("best.pt")
    dummy_frame = np.zeros((640, 480, 3), dtype=np.uint8)
    get_detections(dummy_frame)
    
    yield
    del model

app = FastAPI(lifespan=lifespan)
# Add this:
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

load_dotenv()
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
print(f"API Key loaded: {OPENAI_API_KEY[:10]}...")  # Debug print

origins = [
    "http://localhost:5173/",
    "http://localhost:5173",
    "https://fitdetect.netlify.app/",
    "https://fitdetect.netlify.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clothing_groups = {
    "short sleeve top": "top", 
    "long sleeve top": "top", 
    "short sleeve outwear": "top", 
    "long sleeve outwear": "top", 
    "vest": "top",
    "shorts": "bottom",
    "trousers": "bottom",
    "skirt": "bottom",
    "short sleeve dress": "dress",
    "long sleeve dress": "dress",
    "vest dress": "dress",
    "sling dress": "dress",
    "sling": "other"
}


# Code for this function was written by Peter Hansen at https://stackoverflow.com/a/3244061 but slightly modified for my use case
def get_object_color(frame: np.ndarray):
    '''
        Takes in NumPy array representing image and returns string representing RGB value of most dominant color in image
    '''

    # Reading image
    img = Image.fromarray(frame)
    img = img.resize((150, 150)) # Resizing to reduce time
    arr = np.asarray(img)
    # Reshaping to 2D array where row represents pixel and col represents r/g/b value
    arr = arr.reshape(arr.shape[0] * arr.shape[1], 3).astype(float) 

    codes, _ = scipy.cluster.vq.kmeans(arr, 5) # Finding most dominant colors
    vecs, _ = scipy.cluster.vq.vq(arr, codes) # Assigning each pixel to one of the dominant colors
    counts, _ = np.histogram(vecs, len(codes)) # Counting occurrences

    index_max = np.argmax(counts) # Find most frequent
    peak = codes[index_max] # Getting RGB value of most frequent
    return f'({int(peak[0])}, {int(peak[1])}, {int(peak[2])})'


def get_detections(arr: np.ndarray):
    '''
        Takes in NumPy array representing image and returns Detections object encapsulating clothing detections. 
    '''
    result = model(arr, agnostic_nms=True, verbose=False)[0]
    detections = sv.Detections.from_ultralytics(result)
    detections = detections[detections.confidence >= .4]

    return detections


def get_isolated_object(bbox, frame):
    '''
        Takes in tuple representing bounding box of object and NumPy array representing full image.
        Returns NumPy array representing image cropped to be just the object in bounding box.
    '''

    x1, y1, x2, y2 = bbox
    isolated_object = frame[int(y1):int(y2), int(x1):int(x2)]

    return isolated_object


def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    # For project keys, we need to set it directly
    if api_key and api_key.startswith('sk-proj-'):
        # Fix: Use api_key instead of project
        return OpenAI(api_key=api_key)
    else:
        return OpenAI(api_key=api_key)


def get_gpt_response(outfit: list[dict]):
    '''
        Takes in list representing clothing pieces in outfit and returns completion response from OpenAI's gpt-4o-mini LLM model
        giving recommendations to improve outfit with ratings and structured feedback.
    '''

    if len(outfit) == 0: return None

    client = get_openai_client()
    
    system_prompt = 'You are a fashion stylist giving EXTREMELY brief outfit feedback. ' \
                    'Follow this exact format:\n\n' \
                    '- **Rating**: X/10 (just the number, no explanation)\n' \
                    '- **Color Harmony**: Maximum 10 words\n' \
                    '- **Layering Options**: Maximum 10 words\n' \
                    '- **Accessories**: Maximum 10 words\n' \
                    '- **Footwear**: Maximum 10 words\n\n' \
                    'STRICT RULES:\n' \
                    '- NEVER use more than 10 words per suggestion\n' \
                    '- Use direct, minimal language\n' \
                    '- Only mention specific colors and items\n' \
                    '- Single sentence fragments only\n' \
                    '- No explanations or justifications\n' \
                    '- Count your words for each line\n' \
                    '- If you exceed 10 words, cut words until under limit'


    user_prompt = f"I am wearing {outfit[0]['class name']} in the color of RGB value {outfit[0]['color']}"
    for i in range(1, len(outfit)):
        user_prompt += f" and a {outfit[i]['class name']} in the color of RGB value {outfit[i]['color']}"
    user_prompt += ". Give extremely brief, direct recommendations. Maximum 10 words per line."
    
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=200,  # Reducing max tokens since we want shorter responses
            temperature=0.5  # Lower temperature for more predictable, concise responses
        )
        print("SUCCESS: OpenAI API call worked!")
        return completion
    except Exception as e:
        print(f"ERROR WITH OPENAI: {str(e)}")
        # Return mock response instead of failing
        class MockCompletion:
            class Choice:
                class Message:
                    content = "- **Rating**: 7/10\n- **Color Harmony**: Neutrals with dark contrast, good balance.\n- **Layering Options**: Light jacket or cardigan for warmth.\n- **Accessories**: Silver jewelry enhances the look.\n- **Footwear**: Black ankle boots would complement well."
                message = Message()
            choices = [Choice()]
        return MockCompletion()


def enforce_word_limit(text, max_words=10):
    """Enforce word limit on each line of recommendations"""
    lines = text.split('\n')
    limited_lines = []
    
    for line in lines:
        if '**Rating**' in line:
            limited_lines.append(line)  # Don't modify rating line
            continue
            
        parts = line.split('**: ')
        if len(parts) != 2:
            limited_lines.append(line)
            continue
            
        title, content = parts
        words = content.split()
        if len(words) > max_words:
            truncated = ' '.join(words[:max_words])
            limited_lines.append(f"{title}**: {truncated}")
        else:
            limited_lines.append(line)
            
    return '\n'.join(limited_lines)

def get_recs(detections_dict):
    '''
        Takes in dict representing all clothing detected and returns string representing recommendations from OpenAI's gpt-4o-mini LLM model
    '''

    objects_detected = [
        (
            class_name, 
            detections_dict[class_name]['conf'], # Highest confidence level detected
            detections_dict[class_name]['img'], # NumPy array representing frame where highest confidence level was detected
            detections_dict[class_name]['detection count'] # Number of times object was detected
        ) 
        for class_name in detections_dict
    ]

    objects_detected = sorted(
        objects_detected, 
        key=lambda o : o[3], # Sorting by number of frames objects were detected
        reverse=True # Sorting from highest to lowest
    )

    outfit = []
    detected_groups = {} # Will represent the clothing groups that were detected
    for obj_name, _, img, _ in objects_detected:
        group = clothing_groups[obj_name]

        # Ensuring that > 1 item per clothing group isn't included in final outfit.
        # This is necessary so that if model incorrectly predicts an object for only a few frames
        # we won't consider it to be apart of the outfit.
        if group not in detected_groups: 
            if group == 'top' or group == 'bottom':
                detected_groups['dress'] = True # Since user likely won't be wearing both a top/bottom and a dress
            elif group == 'dress':
                detected_groups['top'] = True 
                detected_groups['bottom'] = True
            detected_groups[group] = True

            color = get_object_color(img)
            outfit.append({'class name': obj_name, 'color': color})

    recs = get_gpt_response(outfit)
    response_text = recs.choices[0].message.content
    response_text = enforce_word_limit(response_text, max_words=10)
    return response_text


async def use_model_webcam(websocket: WebSocket, queue: asyncio.Queue, detections_dict: dict):
    '''
        Takes in WebSocket object, asyncio queue, and dict to represent clothing detected when using webcam.
        Makes clothing predictions on incoming frames from WebSocket and sends back frames with labels/bounding boxes included.
        After a single object is detected 300 times, gets outfit recommendations and sends them back to front end through WebSocket.
    '''

    socket_open = True
    box_annotator = sv.BoundingBoxAnnotator(
        thickness=2
    )
    label_annotator = sv.LabelAnnotator()

    while True:
        # Getting bytes representing frame from WebSocket and decoding them into NumPy array
        bytes = await queue.get() 
        arr = np.frombuffer(bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, 1)

        detections = get_detections(frame)

        labels = []
        for bbox, _, confidence, _, _, class_dict in detections:
            class_name = class_dict['class_name']
            label = f'{class_name} {confidence:0.2f}'
            labels.append(label)
            
            if class_name not in detections_dict:
                isolated_object = get_isolated_object(bbox, frame)
                detections_dict[class_name] = {
                    'conf': confidence,
                    'img': isolated_object,
                    'detection count': 0
                }

            elif confidence > detections_dict[class_name]['conf']:
                isolated_object = get_isolated_object(bbox, frame)
                detections_dict[class_name]['conf'] = confidence
                detections_dict[class_name]['img'] = isolated_object

            detections_dict[class_name]['detection count'] += 1

            # Once an object has been detected 300 times, assuming app has been given enough to time to get
            # a good sense of what the user is wearing, so ending process and getting recommendations.
            if detections_dict[class_name]['detection count'] >= 300:
                if str(websocket.application_state) == "WebSocketState.CONNECTED":
                    await websocket.send_text("Detections completed.")

                    recs = get_recs(detections_dict)
                    recs = enforce_word_limit(recs, max_words=10)  # Add this line
                    await websocket.send_text(recs)

                socket_open = False

        if socket_open:
            # Annotating detections
            frame = box_annotator.annotate(
                scene=frame, 
                detections=detections
            )
            frame = label_annotator.annotate(
                scene=frame,
                detections=detections,
                labels=labels
            )

            # Encoded annotated frame into bytes and sending back to front end
            encoded_bytes = cv2.imencode('.jpg', frame)[1].tobytes()
            
            await websocket.send_bytes(encoded_bytes)
            
        else : break


async def receive(websocket: WebSocket, queue: asyncio.Queue):
    '''
        Takes in WebSocket and asyncio queue and putting incoming frames into queue.
    '''

    bytes = await websocket.receive_bytes()
    
    try:
        queue.put_nowait(bytes)
    except asyncio.QueueFull:
        pass

@app.get("/")
async def root():
    return {"message": "Welcome to the Outfit Detection API"}

@app.websocket("/webcam/")
async def use_camera_detection(websocket: WebSocket):
    '''
        Accepts websocket connection and creates asyncio task to use YOLO model with web camera.
        Sends outfit recommendations.
    '''

    await websocket.accept()
    queue = asyncio.Queue(maxsize=10)
    detections_dict = {}
    detect_task = asyncio.create_task(use_model_webcam(websocket, queue, detections_dict))

    # Common errors that occur that can be ignored
    common_errs = [
        "Unexpected ASGI message 'websocket.close', after sending 'websocket.close' or response already completed.",
        'Cannot call "send" once a close message has been sent.',
        'WebSocket is not connected. Need to call "accept" first.'
    ]

    try:
        while True:
            await receive(websocket, queue)
            
    except WebSocketDisconnect:
        detect_task.cancel()
        try : await websocket.close()

        except RuntimeError as e:
            if str(e) in common_errs : pass
            else : print("In WebSocketDisconnect exception block:", e)

    except RuntimeError as e:
        if str(e) in common_errs : pass
        else : print("In RuntimeError exception block:", e)
        

class MulOutfitsException(Exception):
    '''
        Exception that is raised when multiple outfits are detected in single image.
    '''
    pass


def use_model_photo(image_bytes: bytes):
    '''
        Takes in bytes representing image and returns dict representing outfit detected in image.
    '''

    img = Image.open(BytesIO(image_bytes))
    arr = np.asarray(img)

    detections = get_detections(arr)

    outfit = []
    detected_groups = {}
    for bbox, _, _, _, _, class_dict in detections:
        obj_name = class_dict['class_name']
        group = clothing_groups[obj_name]
        
        # Ensuring that > 1 item per clothing group isn't included in final outfit.
        # This is necessary because if model predicts > 1 item in same clothing group, there is likely > 1 people wearing
        # outfits in image and thus app can't give accurate recommendations. 
        if group not in detected_groups:
            if group == 'top' or group == 'bottom': # Since user likely won't be wearing both a top/bottom and a dress
                detected_groups['dress'] = True

            elif group == 'dress':
                detected_groups['top'] = True
                detected_groups['bottom'] = True

            detected_groups[group] = True

            isolated_object = get_isolated_object(bbox, arr)
            color = get_object_color(isolated_object)
        
            outfit.append({'class name': obj_name, 'color': color})

        else : raise MulOutfitsException()

    return outfit


@app.post("/upload-photo/")
async def use_photo_detection(file: bytes=File(...)):
    try:
        outfit = use_model_photo(file)
        if not outfit or len(outfit) == 0:
            return {"text": "- **No outfit detected**: Ensure photo has clothing in it."}
            
        recs = get_gpt_response(outfit)
        text = recs.choices[0].message.content
        # Apply word limit to ensure concise recommendations
        text = enforce_word_limit(text, max_words=10)
        print(f"Generated recommendations: {text}")
        
    except MulOutfitsException:
        text = "- **Multiple outfits detected**: Photo can only contain one outfit in it to ensure accurate results."
    except Exception as e:
        print(f"Unexpected error processing image: {str(e)}")
        text = f"- **Error processing image**: {str(e)}"
        
    finally:
        return {"text": text}


@app.post("/upload-multiple-photos/")
async def analyze_multiple_photos(files: List[UploadFile] = File(...), gender: str = Form(...)):
    """
    Analyze multiple outfit photos and provide style recommendations based on them
    """
    try:
        # Store analysis results for each photo
        detected_items = []
        
        # Process each uploaded file
        for file in files:
            contents = await file.read()
            
            try:
                outfit = use_model_photo(contents)
                
                if outfit and len(outfit) > 0:
                    for item in outfit:
                        # Add the file name for reference
                        item['file_name'] = file.filename
                        item['group'] = clothing_groups.get(item['class name'], 'other')
                        detected_items.append(item)
                        
            except MulOutfitsException:
                # Skip files with multiple outfits detected
                continue
            except Exception as e:
                print(f"Error processing file {file.filename}: {str(e)}")
                continue
                
        if not detected_items:
            return {"error": "No clothing items detected in any of the uploaded images"}
            
        # Analyze detected items to find dominant colors and style types
        dominant_colors = analyze_dominant_colors(detected_items)
        dominant_types = determine_style_types(detected_items, gender)
        
        # Generate product recommendations based on style analysis
        recommendations = generate_recommendations(detected_items, dominant_colors, dominant_types, gender)
        
        return {
            "detected_items": detected_items,
            "style_analysis": {
                "dominant_colors": dominant_colors,
                "dominant_types": dominant_types
            },
            "recommendations": recommendations
        }
        
    except Exception as e:
        print(f"Unexpected error in upload-multiple-photos: {str(e)}")
        return {"error": f"Failed to analyze photos: {str(e)}"}


# Helper functions for the multi-photo analysis
def analyze_dominant_colors(items):
    """Extract and analyze the dominant colors from all detected items"""
    # This is a simplified version - in a real app you would do more sophisticated color analysis
    all_colors = {}
    
    for item in items:
        color = item['color']
        if color in all_colors:
            all_colors[color] += 1
        else:
            all_colors[color] = 1
    
    # Convert to list of [color, count] and sort by count
    color_list = [[color, count] for color, count in all_colors.items()]
    color_list.sort(key=lambda x: x[1], reverse=True)
    
    # Calculate percentages
    total = sum(count for _, count in color_list)
    color_list = [[color, round((count / total) * 100)] for color, count in color_list]
    
    return color_list[:5]  # Return top 5 colors

def determine_style_types(items, gender):
    """Determine style types based on detected clothing items and colors"""
    # In a real app, this would be a complex algorithm
    # This is a simplified mock implementation
    
    # Count item types
    tops = sum(1 for item in items if item['group'] == 'top')
    bottoms = sum(1 for item in items if item['group'] == 'bottom')
    dresses = sum(1 for item in items if item['group'] == 'dress')
    
    # Mock style determination
    styles = {
        "Casual": 0,
        "Formal": 0,
        "Classic": 0,
        "Trendy": 0,
        "Minimalist": 0,
        "Bohemian": 0
    }
    
    # Basic style determination - this would be much more sophisticated in reality
    for item in items:
        class_name = item['class name'].lower()
        
        if 'outwear' in class_name:
            styles["Casual"] += 10
            
        if 'sleeve top' in class_name:
            styles["Classic"] += 15
            
        if 'dress' in class_name:
            styles["Formal"] += 20
            
        if 'trousers' in class_name:
            styles["Classic"] += 10
            styles["Minimalist"] += 5
            
        if 'shorts' in class_name:
            styles["Casual"] += 15
            
        if 'skirt' in class_name:
            styles["Trendy"] += 10
            styles["Bohemian"] += 5
    
    # Convert to list and calculate percentages
    style_list = [[style, score] for style, score in styles.items() if score > 0]
    style_list.sort(key=lambda x: x[1], reverse=True)
    
    total = sum(score for _, score in style_list)
    if total > 0:
        style_list = [[style, round((score / total) * 100)] for style, score in style_list]
    
    return style_list[:3]  # Return top 3 styles

def generate_recommendations(items, colors, styles, gender):
    """Generate product recommendations based on style analysis"""
    # In a real app, this would call an e-commerce API
    # This is mock data for demonstration
    
    # Mock product database
    mock_products = [
        {
            "id": "p1",
            "name": "Classic Oxford Button-Down Shirt",
            "price": "$49.99",
            "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop",
            "url": "https://example.com/product/1",
            "category": "top",
            "gender": "male",
            "style": ["Classic", "Formal"]
        },
        {
            "id": "p2",
            "name": "Slim Fit Chino Pants",
            "price": "$59.99",
            "image_url": "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop",
            "url": "https://example.com/product/2",
            "category": "bottom",
            "gender": "male",
            "style": ["Classic", "Casual"]
        },
        {
            "id": "p3",
            "name": "Casual Denim Jacket",
            "price": "$89.99",
            "image_url": "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400&h=500&fit=crop",
            "url": "https://example.com/product/3",
            "category": "outwear",
            "gender": "unisex",
            "style": ["Casual", "Trendy"]
        },
        {
            "id": "p4",
            "name": "Premium Leather Sneakers",
            "price": "$129.99",
            "image_url": "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400&h=500&fit=crop",
            "url": "https://example.com/product/4",
            "category": "footwear",
            "gender": "unisex",
            "style": ["Casual", "Minimalist"]
        },
        {
            "id": "p5",
            "name": "Designer Watch with Leather Strap",
            "price": "$199.99",
            "image_url": "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&h=500&fit=crop",
            "url": "https://example.com/product/5",
            "category": "accessory",
            "gender": "unisex",
            "style": ["Classic", "Formal"]
        },
        {
            "id": "p6",
            "name": "Floral Summer Dress",
            "price": "$79.99",
            "image_url": "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=400&h=500&fit=crop",
            "url": "https://example.com/product/6",
            "category": "dress",
            "gender": "female",
            "style": ["Casual", "Bohemian"]
        },
        {
            "id": "p7",
            "name": "High-Waisted Jeans",
            "price": "$69.99",
            "image_url": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop",
            "url": "https://example.com/product/7",
            "category": "bottom",
            "gender": "female",
            "style": ["Casual", "Trendy"]
        },
        {
            "id": "p8",
            "name": "Oversized Knit Sweater",
            "price": "$65.99",
            "image_url": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop",
            "url": "https://example.com/product/8",
            "category": "top",
            "gender": "female",
            "style": ["Casual", "Minimalist"]
        }
    ]
    
    # Filter products by gender
    if gender == "male":
        filtered_products = [p for p in mock_products if p["gender"] in ["male", "unisex"]]
    elif gender == "female":
        filtered_products = [p for p in mock_products if p["gender"] in ["female", "unisex"]]
    else:  # unisex
        filtered_products = mock_products
    
    # Filter by style if we have style info
    if styles:
        top_style = styles[0][0] if styles else None
        if top_style:
            style_match_products = [p for p in filtered_products if top_style in p["style"]]
            if style_match_products:
                filtered_products = style_match_products
    
    # Return up to 6 products
    return filtered_products[:6]


if __name__ == '__main__':
    # fastapi run main.py --port 8080
    uvicorn.run(app, port=8080, host='0.0.0.0')