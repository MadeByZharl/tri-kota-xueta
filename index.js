import { spawn } from 'child_process';

console.log("=> Очистка старых зависимостей (node_modules и package-lock.json)...");

const clean = spawn('rm', ['-rf', 'node_modules', 'package-lock.json'], { stdio: 'inherit', shell: true });

clean.on('close', (code) => {
  console.log("=> Установка зависимостей (npm install)...");
  
  const install = spawn('npm', ['install'], { stdio: 'inherit', shell: true });
  
  install.on('close', (code) => {
    if (code !== 0) {
      console.error(`=> Ошибка установки. Код: ${code}`);
      process.exit(code);
    }

    console.log("=> Начинаем сборку проекта (Vite build)...");

    const build = spawn('npm', ['run', 'build'], { stdio: 'inherit', shell: true });

    build.on('close', (code) => {
      if (code !== 0) {
        console.error(`=> Ошибка сборки. Код: ${code}`);
        process.exit(code);
      }
      
      console.log("=> Сборка успешно завершена! Запускаем сервер...");
      
      const server = spawn('npm', ['run', 'start'], { stdio: 'inherit', shell: true });
      
      server.on('close', (code) => {
        console.log(`=> Сервер остановлен. Код: ${code}`);
        process.exit(code);
      });
    });
  });
});
