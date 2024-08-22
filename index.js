/*
	DVDFab Server Emulator v1.1.1
*/

// Libraries
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mockttp = require('mockttp');

// Classes
class Session {
	constructor() {
		this.DOMAINS = ['hotmail.com', 'gmail.com', 'yahoo.com', 'outlook.com', 'protonmail.com', 'yandex.com'];
		this.CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789.-';
		this.email = null;
		this.machine_id = null;
		this.usage = 0;
		this.update();
	}

	generateRandomString(length) {
		return Array(length).fill(null).map(() => this.CHARACTERS.charAt(Math.floor(Math.random() * this.CHARACTERS.length))).join('');
	}

	generateMacAddress() {
		const bytes = Array.from({ length: 12 }, () => Math.floor(Math.random() * 256));
		const mac1 = bytes.slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('-');
		const mac2 = bytes.slice(6).map(b => b.toString(16).padStart(2, '0')).join('-');
		return `${mac1}:${mac2}`;
	}

	update() {
		const length = Math.floor(Math.random() * 10) + 5;
		this.email = `${this.generateRandomString(length)}@${this.DOMAINS[Math.floor(Math.random() * this.DOMAINS.length)]}`;
		this.machine_id = this.generateMacAddress();
	}

	patchBoundary(data) {
		if (this.usage === 3) {
			this.usage = 0;
			this.update();
		}

		const macRegex = /^([0-9a-f]{2}-){5}[0-9a-f]{2}(:([0-9a-f]{2}-){5}[0-9a-f]{2})?/;
		const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
		const subscriptionRegex = /^365$/;

		for (const key in data) {
			const value = data[key];
			if (macRegex.test(value)) {
				data[key] = this.machine_id;
			} else if (emailRegex.test(value)) {
				data[key] = this.email;
			} else if (subscriptionRegex.test(value)) {
				data[key] = 'trial';
			}
		}

		this.usage++;
		return data;
	}
}

// Constants
const productList = fs.readFileSync(path.join(__dirname, 'products.txt'), 'utf8').trim().split('\n').map(Number);
const daysLeft = Math.floor((new Date('9999-12-31T23:59:59.999Z') - new Date()) / 1000 / 60 / 60 / 24);
const currentDate = new Date();
const currentVersion = fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim();
const randomToken = crypto.randomBytes(16).toString('hex');

// Functions
function parseBoundary(data, boundary) {
	const parts = data.split(`--${boundary}`).filter(part => part.trim() && part !== '--');
	const formData = {};

	parts.forEach(part => {
		const match = /Content-Disposition: form-data; name="([^"]+)"\r\n\r\n([\s\S]+)/.exec(part);
		if (match) {
			formData[match[1]] = match[2].trim();
		}
	});

	return formData;
}

function buildMultipartBody(data, boundary) {
	let body = '';
	for (const [key, value] of Object.entries(data)) {
		body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
	}
	body += `--${boundary}--\r\n`;
	return body;
}

// Runtime
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
	const session = new Session();

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
		'{"R":"0","num":100,"count":"100"}',
		{ 'content-type': 'text/html; charset=UTF-8' }
	);

	proxyServer.forPost(/https:\/\/app-api-c[0-9]+\.dvdfab\.cn\/api\/common_json_post\//).thenReply(200,
		'{"result":{"res":true,"msg":"NO_ERROR"}}'
	);

	proxyServer.forPost(/https:\/\/.+\/\/products\/client_upgrade_license_v2/).thenCloseConnection();

	proxyServer.forPost(/^https:\/\/.+\/ak\/uc_v[0-9]+\//).thenPassThrough({
		beforeRequest: async (originalRequest) => {
			if (originalRequest.headers['content-type'] && originalRequest.headers['content-type'].includes('multipart/form-data')) {
				const boundaryMatch = /boundary=(.+)/.exec(originalRequest.headers['content-type']);
				if (boundaryMatch) {
					const boundary = boundaryMatch[1];
					const formData = parseBoundary(originalRequest.body.buffer.toString(), boundary);
					const patchedData = session.patchBoundary(formData);
					const newBody = buildMultipartBody(patchedData, boundary);

					originalRequest.body = Buffer.from(newBody);
					originalRequest.headers['content-length'] = Buffer.byteLength(newBody).toString();
				}
			}

			return originalRequest;
		}
	});

	await proxyServer.forUnmatchedRequest().thenPassThrough();

	proxyServer.start(8000)

	console.log();
	console.log('  +=============================================================+');
	console.log('  | DVDFab Server Emulator has started...                       |');
	console.log('  | You may now use any DVDFab software.                        |');
	console.log('  | Press CTRL-C or close this window to stop the emulator.     |');
	console.log('  | You can safely ignore any errors.                           |');
	console.log('  +=============================================================+');
	console.log('  | If you have any problems with your network after            |');
	console.log('  | disconnecting from the local proxy, please run the          |');
	console.log('  | \'stop.bat\' script.                                          |');
	console.log('  +=============================================================+');
	console.log('  | If you got this script from anywhere apart from             |');
	console.log('  | The CDM-Project, you likely have a malicious copy.          |');
	console.log('  +=============================================================+');
	console.log();
})();
