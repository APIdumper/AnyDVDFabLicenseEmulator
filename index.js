/*
	DVDFab Server Emulator v1.1
*/

// Libraries
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mockttp = require('mockttp');

// Configuration
const productList = fs.readFileSync(path.join(__dirname, 'products.txt'), 'utf8').trim().split('\n').map(Number);
const daysLeft = Math.floor((new Date('9999-12-31T23:59:59.999Z') - new Date()) / 1000 / 60 / 60 / 24);
const currentDate = new Date();
const currentVersion = fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim();
const randomToken = crypto.randomBytes(16).toString('hex');

// Ticket
const ticket = ['1'];
productList.forEach((product) => {
	ticket.push(`${product}:${253402300799}`);
});
ticket.push(`VP:${daysLeft}`);
ticket.push(`OV:${currentVersion}`);
ticket.push('BV:');
ticket.push(`AD:1`);
ticket.push('SUB:');
ticket.push('UT:0');
ticket.push('ML:1-11-1');
ticket.push(`S:${randomToken}`);
ticket.push(`TI:${Math.floor(currentDate.getTime() / 1000)}`);
ticket.push('TM:0');

// Proxy
(async () => {
	const https = await mockttp.generateCACertificate();
	const proxyServer = mockttp.getLocal({ https });

	proxyServer.forPost(/https:\/\/.+\/auth\/v[0-5]+\//).thenReply(200,
		ticket.join('|')
	);

	proxyServer.forPost('https://ssl.dvdfab.cn/update/recommend.php').thenReply(200,
		'{"cscode":0,"version":1,"enable":true,"data":[]}',
		{ 'content-type': 'text/html' }
	);

	proxyServer.forPost(/https:\/\/ssl-jp.dvdfab.cn\/ak\/v[0-9]+\/st\//).thenReply(200,
		'{"R":"0"}',
		{ 'content-type': 'text/html; charset=UTF-8' }
	);

	proxyServer.forPost(/https:\/\/.+\/client\/command/).thenCloseConnection();

	proxyServer.forPost('http://ssl.dvdfab.cn/auth/trial_disc.php')
		.withQuery({ Mode: 'Upload' })
		.thenReply(200, 'OK', { 'content-type': 'text/html' });

	proxyServer.forPost(/https:\/\/servo-slave-.+\.dvdfab\.cn\/recommend\/client\/best\/list/).thenReply(200,
		'{"cscode":200,"version":"1.0.0","data":[]}',
		{ 'content-type': 'application/json' }
	);

	proxyServer.forPost(/https:\/\/app-api-c[0-9]+\.dvdfab\.cn\/api\/info_control\//).thenReply(200,
		'{"result":{"res":"true","msg":"ok","data":[]}}',
		{ 'content-type': 'text/html; charset=UTF-8' }
	);

	proxyServer.forPost(/https:\/\/drm-u[0-9]+\.dvdfab\.cn\/ak\/re\/downloadex\//).thenReply(200,
		'{"R":"0","num":69420,"count":"69420"}',
		{ 'content-type': 'text/html; charset=UTF-8' }
	);

	proxyServer.forPost(/https:\/\/app-api-c[0-9]+\.dvdfab\.cn\/api\/common_json_post\//).thenReply(200,
		'{"result":{"res":true,"msg":"NO_ERROR"}}'
	);

	proxyServer.forPost(/https:\/\/.+\/\/products\/client_upgrade_license_v2/).thenCloseConnection();

	await proxyServer.forUnmatchedRequest().thenPassThrough();

	proxyServer.start(8000)

	console.log();
	console.log("  +=============================================================+");
	console.log("  | DVDFab Server Emulator has started...                       |");
	console.log("  | You may now use any DVDFab software.                        |");
	console.log("  | Press CTRL-C or close this window to stop the emulator.     |");
	console.log("  | You can safely ignore any errors.                           |");
	console.log("  +=============================================================+");
	console.log("  | If you have any problems with your network after            |");
	console.log("  | disconnecting from the local proxy, please run the          |");
	console.log("  | 'stop.bat' script.                                          |");
	console.log("  +=============================================================+");
	console.log("  | If you got this script from anywhere apart from             |");
	console.log("  | The CDM-Project, you likely have a malicious copy.          |");
	console.log("  +=============================================================+");
	console.log();
})();
