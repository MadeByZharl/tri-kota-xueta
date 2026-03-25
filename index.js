import { spawn } from 'child_process';

console.log("=> Начинаем сборку проекта (Vite build)...");

const build = spawn('npm', ['run', 'build'], { 
  stdio: 'inherit', 
  shell: true,
  env: { ...process.env, NODE_ENV: 'production' }
});

build.on('close', (code) => {
  if (code !== 0) {
    console.error(`=> Ошибка сборки. Код: ${code}`);
    process.exit(code);
  }
  
  console.log("=> Сборка успешно завершена! Запускаем сервер...");
  
  const server = spawn('npm', ['run', 'start'], { 
    stdio: 'inherit', 
    shell: true,
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  server.on('close', (code) => {
    console.log(`=> Сервер остановлен. Код: ${code}`);
    process.exit(code);
  });
});
