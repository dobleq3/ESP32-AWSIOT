const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const fs = require('fs');
const { spawn } = require('child_process');
const axios = require("axios");
require('dotenv').config();
require('./connectDB');

const app = express();
const port = process.env.PORT || 3200;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Static files
app.set(__dirname);
app.use(express.static(path.resolve(__dirname, './public/')));

// Definir el esquema y modelo de Mongoose
const sensorDataSchema = new mongoose.Schema({
  client_id: { type: String, required: true },
  analog_value: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Configuración para eliminar automáticamente `__v` y `_id` si es necesario
sensorDataSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const db_sensors = mongoose.model('db_sensors', sensorDataSchema);


// Rutas para datos históricos de sensores
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'WELCOME API SENSOR MONITORING',
  });
});


app.get('/api/sensors', async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    // Convertir los valores de startDate y endDate a objetos Date si existen
    const start = startDate ? new Date(parseInt(startDate, 10)) : null;
    const end = endDate ? new Date(parseInt(endDate, 10)) : null;

    if ((startDate && isNaN(start)) || (endDate && isNaN(end))) {
      return res.status(400).json({
        error: 'Invalid startDate or endDate. Please provide valid timestamps in milliseconds.',
      });
    }

    // Construir la consulta
    const query = {};

    if (start || end) {
      query.timestamp = {};
      if (start) query.timestamp.$gte = start;
      if (end) query.timestamp.$lte = end;
    }

    // Obtener los datos de MongoDB
    const data = await db_sensors.find(query).sort({ timestamp: 1 });

    // Formatear los datos para Grafana
    const formattedData = data.map((item) => ({
      timestamp: item.timestamp.toISOString(), // Formato ISO 8601
      analog_value: item.analog_value,          // Valor del sensor
      client_id: item.client_id,         // ID del cliente
    }));

    // Enviar los datos formateados
    res.status(200).json(formattedData);
  } catch (err) {
    console.error('Error al obtener datos:', err);
    res.status(500).send('Error interno del servidor');
  }
});


app.get('/api/sensors/list', async (req, res) => {
  try {
    const sensors = await db_sensors.distinct('client_id'); // Obtener sensores únicos
    res.status(200).json(sensors);
  } catch (err) {
    console.error('Error al obtener sensores:', err);
    res.status(500).send('Error interno del servidor');
  }
});

app.get('/api/sensors/:client_id', async (req, res) => {
  const { client_id } = req.params;
  const { startDate, endDate } = req.query;
  console.log(req.query);

  try {
    // Convertir los valores de timestamp a Date si existen
    const start = startDate ? new Date(parseInt(startDate, 10)) : null;
    const end = endDate ? new Date(parseInt(endDate, 10)) : null;

    if ((startDate && isNaN(start)) || (endDate && isNaN(end))) {
      return res.status(400).json({
        error: 'Invalid startDate or endDate. Please provide valid timestamps in milliseconds.',
      });
    }

    const query = { client_id };

    // Agregar filtro de fechas solo si son válidas
    if (start || end) {
      query.timestamp = {};
      if (start) query.timestamp.$gte = start;
      if (end) query.timestamp.$lte = end;
    }

    const data = await db_sensors.find(query).sort({ timestamp: 1 });
    return res.status(200).json(data)



  } catch (err) {
    console.error('Error al obtener datos históricos:', err);
    res.status(500).send('Error interno del servidor');
  }
});


// Crear servidor HTTP y WebSocket
const server = app.listen(port, () => {
  console.log(`Servidor Express en ejecución en el puerto ${port}`);
});

// Configuración de WebSocket
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');

  // Simulación de datos de tres sensores con rangos específicos
  const sensorConfig = {
    T1: { min: 18, max: 21 },
    T2: { min: 32, max: 35 },
    T3: { min: 25, max: 27 },
  };

  const intervalId = setInterval(async () => {
    for (const [client_id, range] of Object.entries(sensorConfig)) {
      const analog_value = Math.random() * (range.max - range.min) + range.min; // Generar valor dentro del rango
      const timestamp = new Date();

      // Guardar datos en MongoDB
      //const dataPoint = new db_sensors({ client_id, analog_value, timestamp });
      //await dataPoint.save();

      // Enviar datos al cliente

      const data = { client_id, analog_value, timestamp };
      //ws.send(JSON.stringify(data));
    }
  }, 1000);

  // Manejar cierre de la conexión
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
    clearInterval(intervalId);
  });
});

// === AWS IoT Config ===
const awsHost = process.env.AWSIOT_URL;
const awsOptions = {
  clientId: 'bridge-client',
  host: awsHost,
  port: 8883,
  protocol: 'mqtts',
  key: fs.readFileSync('./certs/sensor_001.private.key'),
  cert: fs.readFileSync('./certs/sensor_001.cert.pem'),
  ca: fs.readFileSync('./certs/AmazonRootCA1.pem'),
  rejectUnauthorized: true,
};

// === AWS MQTT Client ===
const awsClient = mqtt.connect(`mqtts://${awsHost}:8883`, awsOptions);

awsClient.on('connect', () => {
  console.log('[AWS] Conectado a AWS IoT Core');
  awsClient.subscribe('topic/03', (err) => {
    if (err) {
      console.error('Error al suscribirse al tema MQTT:', err);
    } else {
      console.log('Suscrito al tema: topic/03');
    }
  });
});


awsClient.publish('topic/03', JSON.stringify({ mensaje: 'Hola mundo desde estacion central' }), { qos: 1 }, (err) => {
  if (err) console.error('Error al publicar:', err);
  else console.log('Mensaje publicado');
});

awsClient.on('message', async(topic, message) => {
  console.log(`📩 [AWS] Mensaje recibido en "${topic}":`, message.toString());
});


awsClient.on('message', async (topic, message) => {
  try {
    if (topic === 'topic/03') {
      const json = JSON.parse(message.toString());
      const { client_id, analog_value } = json;
      const timestamp = new Date();

      // Guardar datos en MongoDB
      try {
        const dataPoint = new db_sensors({ client_id, analog_value, timestamp });
        await dataPoint.save();  
        
      } catch (error) {
        console.log('Error al guardar datos del sensor en DB: ', error)
      }

      // Hacer la predicción con Python
      try {
        const response = await axios.post("http://model:5000/predict", {
          features: [timestamp.getTime(), analog_value]
        });
      
        let predict = response.data.prediction[0];
      
        const labels = {
          0: 'luz solar intensa',
          1: 'reflejos de sol y sombra',
          2: 'oscuridad',
          3: 'sombra'
        };
      
        predict = labels[predict] || 'desconocido';
      
        // Enviar datos a través del WebSocket con la predicción
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ client_id, analog_value, timestamp, predict }));
          }
        });
      
      } catch (err) {
        console.error("❌ Error al obtener predicción del microservicio Python:", err.message);
      }
      
      

    }

  } catch (err) {
    console.error('Error al procesar el mensaje MQTT:', err);
  }
});

awsClient.on('error', (err) => {
  console.error('Error en el cliente MQTT:', err);
});
