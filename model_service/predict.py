import sys
import json
import joblib
import numpy as np
import pandas as pd

# 🔹 Cargar el modelo
model = joblib.load('modelo.pkl')

# 🔹 Características esperadas
feature_names = ['timestamp', 'analog_value']

try:
    input_data = sys.stdin.read().strip()

    if not input_data:
        raise ValueError("No se recibieron datos de entrada")

    # 🔹 Convertir JSON a lista de registros
    input_list = json.loads(input_data)

    if not isinstance(input_list, list):
        raise ValueError("El formato de entrada debe ser una lista de objetos JSON")

    # 🔹 Convertir a DataFrame
    input_df = pd.DataFrame(input_list)

    # 🔹 Verificar si las columnas esperadas están presentes
    if not all(col in input_df.columns for col in feature_names):
        raise ValueError(f"Faltan columnas esperadas: {feature_names}")


    # Convertir timestamp a número y eliminar valores inválidos
    input_df['timestamp'] = pd.to_numeric(input_df['timestamp'], errors='coerce')

    # Eliminar filas con NaN o valores infinitos antes de convertir a int64
    input_df = input_df.replace([np.inf, -np.inf], np.nan).dropna(subset=['timestamp'])

    if input_df.empty:
        raise ValueError("Todos los registros tenían timestamp inválido. No se pueden hacer predicciones.")

    # Convertir a int64 después de validar
    input_df['timestamp'] = input_df['timestamp'].astype(np.int64)



    # 🔹 Hacer la predicción
    prediction = model.predict(input_df).tolist()

    # 🔹 Enviar resultado
    print(json.dumps({"prediction": prediction}))

except Exception as e:
    print(json.dumps({"error predict": str(e)}))
