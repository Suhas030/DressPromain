# import_amazon_products.py
import json
import re
import pymongo
from pymongo import MongoClient
import argparse
from tqdm import tqdm

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['dressPro']  # Match the existing database case
collection = db['products']

# Create indexes for better performance
collection.create_index([("product_type", 1)])
collection.create_index([("color", 1)])
collection.create_index([("gender", 1)])
collection.create_index([("clothing_class", 1)])
collection.create_index([("title", "text")])

# Mappings for clothing types to normalized categories
CLOTHING_TYPE_MAP = {
    'shirt': ['shirt', 'button', 'oxford', 'dress shirt', 'formal shirt'],
    't-shirt': ['t-shirt', 'tee', 'tshirt', 't shirt', 'graphic tee'],
    'tank top': ['tank', 'sleeveless', 'camisole'],
    'blouse': ['blouse', 'tunic', 'women\'s top'],
    'sweatshirt': ['sweatshirt', 'hoodie', 'pullover'],
    'jacket': ['jacket', 'coat', 'blazer', 'outerwear'],
    'sweater': ['sweater', 'jumper', 'cardigan', 'knit'],
    'pants': ['pants', 'trousers', 'slacks', 'chinos'],
    'jeans': ['jeans', 'denim pants'],
    'shorts': ['shorts', 'short pants'],
    'skirt': ['skirt'],
    'dress': ['dress', 'gown'],
    'socks': ['socks', 'hosiery'],
    'underwear': ['underwear', 'boxers', 'briefs', 'panties']
}

# Map normalized clothing types to model detection classes
CLOTHING_CLASS_MAP = {
    'shirt': 'long sleeve top',
    't-shirt': 'short sleeve top',
    'tank top': 'sleeveless top',
    'blouse': 'long sleeve top',
    'sweatshirt': 'long sleeve top',
    'jacket': 'long sleeve outwear',
    'sweater': 'long sleeve top',
    'pants': 'trousers',
    'jeans': 'trousers',
    'shorts': 'shorts',
    'skirt': 'skirt',
    'dress': 'long sleeve dress'
}

# Common colors for normalization
COLOR_MAP = {
    'black': ['black', 'noir'],
    'white': ['white', 'ivory', 'cream', 'off-white'],
    'gray': ['gray', 'grey', 'charcoal', 'heather', 'silver'],
    'red': ['red', 'burgundy', 'maroon', 'crimson', 'scarlet'],
    'blue': ['blue', 'navy', 'teal', 'turquoise', 'aqua', 'cobalt'],
    'green': ['green', 'olive', 'lime', 'emerald', 'mint'],
    'yellow': ['yellow', 'gold', 'mustard', 'lemon'],
    'pink': ['pink', 'rose', 'magenta', 'fuchsia'],
    'purple': ['purple', 'violet', 'lavender', 'plum', 'mauve'],
    'orange': ['orange', 'coral', 'peach'],
    'brown': ['brown', 'tan', 'khaki', 'beige', 'camel']
}

def detect_product_type(title):
    """Detect product type from title"""
    title_lower = title.lower()
    
    for product_type, keywords in CLOTHING_TYPE_MAP.items():
        for keyword in keywords:
            if keyword.lower() in title_lower:
                return product_type
    
    return 'other'

def detect_color(title):
    """Detect color from title"""
    title_lower = title.lower()
    
    for color, keywords in COLOR_MAP.items():
        for keyword in keywords:
            # Use word boundary to avoid partial matches
            pattern = r'\b{}\b'.format(keyword)
            if re.search(pattern, title_lower):
                return color
    
    return 'unknown'

def detect_gender(title):
    """Detect gender from title"""
    title_lower = title.lower()
    
    if re.search(r'\bmen\'?s\b|\bman\b|\bgentleman\b', title_lower):
        return 'men'
    elif re.search(r'\bwomen\'?s\b|\bwoman\b|\bwomens\b|\bladies\b|\blady\b', title_lower):
        return 'women'
    elif re.search(r'\bboy\'?s\b|\bboys\b', title_lower):
        return 'boys'
    elif re.search(r'\bgirl\'?s\b|\bgirls\b', title_lower):
        return 'girls'
    else:
        return 'unisex'

def get_image_url(images):
    """Extract best image URL from images array"""
    if not images or len(images) == 0:
        return "https://via.placeholder.com/500x600?text=No+Image"
    
    # Prefer hi_res images
    for img in images:
        if 'hi_res' in img and img['hi_res']:
            return img['hi_res']
    
    # Fallback to large
    for img in images:
        if 'large' in img and img['large']:
            return img['large']
            
    # Last resort
    return images[0].get('thumb', "https://via.placeholder.com/500x600?text=No+Image")

def get_price(price):
    """Process price data"""
    if price and isinstance(price, (int, float)):
        return float(price)
    return 29.99  # Default price

def process_file(filename, batch_size=100):
    """Process Amazon dataset file and import to MongoDB"""
    products = []
    count = 0
    fashion_count = 0
    
    print(f"Processing file: {filename}")
    
    with open(filename, 'r', encoding='utf-8') as f:
        for line in tqdm(f):
            try:
                # Parse JSON line
                product = json.loads(line)
                
                # Filter non-fashion items
                if 'main_category' not in product or product['main_category'] != "AMAZON FASHION":
                    continue
                
                fashion_count += 1
                
                # Extract product info
                title = product.get('title', '')
                if not title:
                    continue
                
                # Detect attributes
                product_type = detect_product_type(title)
                if product_type == 'other':  # Skip non-clothing items
                    continue
                
                # Get clothing class that matches your detection model
                clothing_class = CLOTHING_CLASS_MAP.get(product_type, 'other')
                
                # Create transformed product
                transformed_product = {
                    'title': title,
                    'main_category': product.get('main_category', ''),
                    'product_type': product_type,
                    'clothing_class': clothing_class,
                    'color': detect_color(title),
                    'gender': detect_gender(title),
                    'price': get_price(product.get('price')),
                    'average_rating': product.get('average_rating', 0),
                    'rating_count': product.get('rating_number', 0),
                    'image_url': get_image_url(product.get('images', [])),
                    'product_url': f"https://amazon.com/dp/{product.get('parent_asin', '404')}" if product.get('parent_asin') else '#',
                    'brand': product.get('store', ''),
                    'details': product.get('details', {})
                }
                
                products.append(transformed_product)
                count += 1
                
                # Insert in batches
                if len(products) >= batch_size:
                    collection.insert_many(products)
                    products = []
                    print(f"Inserted {count} products so far")
                
            except json.JSONDecodeError:
                continue
            except Exception as e:
                print(f"Error processing line: {str(e)}")
                continue
    
    # Insert remaining products
    if products:
        collection.insert_many(products)
    
    print(f"Completed! Found {fashion_count} fashion items, imported {count} products")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Import Amazon fashion data to MongoDB')
    parser.add_argument('--file', required=True, help='Amazon dataset JSON file')
    parser.add_argument('--batch', type=int, default=100, help='Batch size for insertion')
    
    args = parser.parse_args()
    process_file(args.file, args.batch)