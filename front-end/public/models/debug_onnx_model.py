import os
import numpy as np
import cv2
import onnxruntime as ort
from PIL import Image, ImageDraw
import matplotlib.pyplot as plt

def preprocess_image(image_path, input_size=640):
    """Preprocess the image for ONNX model input"""
    # Read image
    img = cv2.imread(image_path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Get original dimensions
    original_height, original_width = img.shape[:2]
    
    # Compute scaling factor to maintain aspect ratio
    scale = min(input_size / original_width, input_size / original_height)
    new_width = int(original_width * scale)
    new_height = int(original_height * scale)
    
    # Resize image
    resized = cv2.resize(img, (new_width, new_height))
    
    # Create black canvas of target size
    canvas = np.zeros((input_size, input_size, 3), dtype=np.uint8)
    
    # Calculate offsets to center the image
    offset_x = (input_size - new_width) // 2
    offset_y = (input_size - new_height) // 2
    
    # Place resized image on canvas
    canvas[offset_y:offset_y+new_height, offset_x:offset_x+new_width] = resized
    
    # Debug: Save preprocessed image to see what the model receives
    cv2.imwrite('preprocessed_input.jpg', canvas)
    
    # Normalize pixel values to [0,1]
    normalized = canvas.astype(np.float32) / 255.0
    
    # Transpose to NCHW format (batch, channels, height, width)
    tensor = np.transpose(normalized, (2, 0, 1))
    tensor = np.expand_dims(tensor, axis=0)
    
    return tensor, original_width, original_height, scale, (offset_x, offset_y)

def main():
    # Get model path - adjust this to your actual model path
    model_path = r"d:\MCA Project\outfit-detect-recs-main\front-end\public\models\best.onnx"
    
    # Clothing classes based on your model
    class_names = [
      'short sleeve top', 'long sleeve top', 'short sleeve outwear',
      'long sleeve outwear', 'vest', 'sling', 'shorts', 'trousers',
      'skirt', 'short sleeve dress', 'long sleeve dress',
      'vest dress', 'sling dress'
    ]
    num_classes = len(class_names)
    
    # Prompt user for image path
    image_path = input("Enter the full path to your test image: ").strip('"')
    
    # Load and preprocess the image
    input_tensor, orig_width, orig_height, scale, offsets = preprocess_image(image_path)
    
    # Load the ONNX model
    print("Loading ONNX model...")
    session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    
    # Get input and output names
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name
    
    print(f"Input name: {input_name}")
    print(f"Output name: {output_name}")
    print(f"Input tensor shape: {input_tensor.shape}")
    
    # Run inference
    print("Running inference...")
    outputs = session.run([output_name], {input_name: input_tensor})
    output = outputs[0]
    
    print(f"Output shape: {output.shape}")
    
    # Dump raw output data for inspection
    print("\nRaw output stats:")
    print(f"Output min value: {np.min(output)}")
    print(f"Output max value: {np.max(output)}")
    print(f"Output mean value: {np.mean(output)}")
    
    # Try with extremely low confidence threshold
    print("\nChecking for ANY detections (confidence > 0.01):")
    
    # Format is [1, 18, 8400]
    if output.shape[1] == 18:
        print("Processing output with shape [1, 18, 8400]")
        
        # Check for any objects
        max_objectness = np.max(output[0, 4, :])
        print(f"Max objectness score: {max_objectness}")
        
        # Look for highest confidence predictions
        top_indices = np.argsort(output[0, 4, :])[-10:]  # Get top 10 confidence scores
        
        print("\nTop 10 potential detections:")
        for idx in reversed(top_indices):
            obj_score = output[0, 4, idx]
            if obj_score > 0.01:  # Very low threshold
                # Get class probabilities 
                class_probs = output[0, 5:, idx]
                class_id = np.argmax(class_probs)
                class_score = class_probs[class_id]
                
                # Get coordinates
                x = output[0, 0, idx]
                y = output[0, 1, idx]
                w = output[0, 2, idx]
                h = output[0, 3, idx]
                
                print(f"Obj score: {obj_score:.4f}, Class: {class_names[class_id]} ({class_score:.4f}), "
                      f"Coords: center=({x:.2f}, {y:.2f}), size=({w:.2f}, {h:.2f})")
                
        # Save the raw values for analysis
        np.save('raw_output.npy', output)
        print("Saved raw output to raw_output.npy for further analysis")
    else:
        print(f"Unexpected output shape: {output.shape}")
    
    print("\nDone debugging model.")

if __name__ == "__main__":
    main()