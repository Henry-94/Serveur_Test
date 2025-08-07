const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let esp32Client = null;
let androidClients = [];

wss.on('connection', (ws) => {
  console.log('Nouveau client WebSocket connecté');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Message reçu:', JSON.stringify(data));

      // Si c'est l'ESP32
      if (data.type === 'esp32') {
        esp32Client = ws;
        console.log('ESP32 connecté');

        // Relayer les données de capteurs et les status vers Android
        if (data.waterLevel || data.temperature || data.turbidity || data.message || data.status || data.phoneNumber) {
          androidClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }

      // Si c'est un client Android
      } else if (data.type === 'android') {
        if (!androidClients.includes(ws)) {
          androidClients.push(ws);
          console.log('Client Android connecté');
        }

        // Relayer commandes / horaires vers l'ESP32
        if (
          data.feedingTimes || data.securityTimes ||
          data.thresholds || data.command ||
          data.phoneNumber || data.feedingCount
        ) {
          if (esp32Client && esp32Client.readyState === WebSocket.OPEN) {
            esp32Client.send(JSON.stringify(data));
            console.log('Message envoyé à ESP32:', JSON.stringify(data));
          } else {
            ws.send(JSON.stringify({ type: 'status', message: 'ESP32 non connecté' }));
            console.log('ESP32 non connecté, message non envoyé');
          }
        }
      }

    } catch (err) {
      console.error('Erreur de parsing JSON:', err.message);
    }
  });

  ws.on('close', () => {
    if (ws === esp32Client) {
      esp32Client = null;
      console.log('ESP32 déconnecté');
    } else {
      androidClients = androidClients.filter(client => client !== ws);
      console.log('Client Android déconnecté');
    }
  });

  ws.on('error', (error) => {
    console.error('Erreur WebSocket:', error);
  });
});

// Fichier statique si page HTML côté client
app.use(express.static('public'));

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'Serveur WebSocket OK' });
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur WebSocket démarré sur le port ${PORT}`);
});
