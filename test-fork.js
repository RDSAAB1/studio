const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const port = 3010;
const standaloneDir = path.join(process.cwd(), '.next', 'standalone');
const standaloneServerPath = path.join(standaloneDir, 'server.js');
const env = { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', NODE_ENV: 'production' };

console.log('Testing fork of standalone server...');
console.log('standaloneServerPath:', standaloneServerPath);
console.log('standaloneDir:', standaloneDir);

if (!fs.existsSync(standaloneServerPath)) {
    console.error('SERVER NOT FOUND!');
    process.exit(1);
}

const child = fork(standaloneServerPath, [], {
    cwd: standaloneDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
});

child.stdout.on('data', (d) => console.log(`[STDOUT] ${d}`));
child.stderr.on('data', (d) => console.error(`[STDERR] ${d}`));

child.on('error', (e) => console.error('FORK ERROR:', e));
child.on('exit', (code) => {
    console.log('SERVER EXITED WITH CODE:', code);
    process.exit(code);
});

setTimeout(() => {
    console.log('Server seems to be running. Killing it.');
    child.kill();
    process.exit(0);
}, 10000);
