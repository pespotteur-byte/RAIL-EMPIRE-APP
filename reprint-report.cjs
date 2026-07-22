const CDP = require('chrome-remote-interface');
const fs = require('fs');

const HTML_FILE = '/home/ubuntu/dedensen-test/report.html';
const PDF_FILE = '/home/ubuntu/dedensen-test/report.pdf';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

CDP({ host: 'localhost', port: 29229 }, async (client) => {
  const { Page } = client;
  try {
    await Page.enable();
    await Page.navigate({ url: 'file://' + HTML_FILE });
    await sleep(3000);
    const { data } = await Page.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      paperWidth: 8.27,
      paperHeight: 11.69
    });
    fs.writeFileSync(PDF_FILE, Buffer.from(data, 'base64'));
    console.log('PDF regenerated', PDF_FILE);
  } finally {
    client.close();
  }
}).on('error', (err) => {
  console.error('CDP error', err);
  process.exit(1);
});
