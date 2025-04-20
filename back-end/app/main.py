import os
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import asyncio
from io import BytesIO

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File
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
    model = YOLO("app/best.pt")
    dummy_frame = np.zeros((640, 480, 3), dtype=np.uint8)
    get_detections(dummy_frame)
    
    yield
    del model

app = FastAPI(lifespan=lifespan)
load_dotenv()
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

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


# def get_gpt_response(outfit: list[dict]):
#     '''
#         Takes in list representing clothing pieces in outfit and returns completion response from OpenAI's gpt-4o-mini LLM model
#         giving recommendations to improve outfit with ratings and structured feedback.
#     '''

#     if len(outfit) == 0: return None

#     client = OpenAI(api_key=OPENAI_API_KEY)
    
#     system_prompt = 'You are an expert fashion stylist who provides detailed outfit analysis and recommendations. ' \
#                 "When analyzing an outfit, follow this specific format:\n\n" \
#                 '1. Start with a numerical rating out of 10 for the overall outfit\n' \
#                 '2. Provide direct, concise, single-line feedback in these specific categories:\n' \
#                 '   - Rating: Give a score out of 10\n' \
#                 '   - Color Harmony: Direct suggestions for color improvements\n' \
#                 '   - Layering Options: Specific colors and types of garments for layering\n' \
#                 '   - Accessories: Direct product suggestions\n' \
#                 '   - Footwear: Direct suggestion on footwear type\n\n' \
#                 'Format your response exactly like this:\n' \
#                 '- **Rating**: X/10\n' \
#                 '- **Color Harmony**: [Your single-line direct suggestion]\n' \
#                 '- **Layering Options**: [Your single-line direct suggestion]\n' \
#                 '- **Accessories**: [Your single-line direct suggestion]\n' \
#                 '- **Footwear**: [Your single-line direct suggestion]\n\n' \
#                 'Guidelines:\n' \
#                 '- Keep all suggestions concise and direct - one line per category\n' \
#                 '- Be specific and practical in your recommendations\n' \
#                 '- Consider both the pieces and their colors in your analysis\n' \
#                 '- Do not mention specific RGB values\n' \
#                 "- When given an RGB value, treat it as an approximate color\n" \
#                 "- Don't assume the color is monotone\n" \
#                 "- Don't make assumptions about style or fit beyond what's provided"

#     user_prompt = f"I am wearing {outfit[0]['class name']} in the color of RGB value {outfit[0]['color']}"
#     for i in range(1, len(outfit)):
#         user_prompt += f" and a {outfit[i]['class name']} in the color of RGB value {outfit[i]['color']}"
#     user_prompt += ". Please analyze my outfit and provide recommendations."
    
#     completion = client.chat.completions.create(
#         model="gpt-4o-mini",
#         messages=[
#             {"role": "system", "content": system_prompt},
#             {"role": "user", "content": user_prompt}
#         ],
#         max_tokens=400,  # Increased to allow for more detailed response
#         temperature=0.7  # Slightly increased for more creative recommendations
#     )

#     return completion

# Locate this part in your main.py file and replace the system_prompt variable:

def get_gpt_response(outfit: list[dict]):
    '''
        Takes in list representing clothing pieces in outfit and returns completion response from OpenAI's gpt-4o-mini LLM model
        giving recommendations to improve outfit with ratings and structured feedback.
    '''

    if len(outfit) == 0: return None

    client = OpenAI(api_key=OPENAI_API_KEY)

    system_prompt = 'You are a fashion stylist giving very concise outfit feedback. ' \
                    'Follow this exact format, with each category exactly as shown:\n\n' \
                    '- **Rating**: Give a score out of 10 (e.g. 7/10)\n' \
                    '- **Color Harmony**: One direct suggestion under 15 words\n' \
                    '- **Layering Options**: One specific garment suggestion under 15 words\n' \
                    '- **Accessories**: One specific accessory suggestion under 15 words\n' \
                    '- **Footwear**: One specific footwear suggestion under 15 words\n\n' \
                    'Guidelines:\n' \
                    '- Keep all responses under 15-20 words per category\n' \
                    '- Be direct and specific with product suggestions\n' \
                    '- Always mention specific colors\n' \
                    '- Never use more than one sentence per category\n' \
                    '- Start with Rating that must be a number out of 10'
    
    user_prompt = f"I am wearing {outfit[0]['class name']} in the color of RGB value {outfit[0]['color']}"
    for i in range(1, len(outfit)):
        user_prompt += f" and a {outfit[i]['class name']} in the color of RGB value {outfit[i]['color']}"
    user_prompt += ". Give me short, direct recommendations."
    
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=300,
        temperature=0.7
    )

    return completion

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
    return recs.choices[0].message.content


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
    '''
        Takes in image file and uses YOLO model to predict outfit in image. Sends back outfit recommendations.
    '''

    try: 
        outfit = use_model_photo(file)
        recs = get_gpt_response(outfit)
        text = recs.choices[0].message.content if recs else "- **No outfit detected**: Ensure photo has clothing in it."

    except MulOutfitsException: 
        text = "- **Multiple outfits detected**: Photo can only contain one outfit in it to ensure accurate results."
        
    finally : return {"text": text}


if __name__ == '__main__':
    # fastapi run main.py --port 8080
    uvicorn.run(app, port=8080, host='0.0.0.0')