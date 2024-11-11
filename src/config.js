const path = require('path');

// Configuração de e-mail usando Microsoft Graph
const emailConfig = {
  service: 'gmail',
  auth: {
    user: 'rafael.valquer@gmail.com',  // Seu e-mail
    pass: 'vyrc rmua rxtw hzpu'  // Senha de app do Gmail
  },
  from: 'rafael.santos@dnkinfotelecom.com.br',  // E-mail de envio
  to: [
    'rafael.santos@dnkinfotelecom.com.br',
    'izumi.iwahata@dnkinfotelecom.com.br'
  ].join(', ')  // Converte a lista em uma string separada por vírgulas
};

// Lista de arquivos para monitorar
const filesToMonitor = [
  'D:/chassi/domni/logs/alelo-usuario/alelo-usuario_err.log',
  'D:/chassi/domni/logs/alelo-empresa/alelo-empresa-01_err.log',
];

// Função para retornar nome do arquivo para e-mail
function getFileName(filePath) {
  return path.basename(filePath);
}

module.exports = { emailConfig, filesToMonitor, getFileName };
