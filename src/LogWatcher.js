// LogWatcher.js

const os = require('os'); // Certifique-se de ter este módulo
const chokidar = require('chokidar');
const fs = require('fs');
const nodemailer = require('nodemailer');
const pm2 = require('pm2');
const { emailConfig, filesToMonitor, getFileName } = require('./config');

// Configura o transportador de e-mail
const transporter = nodemailer.createTransport({
  service: emailConfig.service,
  auth: {
    user: emailConfig.auth.user,
    pass: emailConfig.auth.pass
  },
});

// Função para pegar o IP local e o chassi
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const hostname = os.hostname();
  let chassi = '';
  
  for (let interfaceName in interfaces) {
    for (let iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log('IP : ' + iface.address);
        console.log('hostname : ' + hostname);

        // ####Identificação do Chassi####
        switch (iface.address) {
          case "10.156.30.17":
          case "10.33.16.20":
            chassi = 'Hml';
            break;
          case "10.150.30.8":
            chassi = 'Chassi_1';
            break;
          case "10.150.30.9":
            chassi = 'Chassi_2';
            break;
        }

        return { chassi, ip: iface.address }; // Retornar tanto o chassi quanto o IP
      }
    }
  }
  return { chassi: null, ip: null }; // Retornar null se não encontrar
}

// Função para enviar e-mail
function sendEmail(subject, message) {
  const mailOptions = {
    from: emailConfig.from,
    to: emailConfig.to,
    subject: subject,
    text: message
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log('Erro ao enviar e-mail:', error);
    }
    console.log('E-mail enviado: ' + info.response);
  });
}

// Monitorar mudanças nos arquivos
filesToMonitor.forEach((file) => {
  let fileLastSize = 0;  // Guardar o tamanho anterior do arquivo

  chokidar.watch(file, { persistent: true }).on('change', () => {
    console.log(`Arquivo alterado: ${file}`);

    fs.stat(file, (err, stats) => {
      if (err) {
        return console.error(`Erro ao obter o status do arquivo ${file}:`, err);
      }

      const newSize = stats.size;

      if (newSize > fileLastSize) {
        const stream = fs.createReadStream(file, { start: fileLastSize, end: newSize });
        let newContent = '';

        stream.on('data', (chunk) => {
          newContent += chunk;
        });

        stream.on('end', () => {
          console.log(`Novas linhas adicionadas ao arquivo ${file}:\n${newContent}`);
          
          const { chassi } = getLocalIP(); // Pegar o chassi
          const subject = `Log Alert: ${getFileName(file)} modificado - Chassi: ${chassi || 'Desconhecido'}`;
          
          sendEmail(subject, `O arquivo ${file} foi alterado:\n\n${newContent}`);
        });

        stream.on('error', (err) => {
          console.error(`Erro ao ler o arquivo ${file}:`, err);
        });

        fileLastSize = newSize;  // Atualizar o tamanho do arquivo monitorado
      }
    });
  });
});

// Estrutura para rastrear o status do serviço e quando o e-mail foi enviado
var pm2ServiceStatus = {};

// Função para verificar o estado dos serviços PM2
function checkPm2Services() {
  pm2.list((err, list) => {
    if (err) {
      console.error('Erro ao listar processos PM2:', err);
      return;
    }

    list.forEach((proc) => {
      const serviceName = proc.name;

      // Verifica se o nome do serviço contém 'refresh'
      if (serviceName.includes('refresh')) {
        console.log(`Ignorando o serviço: ${serviceName} (contém 'refresh')`);
        return; // Pula para o próximo serviço
      }

      const isOnline = proc.pm2_env.status === 'online';
      const currentTime = Date.now();

      // Se o serviço não estiver online
      if (!isOnline) {
        // Se o serviço já foi notificado ou não
        if (!pm2ServiceStatus[serviceName]) {
          // Se não houve notificação, notifique agora
          pm2ServiceStatus[serviceName] = {
            notified: true,
            lastNotified: currentTime,
          };

          const { chassi } = getLocalIP(); // Pegar o chassi
          sendEmail(`Alerta de Serviço PM2: ${serviceName} ${proc.pm2_env.status} - Chassi: ${chassi || 'Desconhecido'}`, 
            `O serviço ${serviceName} não está online. Status: ${proc.pm2_env.status}`);
        } else {
          // Se já foi notificado, verifique se passou uma hora desde a última notificação
          const timeSinceLastNotification = currentTime - pm2ServiceStatus[serviceName].lastNotified;
          const oneHourInMilliseconds = 60 * 60 * 1000; // 1 hora

          if (timeSinceLastNotification >= oneHourInMilliseconds) {
            // Envie um lembrete
            const { chassi } = getLocalIP(); // Pegar o chassi
            sendEmail(`Lembrete: Serviço PM2 ${serviceName} ainda está ${proc.pm2_env.status} - Chassi: ${chassi || 'Desconhecido'}`, 
              `O serviço ${serviceName} ainda não está online. Status: ${proc.pm2_env.status}`);
            pm2ServiceStatus[serviceName].lastNotified = currentTime; // Atualiza o tempo da última notificação
          }
        }
      } else {
        // Se o serviço estiver online, verifica se estava parado antes
        if (pm2ServiceStatus[serviceName] && pm2ServiceStatus[serviceName].notified) {
          // Envie um e-mail informando que o serviço voltou
          const { chassi } = getLocalIP(); // Pegar o chassi
          sendEmail(`Serviço Restaurado: ${serviceName} - Chassi: ${chassi || 'Desconhecido'}`, 
            `O serviço ${serviceName} foi restaurado e está agora online.`);
          console.log(`Serviço ${serviceName} foi restaurado e está agora online.`);
          pm2ServiceStatus[serviceName] = { notified: false }; // Resetar estado de notificação
        }
        console.log(`Serviço ${serviceName} está online.`);
      }
    });
  });
}

// Conectar ao PM2 e iniciar monitoramento
pm2.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao PM2:', err);
    return;
  }

  // Monitorar PM2 a cada 10 segundos
  setInterval(checkPm2Services, 10000);

  console.log(`Monitorando os arquivos: ${filesToMonitor.join(', ')}`);
});
