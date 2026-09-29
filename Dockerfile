FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY SIH/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source code
COPY SIH/ ./

# Render sets PORT dynamically
EXPOSE 10000

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
