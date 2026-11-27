require('dotenv').config();

module.exports = {
  botName: 'CLYTONIC TECH_TKL_MD',
  botVersion: '1.0.0',
  prefix: '.',
  
  ownerNumber: '263775814192',
  ownerName: 'Clytonic Tech DM',
  ownerEmail: 'ownerofclytonictech@gmail.com',
  
  defaultMode: 'public',
  serverOnline: true,
  
  port: process.env.PORT || 3000,
  appUrl: process.env.APP_URL || 'http://localhost:3000'
};
