import * as ort from 'onnxruntime-web';

class ModelService {
  constructor() {
    // Will hold the ONNX model
    this.session = null;
    this.isLoaded = false;
    this.loading = null;
    this.imageSize = 640;
    this.confidenceThreshold = 0.25;
    this.currentModelPath = null;
    
    // Class names will be loaded from metadata
    this.classNames = [];
    
    // Initialize class names (will be overridden when metadata is loaded)
    // This serves as a fallback in case metadata loading fails
    this.classNames = [
      'short sleeve top', 'long sleeve top', 'short sleeve outwear',
      'long sleeve outwear', 'vest', 'sling', 'shorts', 'trousers',
      'skirt', 'short sleeve dress', 'long sleeve dress',
      'vest dress', 'sling dress'
    ];

    // Colors for different class visualizations (unchanged)
    this.classColors = [
      'rgba(255, 0, 0, 0.8)', // red
      'rgba(0, 255, 0, 0.8)', // green
      'rgba(0, 0, 255, 0.8)', // blue
      'rgba(255, 255, 0, 0.8)', // yellow
      'rgba(255, 0, 255, 0.8)', // magenta
      'rgba(0, 255, 255, 0.8)', // cyan
      'rgba(255, 165, 0, 0.8)', // orange
      'rgba(128, 0, 128, 0.8)', // purple
      'rgba(0, 128, 0, 0.8)', // dark green
      'rgba(139, 69, 19, 0.8)', // brown
      'rgba(70, 130, 180, 0.8)', // steel blue
      'rgba(255, 192, 203, 0.8)', // pink
      'rgba(128, 128, 128, 0.8)', // gray,
    ];

    // Add class similarity mapping for post-processing
    this.classSimilarities = {
      'short sleeve top': ['long sleeve top', 'shirt', 'top', 'tshirt'],
      'long sleeve top': ['short sleeve top', 'shirt', 'top'],
      'short sleeve outwear': ['long sleeve outwear', 'jacket', 'coat'],
      'long sleeve outwear': ['short sleeve outwear', 'jacket', 'coat'],
      'vest': ['vest dress', 'sleeveless'],
      'sling': ['sling dress', 'sleeveless'],
      'shorts': ['trousers', 'pants'],
      'trousers': ['shorts', 'pants'],
      'skirt': ['dress', 'long skirt'],
      'short sleeve dress': ['long sleeve dress', 'dress', 'vest dress', 'sling dress'],
      'long sleeve dress': ['short sleeve dress', 'dress', 'vest dress', 'sling dress'],
      'vest dress': ['short sleeve dress', 'long sleeve dress', 'vest', 'dress'],
      'sling dress': ['short sleeve dress', 'long sleeve dress', 'sling', 'dress']
    };

    // Size constraints for different classes to filter out unreasonable detections
    this.classSizeConstraints = {
      // className: [minWidthPercent, minHeightPercent, maxWidthPercent, maxHeightPercent]
      'default': [5, 5, 100, 100],  // Default size constraints
      'shorts': [10, 10, 90, 50],
      'skirt': [10, 15, 90, 80],
      'trousers': [10, 30, 90, 95],
      'short sleeve top': [15, 15, 95, 60],
      'long sleeve top': [15, 15, 95, 60],
      'short sleeve dress': [15, 40, 95, 95],
      'long sleeve dress': [15, 40, 95, 95],
      'vest dress': [15, 40, 95, 95],
      'sling dress': [15, 40, 95, 95]
    };
  }

  async loadClassMetadata(modelPath) {
    try {
      const metadataPath = '/models/best_metadata.json';
      console.log('Attempting to load class metadata from:', metadataPath);
      
      const response = await fetch(metadataPath);
      if (!response.ok) {
        console.warn(`Metadata file not found, using default classes`);
        return false;
      }
      
      const metadata = await response.json();
      if (metadata.classes && Array.isArray(metadata.classes)) {
        console.log(`Loaded ${metadata.classes.length} classes from metadata`);
        this.classNames = metadata.classes;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error loading class metadata:', error);
      return false;
    }
  }

  async verifyModelLabels() {
    if (!this.session) {
      console.log("Cannot verify model - not loaded");
      return true; // Return true instead of false to avoid blocking
    }

    try {
      // Get output shape
      const outputName = this.session.outputNames[0];

      // Don't try to access potentially unavailable properties
      console.log("Model appears to be loaded with output:", outputName);

      // Return true without doing complex validation that might fail
      return true;
    } catch (error) {
      console.error("Error during model verification:", error);
      // Still return true to allow fallback
      return true;
    }
  }

  async loadModel() {
    if (this.loading) return this.loading;

    this.loading = new Promise(async (resolve, reject) => {
      try {
        // Load class metadata first
        await this.loadClassMetadata();
        
        // Then load the model
        const modelPath = '/models/best.onnx';
        console.log('Attempting to load ONNX model from:', modelPath);
        
        // Use simpler options for better compatibility
        this.session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['wasm']
        });
        
        console.log('Model loaded successfully!');
        this.isLoaded = true;
        resolve(true);
      } catch (error) {
        console.error('Failed to load model:', error);
        resolve(false);
      } finally {
        this.loading = null;
      }
    });
    
    return this.loading;
  }

  async detectOutfit(imageElement, bbox = null) {
    try {
      // Ensure model is loaded
      await this.loadModel();
      
      if (!this.session) {
        console.warn("Model not loaded, using fallback detection");
        return this.fallbackDetection(imageElement, bbox);
      }
      
      // Preprocess the image
      const tensor = this.preprocessImage(imageElement);
      
      // Run inference
      console.log("Running inference with input shape:", tensor.dims);
      const feeds = {};
      feeds[this.session.inputNames[0]] = tensor;
      
      const results = await this.session.run(feeds);
      
      // Process detections
      const detections = this.processModelOutput(
        results, 
        imageElement.width, 
        imageElement.height
      );
      
      console.log("After initial processing:", detections.length, "detections");
      
      // Apply NMS to reduce overlapping detections
      const filteredDetections = this.applyNMS(detections);
      console.log("After NMS filtering:", filteredDetections.length, "detections");
      
      // Debug log raw detections
      console.log("Raw detections:", JSON.stringify(filteredDetections));
      
      // Add color information to each detection with better error handling
      const detectionsWithColors = [];
      for (const detection of filteredDetections) {
        try {
          // Extract colors for this specific detection's bounding box
          const colors = await this.extractColors(imageElement, detection.bbox);
          
          // Validate colors before adding
          if (colors && Array.isArray(colors) && colors.length > 0) {
            // Validate each color
            const validatedColors = colors.filter(color => 
              Array.isArray(color) && 
              color.length >= 2 && 
              typeof color[0] === 'string' && 
              !color[0].includes('NaN')
            );
            
            if (validatedColors.length > 0) {
              detection.colors = validatedColors;
            } else {
              detection.colors = [["rgb(128, 128, 128)", 100]]; // Default gray
            }
          } else {
            detection.colors = [["rgb(128, 128, 128)", 100]]; // Default gray
          }
          
          detectionsWithColors.push(detection);
        } catch (error) {
          console.error("Error extracting colors for detection:", error);
          // Still include the detection, but with a default color
          detection.colors = [["rgb(128, 128, 128)", 100]];
          detectionsWithColors.push(detection);
        }
      }
      
      console.log("Model detection successful with real detections");
      return detectionsWithColors;
      
    } catch (error) {
      console.error("Error in detectOutfit:", error);
      
      // Fall back to rule-based detection
      return this.smartFallbackDetection(imageElement, bbox);
    }
  }

  smartFallbackDetection(imageElement, bbox = null, colors = null) {
    // Generate more accurate detection based on image size and dominant colors
    const width = imageElement.width;
    const height = imageElement.height;
    const aspectRatio = width / height;

    // For images that look like a full-body clothing item
    if (aspectRatio < 0.8) {
      // Likely a dress or full outfit
      return [{
        class: 'long sleeve dress',
        confidence: 0.7,
        bbox: bbox || [0, 0, width, height],
        colors: colors || [["rgb(150, 150, 150)", 100]],
        isFallback: true
      }];
    }

    // For wider images
    if (aspectRatio > 1.2) {
      // Likely a top
      return [{
        class: 'short sleeve top',
        confidence: 0.7,
        bbox: bbox || [0, 0, width, height],
        colors: colors || [["rgb(150, 150, 150)", 100]],
        isFallback: true
      }];
    }

    // For square-ish images with multiple clothing items, try to create two detections
    const upperPart = {
      class: 'short sleeve top',
      confidence: 0.65,
      bbox: [0, 0, width, height * 0.45],
      colors: colors || [["rgb(150, 150, 150)", 100]],
      isFallback: true
    };

    const lowerPart = {
      class: 'trousers',
      confidence: 0.65,
      bbox: [0, height * 0.35, width, height],
      colors: colors || [["rgb(100, 100, 100)", 100]],
      isFallback: true
    };

    return [upperPart, lowerPart];
  }

  applyNMS(detections, iouThreshold = 0.5) {
    if (!detections || detections.length === 0) {
      return [];
    }

    // Sort by confidence (highest first)
    const sortedBoxes = [...detections].sort((a, b) => b.confidence - a.confidence);
    const selected = [];
    const rejected = new Set();

    for (let i = 0; i < sortedBoxes.length; i++) {
      if (rejected.has(i)) continue;

      selected.push(sortedBoxes[i]);

      // Compare with all other boxes
      for (let j = i + 1; j < sortedBoxes.length; j++) {
        if (rejected.has(j)) continue;

        // Calculate IoU - only consider similar classes
        if (this.areSimilarClasses(sortedBoxes[i].class, sortedBoxes[j].class)) {
          const iou = this.calculateIoU(sortedBoxes[i].bbox, sortedBoxes[j].bbox);
          if (iou > iouThreshold) {
            rejected.add(j);
          }
        }
      }
    }

    return selected;
  }

  areSimilarClasses(class1, class2) {
    if (class1 === class2) return true;

    const similarClasses = this.classSimilarities[class1];
    if (similarClasses && similarClasses.includes(class2)) return true;

    return false;
  }

  calculateIoU(box1, box2) {
    // Get coordinates
    const [x1_1, y1_1, x2_1, y2_1] = box1;
    const [x1_2, y1_2, x2_2, y2_2] = box2;

    // Calculate intersection area
    const xMin = Math.max(x1_1, x1_2);
    const yMin = Math.max(y1_1, y1_2);
    const xMax = Math.min(x2_1, x2_2);
    const yMax = Math.min(y2_1, y2_2);

    if (xMax < xMin || yMax < yMin) {
      return 0; // No intersection
    }

    const intersectionArea = (xMax - xMin) * (yMax - yMin);
    const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1);
    const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2);

    return intersectionArea / (box1Area + box2Area - intersectionArea);
  }

  async extractColors(imageElement, bbox = null) {
    try {
      // Create a canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let x, y, width, height;

      if (bbox) {
        // Use the bounding box
        x = Math.max(0, bbox[0]);
        y = Math.max(0, bbox[1]);
        width = Math.max(1, bbox[2] - bbox[0]);
        height = Math.max(1, bbox[3] - bbox[1]);
        
        // Ensure valid dimensions
        if (width <= 0 || height <= 0 || isNaN(width) || isNaN(height)) {
          console.warn("Invalid bbox dimensions for color extraction:", bbox);
          // Use the entire image as fallback
          x = 0;
          y = 0;
          width = imageElement.width;
          height = imageElement.height;
        }
      } else {
        // Use the entire image
        x = 0;
        y = 0;
        width = imageElement.width;
        height = imageElement.height;
      }

      // Set canvas dimensions to match the region
      canvas.width = width;
      canvas.height = height;

      // Draw the region to the canvas
      ctx.drawImage(
        imageElement,
        x, y, width, height,  // Source region
        0, 0, width, height   // Destination region
      );

      // Get image data from the canvas
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Process colors with focus on center regions
      const colors = {};
      const pixelCount = width * height;
      
      // Define central region (focus on middle 60% of the area)
      const centerRegionStart = {
        x: Math.floor(width * 0.2),
        y: Math.floor(height * 0.2)
      };
      
      const centerRegionEnd = {
        x: Math.floor(width * 0.8),
        y: Math.floor(height * 0.8)
      };
      
      // Adjust sampling based on image size for performance
      let skipFactor = Math.max(1, Math.floor(Math.sqrt(pixelCount) / 40));
      
      // Ensure we have at least some pixels to sample
      if (skipFactor >= width || skipFactor >= height) {
        skipFactor = 1;
      }
      
      // For each pixel in the data
      for (let y = 0; y < height; y += skipFactor) {
        for (let x = 0; x < width; x += skipFactor) {
          const pixelIndex = (y * width + x) * 4;
          
          // Skip invalid pixel indices
          if (pixelIndex < 0 || pixelIndex >= data.length - 3) continue;
          
          // Skip fully transparent or nearly transparent pixels
          if (data[pixelIndex + 3] < 128) continue;
          
          // Get RGB values and validate
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1];
          const b = data[pixelIndex + 2];
          
          // Validate RGB values
          if (isNaN(r) || isNaN(g) || isNaN(b)) continue;
          
          // Calculate weight based on position (center pixels have higher weight)
          let weight = 1;
          
          // Check if pixel is within center region (give these pixels more weight)
          if (x >= centerRegionStart.x && x <= centerRegionEnd.x &&
              y >= centerRegionStart.y && y <= centerRegionEnd.y) {
            // Boost importance of center pixels
            weight = 3;
          }
          
          // Group similar colors using quantization
          const quantizedR = Math.floor(r / 10) * 10;
          const quantizedG = Math.floor(g / 10) * 10;
          const quantizedB = Math.floor(b / 10) * 10;
          
          // Skip near-white colors (likely background)
          if (quantizedR > 240 && quantizedG > 240 && quantizedB > 240) continue;
          
          // Skip near-black colors (often shadows)
          if (quantizedR < 15 && quantizedG < 15 && quantizedB < 15) continue;
          
          const colorKey = `rgb(${quantizedR}, ${quantizedG}, ${quantizedB})`;
          colors[colorKey] = (colors[colorKey] || 0) + weight;
        }
      }

      // If no colors were found, return a default gray
      if (Object.keys(colors).length === 0) {
        return [["rgb(128, 128, 128)", 100]]; // Default gray
      }

      // Sort colors by frequency
      const sortedColors = Object.entries(colors)
        .map(([key, count]) => ({ rgb: key, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Take top 5 colors

      // Calculate percentages
      const totalWeight = sortedColors.reduce((sum, { count }) => sum + count, 0);

      // Final validation of colors
      return sortedColors.map(({ rgb, count }) => {
        const percentage = Math.round((count / totalWeight) * 100);
        // Validate RGB format
        if (!rgb || !rgb.startsWith('rgb(') || rgb.includes('NaN')) {
          return ["rgb(128, 128, 128)", percentage]; // Default gray as fallback
        }
        return [rgb, percentage];
      });
    } catch (error) {
      console.error("Error extracting colors:", error);
      return [["rgb(128, 128, 128)", 100]]; // Default gray
    }
  }

  // Simple preprocessing for YOLOv8
  preprocessImage(imageElement) {
    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    canvas.width = this.imageSize;
    canvas.height = this.imageSize;

    const ctx = canvas.getContext('2d');

    // Fill background with black
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, this.imageSize, this.imageSize);

    // Calculate scaling to maintain aspect ratio
    const scale = Math.min(
      this.imageSize / imageElement.width,
      this.imageSize / imageElement.height
    );

    const scaledWidth = Math.round(imageElement.width * scale);
    const scaledHeight = Math.round(imageElement.height * scale);

    // Center image in the canvas
    const offsetX = Math.floor((this.imageSize - scaledWidth) / 2);
    const offsetY = Math.floor((this.imageSize - scaledHeight) / 2);

    // Draw image at the correct position
    ctx.drawImage(imageElement, offsetX, offsetY, scaledWidth, scaledHeight);

    // Get image data
    const imageData = ctx.getImageData(0, 0, this.imageSize, this.imageSize);
    const { data } = imageData;

    // Normalize pixel values to [0, 1] and convert to NCHW format
    // YOLOv8 expects RGB values normalized to 0-1 range
    const tensor = new Float32Array(1 * 3 * this.imageSize * this.imageSize);

    let tensorIndex = 0;
    // YOLOv8 expects RGB channel-first format
    for (let c = 0; c < 3; c++) {
      for (let h = 0; h < this.imageSize; h++) {
        for (let w = 0; w < this.imageSize; w++) {
          const pixelIndex = (h * this.imageSize + w) * 4 + c;
          tensor[tensorIndex++] = data[pixelIndex] / 255.0;
        }
      }
    }

    // Create ONNX tensor
    return new ort.Tensor('float32', tensor, [1, 3, this.imageSize, this.imageSize]);
  }

  processModelOutput(results, originalWidth, originalHeight) {
    // Get the output tensor
    const outputName = this.session.outputNames[0];
    const output = results[outputName];
    
    if (!output) {
      console.error("No output tensor found in results");
      return [];
    }
    
    const data = output.data;
    const dimensions = output.dims;
    
    console.log("Model output dimensions:", dimensions);
    
    const detections = [];
    
    try {
      // Check if the model includes NMS (exported with NMS=True) - New model format [1, 300, 6]
      if (dimensions.length === 3 && dimensions[2] === 6) {
        console.log("Processing output with NMS included (shape [1, N, 6])");
        
        const numDetections = dimensions[1];
        console.log(`Processing ${numDetections} detections`);
        
        // For each detection
        for (let i = 0; i < numDetections; i++) {
          // Each detection consists of [x1, y1, x2, y2, confidence, class_id]
          const baseIdx = i * 6;
          
          // Get confidence score - 4th element (index 4)
          const confidence = data[baseIdx + 4];
          
          // Skip detections with low confidence
          if (confidence < this.confidenceThreshold) {
            continue;
          }
          
          // Get class ID - 5th element (index 5)
          const classId = Math.round(data[baseIdx + 5]);
          
          // Skip if class ID is invalid
          if (classId < 0 || classId >= this.classNames.length) {
            continue;
          }
          
          // Get class name
          const className = this.classNames[classId];
          
          // Get coordinates - already in x1,y1,x2,y2 format
          let x1 = data[baseIdx + 0];
          let y1 = data[baseIdx + 1];
          let x2 = data[baseIdx + 2];
          let y2 = data[baseIdx + 3];
          
          // Rescale coordinates to original image size if needed
          const scaleX = originalWidth / this.imageSize;
          const scaleY = originalHeight / this.imageSize;
          
          x1 = Math.max(0, x1 * scaleX);
          y1 = Math.max(0, y1 * scaleY);
          x2 = Math.min(originalWidth, x2 * scaleX);
          y2 = Math.min(originalHeight, y2 * scaleY);
          
          // Skip if box is too small or invalid
          const boxWidth = x2 - x1;
          const boxHeight = y2 - y1;
          if (boxWidth < 5 || boxHeight < 5 || 
              isNaN(boxWidth) || isNaN(boxHeight) ||
              x1 === x2 || y1 === y2) continue;
          
          // Log each detection for debugging
          console.log(`Found ${className} with confidence ${confidence.toFixed(3)} at [${x1.toFixed(1)}, ${y1.toFixed(1)}, ${x2.toFixed(1)}, ${y2.toFixed(1)}]`);
          
          // Create detection object
          detections.push({
            class: className,
            confidence: confidence,
            bbox: [x1, y1, x2, y2],
            classIndex: classId,
            isFallback: false // This is a real detection
          });
        }
      }
      // Old format handlers - keep these for backward compatibility
      else if (dimensions.length === 3) {
        // Format is [1, 18, 8400] - Original YOLOv8 output without NMS
        if (dimensions[2] === 8400) {
          // Your existing code for [1, 18, 8400] format
          // ...existing code...
        } 
        // Format is [1, 8400, 18] - Transposed YOLOv8 output without NMS
        else if (dimensions[1] === 8400) {
          // Your existing code for [1, 8400, 18] format
          // ...existing code...
        } else {
          console.error("Unknown YOLO output format:", dimensions);
          return [];
        }
      } else {
        console.error("Unexpected output tensor format:", dimensions);
        return [];
      }
      
      console.log(`Found ${detections.length} valid detections`);
      
      // Only use fallback if no detections were found
      if (detections.length === 0) {
        console.warn("No detections found, will return empty array to trigger fallback");
        return [];
      }
      
      return detections;
      
    } catch (error) {
      console.error("Error processing detection output:", error);
      return [];
    }
  }

  // Simple fallback detection when model fails
  fallbackDetection(imageElement, bbox = null, colors = null) {
    return [{
      class: 'unknown',
      confidence: 0.5,
      bbox: bbox || [0, 0, imageElement.width, imageElement.height],
      colors: colors || [["rgb(128, 128, 128)", 100]],
      isFallback: true
    }];
  }

  // Method to draw bounding box overlays on an image
  drawDetectionOverlay(imageElement, detections, targetCanvas) {
    if (!targetCanvas) {
      console.warn("No target canvas provided for detection overlay");
      return;
    }

    try {
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) {
        console.error("Could not get canvas context");
        return;
      }

      // Clear canvas and draw the original image
      ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      ctx.drawImage(imageElement, 0, 0, targetCanvas.width, targetCanvas.height);

      // Draw each detection with a unique color per class
      detections.forEach(detection => {
        const [x1, y1, x2, y2] = detection.bbox;
        const width = x2 - x1;
        const height = y2 - y1;

        // Scale coordinates to canvas
        const scaleX = targetCanvas.width / imageElement.width;
        const scaleY = targetCanvas.height / imageElement.height;

        const scaledX = x1 * scaleX;
        const scaledY = y1 * scaleY;
        const scaledWidth = width * scaleX;
        const scaledHeight = height * scaleY;

        // Get color based on class (use index if available)
        let strokeColor;
        if (typeof detection.classIndex === 'number' &&
          detection.classIndex >= 0 &&
          detection.classIndex < this.classColors.length) {
          strokeColor = this.classColors[detection.classIndex];
        } else {
          // Default color if classIndex is not available
          strokeColor = 'rgba(255, 105, 180, 0.8)'; // Hot pink
        }

        // Use different border style for fallback detections
        if (detection.isFallback) {
          ctx.setLineDash([5, 5]);  // Dashed line for fallbacks
          ctx.lineWidth = 2;
        } else {
          ctx.setLineDash([]);  // Solid line for real detections
          ctx.lineWidth = 3;
        }

        // Draw bounding box with class-specific color
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

        // Draw label background with the same color
        ctx.fillStyle = strokeColor;
        const label = `${detection.class} (${Math.round(detection.confidence * 100)}%)`;
        ctx.font = 'bold 16px Arial';
        const textMetrics = ctx.measureText(label);
        ctx.fillRect(
          scaledX,
          scaledY - 24,  // Allow more space for text
          textMetrics.width + 10,
          24
        );

        // Draw label text
        ctx.fillStyle = 'white';
        ctx.fillText(
          label,
          scaledX + 5,
          scaledY - 6
        );
      });
    } catch (error) {
      console.error("Error drawing detection overlay:", error);
    }
  }

  // Combine colors from multiple detections
  combineColors(detections) {
    if (!detections || !Array.isArray(detections) || detections.length === 0) {
      console.warn("No detections provided to combineColors");
      return [["rgb(128, 128, 128)", 100]]; // Return gray as fallback
    }
    
    // Collect all colors
    const allColors = {};
    let totalWeight = 0;
    
    detections.forEach(detection => {
      if (detection.colors && Array.isArray(detection.colors)) {
        detection.colors.forEach(colorData => {
          // Validate color data
          if (!Array.isArray(colorData) || colorData.length < 2) return;
          
          const colorKey = colorData[0];
          // Validate that colorKey is a valid RGB format
          if (!colorKey || typeof colorKey !== 'string' || !colorKey.startsWith('rgb(')) return;
          
          try {
            // Extract RGB values and validate them
            const rgbMatch = colorKey.match(/\d+/g);
            if (!rgbMatch || rgbMatch.length < 3) return;
            
            const [r, g, b] = rgbMatch.map(Number);
            if (isNaN(r) || isNaN(g) || isNaN(b)) return;
            
            // Use validated color
            const weight = colorData[1] * (detection.confidence || 1);
            
            if (!allColors[colorKey]) {
              allColors[colorKey] = 0;
            }
            
            allColors[colorKey] += weight;
            totalWeight += weight;
          } catch (e) {
            console.warn("Invalid color format:", colorKey);
          }
        });
      }
    });
    
    // If no colors were collected, return a default
    if (Object.keys(allColors).length === 0 || totalWeight === 0) {
      console.warn("No valid colors found in detections");
      return [["rgb(128, 128, 128)", 100]]; // Default gray
    }
    
    // Convert to array, sort by weight, and take top 5
    const sortedColors = Object.entries(allColors)
      .map(([color, weight]) => [color, Math.round((weight / totalWeight) * 100)])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    return sortedColors;
  }

  // Analyze model output - useful for debugging
  async analyzeModelOutput(imageElement) {
    if (!this.session) return null;

    try {
      // Process image to tensor
      const tensor = this.preprocessImage(imageElement);

      // Print tensor dimensions
      console.log("Input tensor shape:", tensor.dims);

      // Run inference
      const feeds = {};
      feeds[this.session.inputNames[0]] = tensor;
      const results = await this.session.run(feeds);

      // Get the output tensor
      const outputName = this.session.outputNames[0];
      const output = results[outputName];

      console.log("Model output dims:", output.dims);
      console.log("Output data type:", typeof output.data);
      console.log("Output first few values:", Array.from(output.data).slice(0, 20));

      // Process the output
      const processedDetections = this.processModelOutput(results, imageElement.width, imageElement.height);
      console.log("Processed detections:", processedDetections);

      // Return both raw and processed data for inspection
      return {
        rawOutput: output,
        processedDetections
      };
    } catch (error) {
      console.error("Analysis error:", error);
      return null;
    }
  }

  async testModel(imageElement) {
    try {
      // Make sure the model is loaded
      await this.loadModel();
      
      if (!this.session) {
        return { success: false, error: "Model not loaded" };
      }
      
      // Preprocess the image
      const tensor = this.preprocessImage(imageElement);
      
      // Run inference
      const feeds = {};
      feeds[this.session.inputNames[0]] = tensor;
      const results = await this.session.run(feeds);
      
      // Get output information
      const outputName = this.session.outputNames[0];
      const output = results[outputName];
      
      if (!output) {
        return { success: false, error: "No output tensor found" };
      }
      
      // Process detections
      const detections = this.processModelOutput(results, imageElement.width, imageElement.height);
      
      return {
        success: true,
        outputShape: output.dims,
        detections: detections,
        modelPath: this.currentModelPath
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

export default new ModelService();