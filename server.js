const http = require('http');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// Setup: Move files to 'public' if they haven't been moved yet
const filesToMove = ['index.html', 'index.css', 'insignia.png', 'js', 'assets'];

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
    console.log('Created public/ directory.');
    
    filesToMove.forEach(file => {
        const oldPath = path.join(__dirname, file);
        const newPath = path.join(publicDir, file);
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`Moved ${file} to public/`);
        }
    });
}

// Map extensions to content types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

const server = http.createServer((req, res) => {
    // LLM Chat Endpoint
    if (req.method === 'POST' && req.url === '/api/chat') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { query, mode } = JSON.parse(body);
                // Fake delay to simulate ChatGPT typing
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Advanced ChatGPT-like simulated response (fallback if no OpenAI key is used)
                const isEnglish = query.toLowerCase().includes('how') || query.toLowerCase().includes('what');
                let response = isEnglish 
                    ? "That's a very interesting question. As your NeuroCoach, I can tell you that cognitive flexibility is key here. Try taking a deep breath, stepping back for 5 minutes, and then tackling the problem from a new angle. You've got this! 🧠✨"
                    : "Es una excelente pregunta. Como tu NeuroCoach, te digo que la flexibilidad cognitiva es clave. Intenta respirar profundo, tomarte 5 minutos de pausa kinestésica, y luego abordar el problema desde otro ángulo. ¡Tú puedes lograrlo! 🧠✨";
                
                // Extra contextualization based on the exact query
                if (query.toLowerCase().includes('pomodoro')) {
                    response = isEnglish 
                        ? "The Pomodoro technique is fantastic! Work for 25 minutes, then take a 5-minute break to stretch. Would you like me to start a timer for you? ⏱️" 
                        : "¡La técnica Pomodoro es fantástica! Trabaja 25 minutos y descansa 5 para estirar. ¿Te gustaría que configuremos un temporizador en tu panel? ⏱️";
                } else if (query.toLowerCase().includes('tdah') || query.toLowerCase().includes('adhd')) {
                    response = isEnglish
                        ? "ADHD means your brain works a little differently—like having a race car engine! We just need to train the brakes. Routine Builder is great for that! 🏎️💨"
                        : "El TDAH significa que tu cerebro funciona diferente, ¡como un motor de carreras! Solo necesitamos entrenar los frenos. ¡El juego de Crear Rutinas es perfecto para eso! 🏎️💨";
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ response }));
            } catch (err) {
                res.writeHead(400);
                res.end("Bad Request");
            }
        });
        return;
    }

    // Basic routing
    let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // If not found, fallback to index.html (SPA behavior)
                fs.readFile(path.join(publicDir, 'index.html'), (err2, content2) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<h1>404 Not Found</h1>', 'utf-8');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content2, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Serving files from ${publicDir}`);
});
