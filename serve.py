from src.transcriber import app
from flask import send_from_directory, send_file
import os
import mimetypes

# Get the absolute path to the static directory
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))

# Add common mime types
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/x-icon', '.ico')
mimetypes.add_type('application/manifest+json', '.webmanifest')

# Serve static files and handle React routing
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    print("handling path: ", path)
    # Handle API routes first
    if path.startswith('auth/') or path.startswith('api/'):
        if path in app.view_functions:
            return app.view_functions[path]()
        return 'Not Found', 404

    # Try to serve static files
    if path:
        file_path = os.path.join(STATIC_DIR, path)
        if os.path.isfile(file_path):
            # Get the correct mimetype for the file
            mimetype = mimetypes.guess_type(file_path)[0]
            print("getting static element", path)
            return send_from_directory(STATIC_DIR, path, mimetype=mimetype)
        
        # Handle known React routes
        if path in ['upload', 'login', 'profile', '']:
            return send_file(os.path.join(STATIC_DIR, 'index.html'))

    # Default: serve index.html for all other routes
    try:
        return send_file(os.path.join(STATIC_DIR, 'index.html'))
    except Exception as e:
        print(f"Error serving file: {e}")
        print(f"Current directory: {os.getcwd()}")
        print(f"Static directory: {STATIC_DIR}")
        print(f"Files in static: {os.listdir(STATIC_DIR) if os.path.exists(STATIC_DIR) else 'Directory not found'}")
        return str(e), 500

if __name__ == '__main__':
    # Print debug info on startup
    print(f"Current directory: {os.getcwd()}")
    print(f"Static directory: {STATIC_DIR}")
    if os.path.exists(STATIC_DIR):
        print(f"Static files found:")
        for root, dirs, files in os.walk(STATIC_DIR):
            level = root.replace(STATIC_DIR, '').count(os.sep)
            indent = ' ' * 4 * level
            print(f"{indent}{os.path.basename(root)}/")
            subindent = ' ' * 4 * (level + 1)
            for f in files:
                print(f"{subindent}{f}")
    else:
        print("Static directory not found")
    
    app.run(host='0.0.0.0', port=8000) 