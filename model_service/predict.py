from flask import Flask, request, jsonify
import joblib
import numpy as np
import pandas as pd

app = Flask(__name__)

# 🔹 Cargar el modelo (desde ruta relativa)
model = joblib.load("modelo.pkl")

# 🔹 Características esperadas
feature_names = ['timestamp', 'analog_value']

@app.route("/predict", methods=["POST"])
def predict():
    try:
        input_data = request.get_json()

        if not input_data:
            raise ValueError("No se recibieron datos de entrada")

        if not isinstance(input_data, list):
            raise ValueError("El formato de entrada debe ser una lista de objetos JSON")

        # Convertir a DataFrame
        input_df = pd.DataFrame(input_data)

        # Validar columnas
        if not all(col in input_df.columns for col in feature_names):
            raise ValueError(f"Faltan columnas esperadas: {feature_names}")

        # Limpiar datos
        input_df['timestamp'] = pd.to_numeric(input_df['timestamp'], errors='coerce')
        input_df = input_df.replace([np.inf, -np.inf], np.nan).dropna(subset=['timestamp'])

        if input_df.empty:
            raise ValueError("Todos los registros tenían timestamp inválido. No se pueden hacer predicciones.")

        input_df['timestamp'] = input_df['timestamp'].astype(np.int64)

        # Hacer la predicción
        prediction = model.predict(input_df).tolist()

        return jsonify({"prediction": prediction})

    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
