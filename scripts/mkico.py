from PIL import Image
from pathlib import Path

# Load uploaded image
img = Image.open('icon-512.png').convert('RGBA')

# Define ICO sizes
sizes = [(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)]

# Output path
ico_path = Path('octile.ico')

# Save as .ico with multiple sizes
img.save(ico_path, format='ICO', sizes=sizes)

ico_path
