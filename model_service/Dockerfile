# Imagen base
FROM python:3.11

WORKDIR /app

# Copiar archivos y requisitos
COPY modelo.pkl .
COPY predict.py .
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 5000

CMD ["python", "predict.py"]
