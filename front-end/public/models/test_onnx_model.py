import os
import numpy as np
import cv2
import onnxruntime as ort
from PIL import Image, ImageDraw
import json
import matplotlib.pyplot as plt

# Load class names from metadata
with open('best_metadata.json', 'r') as f:
    metadata = json.load(f)
    class_names = metadata['classes']
print(f"Loaded {len(class_names)} classes from metadata")

# Load model
model_path = 'best.onnx'
session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
print(f"Loaded model: {model_path}")
print(f"Input name: {session.get_inputs()[0].name}")
print(f"Output name: {session.get_outputs()[0].name}")

# Ask for image path
image_path = input("Enter path to test image: ").strip('"')
image = cv2.imread(image_path)
if image is None:
    print(f"Error: Could not read image at {image_path}")
    exit(1)
    
image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

# Preprocess
input_size = 640
h, w = image.shape[:2]
scale = min(input_size/w, input_size/h)
new_w, new_h = int(w*scale), int(h*scale)
pad_w, pad_h = (input_size-new_w)//2, (input_size-new_h)//2

# Create padded image
resized = cv2.resize(image_rgb, (new_w, new_h))
canvas = np.zeros((input_size, input_size, 3), dtype=np.uint8)
canvas[pad_h:pad_h+new_h, pad_w:pad_w+new_w] = resized

# Normalize and convert to tensor
tensor = np.transpose(canvas.astype(np.float32)/255.0, (2, 0, 1))
tensor = np.expand_dims(tensor, axis=0)

# Run inference
input_name = session.get_inputs()[0].name
output_name = session.get_outputs()[0].name
outputs = session.run([output_name], {input_name: tensor})

# Process output
output = outputs[0]
print(f"Output shape: {output.shape}")

# Draw detections
img_pil = Image.fromarray(image_rgb)
draw = ImageDraw.Draw(img_pil)
colors = [(255,0,0), (0,255,0), (0,0,255), (255,255,0), (255,0,255)]
detections_found = 0

if output.shape[2] == 6:  # NMS output format
    print("\nDetections:")
    for i in range(output.shape[1]):
        x1, y1, x2, y2, conf, cls_id = output[0, i]
        if conf < 0.25:  # Skip low confidence
            continue
            
        # Convert class_id to int
        cls_id = int(cls_id)
        if cls_id >= len(class_names):
            continue
            
        # Convert coordinates back to original image
        x1 = (x1 - pad_w) / scale
        y1 = (y1 - pad_h) / scale
        x2 = (x2 - pad_w) / scale
        y2 = (y2 - pad_h) / scale
        
        # Ensure correct ordering of coordinates 
        x1, x2 = min(x1, x2), max(x1, x2)
        y1, y2 = min(y1, y2), max(y1, y2)
        
        # Ensure coordinates are within image bounds
        x1 = max(0, min(w-1, x1))
        y1 = max(0, min(h-1, y1))
        x2 = max(0, min(w-1, x2))
        y2 = max(0, min(h-1, y2))
        
        # Skip invalid detections
        if x2 <= x1 or y2 <= y1:
            continue
        
        # Draw box
        color = colors[cls_id % len(colors)]
        draw.rectangle([x1, y1, x2, y2], outline=color, width=2)
        
        # Draw label - FIXED to prevent coordinates error
        label = f"{class_names[cls_id]} {conf:.2f}"
        text_y = max(0, y1 - 20)  # Ensure text_y is not negative
        text_height = 20
        
        # Draw text background
        draw.rectangle([x1, text_y, x1 + len(label)*8, text_y + text_height], fill=color)
        
        # Draw text
        draw.text([x1+2, text_y+2], label, fill=(255,255,255))
        
        detections_found += 1
        print(f"{detections_found}. {class_names[cls_id]}: {conf*100:.1f}% at [{int(x1)}, {int(y1)}, {int(x2)}, {int(y2)}]")

# Save and show image
result_path = os.path.join(os.path.dirname(image_path), "detection_result.jpg")
img_pil.save(result_path)
print(f"\nResult saved to {result_path}")
print(f"Found {detections_found} clothing items")

# Show image
plt.figure(figsize=(12,8))
plt.imshow(np.array(img_pil))
plt.axis('off')
plt.title(f"Detected {detections_found} items")
plt.show()