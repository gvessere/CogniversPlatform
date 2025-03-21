import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
// Parse command line arguments for port
const args = process.argv.slice(2);
let port = 3000; // Default port
// Check for port argument (--port or -p)
for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
        port = parseInt(args[i + 1], 10);
        break;
    }
    else if (args[i].startsWith('--port=')) {
        port = parseInt(args[i].substring(7), 10);
        break;
    }
    else if (args[i].startsWith('-p=')) {
        port = parseInt(args[i].substring(3), 10);
        break;
    }
}
// Allow port to be set via environment variable as fallback
port = parseInt(process.env.PORT || port.toString(), 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
app.prepare().then(() => {
    createServer((req, res) => {
        const parsedUrl = parse(req.url || '', true);
        handle(req, res, parsedUrl);
    }).listen(port, (err) => {
        if (err)
            throw err;
        console.log(`> Ready on http://localhost:${port}`);
    });
});
