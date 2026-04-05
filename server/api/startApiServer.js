import { createServer } from 'node:http';
import { getDashboardData } from './dashboardRoute.js';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload));
}

export function startApiServer(port = 8787) {
  const server = createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      response.end();
      return;
    }

    if (request.method === 'GET' && request.url === '/api/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET' && request.url === '/api/dashboard') {
      try {
        const payload = await getDashboardData();
        sendJson(response, 200, payload);
      } catch (error) {
        sendJson(response, 500, {
          error: error.message,
        });
      }
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  });

  server.listen(port, () => {
    console.info(`API server listening on http://localhost:${port}`);
  });

  return server;
}
