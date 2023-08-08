const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { Agent } = require("https");
const net = require("net");
const httpProxy = require('http-proxy');
let httpServer;
let httpsServer;

const httpPort = 12345;
const httpsPort = 23456;
const initProxy = async () => {
    httpServer = http
        .createServer({
            keepAlive: true,
        })
        .listen(httpPort);

    httpServer.on('request', (req, res) => {
        if (req.url === '/proxy.pac') {
            // 本地 https 代理的端口
            const str = `
        function FindProxyForURL(url, host) {
          if (host === 'bin.bnbstatic.com') {
            return "HTTPS 127.0.0.1:${httpsPort};DIRECT";
          }
          return "DIRECT";
        }
      `;
            res.end(str);
        } else {
            res.end();
        }
    });

    httpServer.on('error', err => {
        console.error('[beyondCorp]', 'http server error: ', err);
    });

    httpServer.setTimeout(1000 * 60 * 2);

    let localCert;
    let localKey;
    try {
        localCert = fs.readFileSync(path.join(__dirname, 'cacert.pem')).toString();
        localKey = fs.readFileSync(path.join(__dirname, 'privkey.pem')).toString();
    } catch (e) {
        console.error('[beyondCorp]', 'get local server cert error: ', e);
        return;
    }

    if (!localCert || !localKey) {
        return;
    }

    // https server
    httpsServer = https
        .createServer({
            cert: localCert,
            key: localKey,
            keepAlive: true,
        })
        .listen(httpsPort);

    httpsServer.on('connect', (req, socket, head) => {
        let serverSocket = net.connect(httpsPort, '127.0.0.1', () => {
            socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            serverSocket.write(head);
            serverSocket.pipe(socket);
            socket.pipe(serverSocket);
        });
        socket.on('error', err => {
            console.error('[beyondCorp]', 'http server socket error: ', err);
            socket.destroy();
        });
        serverSocket.on('error', err => {
            console.error('[beyondCorp]', 'http server socket error: ', err);
        });
    });

    const ca = "-----BEGIN CERTIFICATE-----\nMIIDwTCCAamgAwIBAgICEAMwDQYJKoZIhvcNAQELBQAwUzELMAkGA1UEBhMCR0Ix\nEDAOBgNVBAgMB0VuZ2xhbmQxEjAQBgNVBAoMCURpZmZ0IEx0ZDEeMBwGA1UEAwwV\nRGlmZnQgQ3liZXJUcnVzdCBSb290MB4XDTIyMTAwNDA1NDQyNVoXDTMyMTAwMTA1\nNDQyNVowVzELMAkGA1UEBhMCR0IxEDAOBgNVBAgMB0VuZ2xhbmQxEjAQBgNVBAoM\nCURpZmZ0IEx0ZDEiMCAGA1UEAwwZSW50ZXJuYWwgU3lzdGVtIENsaWVudCBDQTBZ\nMBMGByqGSM49AgEGCCqGSM49AwEHA0IABMOkvGry/wrVHeKNyxr7mXBfrUxy/Yos\nPSQbwz0IJV6I1Yw3KcnhwcMu7QsSEYCKvsG2muVg0IMBrB3Hrw47rg6jZjBkMB0G\nA1UdDgQWBBQh9Hpr6ZmJ22EbUfB64tyCspvyGjAfBgNVHSMEGDAWgBS5UooWFPTE\nrhK5ku+vvjQLRP6iSTASBgNVHRMBAf8ECDAGAQH/AgEAMA4GA1UdDwEB/wQEAwIB\nhjANBgkqhkiG9w0BAQsFAAOCAgEAA7+ILHd6ugjQNTzsNWOV+n2mimv/0kvqy7Fi\nBhaIYKg1Bfrv7epS4MnsixacuBztrXmcA2WH5Qkwk5/veHZA0IRLU925r7XBM35b\ni2U49Htp+K5uj3y6qOGCQf2nr7nqasCDA/qyx6OWFviZzQvM0v5X9IUpWNUD9woZ\nEstLlfXd5hEVf12Bh+bvjGT+yLGY4gZ/dQg7E3/hY5qUjV09T436GqsAaRc7HsFH\nVY51fxkBRYt7FT3HTkeeiF+U9AlkaiB/2h3KPJDjD5dmX9K+LUrehFY5Sz7xJx0m\nr0m8U9tHenM2y+O8kwqaN/dSc4CxP1/3fPf1MY9v8dnLkZjrluUT2ElCnpwUlUXh\nP6GpqJGilFNjjR8tkq/i78KQl/pDRfXmoubwZwFEyl+O8NMXwp1/BUfhX5BUDaui\niWycYTheJWx6zV1RLs86rzuP970RkKv12TyIrEC7q7srwedr/RLL48lqtBaTYheh\nllaOucmbg6f+KgyPUxuHJjgBlz8lRclh4GNQzMyWBAWulyQAzlC3qwm5vpH/+H0v\neJFntF/5p3gXfN3ULwq6EXuwxIqozLWVN1prKyvxyuOVoMf91FsO/yKogTIWk32N\nl/9i+7lQDcXx+IbAuxv2O5qJQMXICMczyCE95w4zCOGDf/OozMuT7HjXXt7p3toj\ngdUmSh0=\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMIIFmTCCA4GgAwIBAgIUUoDQhnD2xrGerkCY7EAs8JYgzUswDQYJKoZIhvcNAQEL\nBQAwUzELMAkGA1UEBhMCR0IxEDAOBgNVBAgMB0VuZ2xhbmQxEjAQBgNVBAoMCURp\nZmZ0IEx0ZDEeMBwGA1UEAwwVRGlmZnQgQ3liZXJUcnVzdCBSb290MCAXDTIxMTEx\nNjExNDEwMFoYDzIwNzExMTA0MTE0MTAwWjBTMQswCQYDVQQGEwJHQjEQMA4GA1UE\nCAwHRW5nbGFuZDESMBAGA1UECgwJRGlmZnQgTHRkMR4wHAYDVQQDDBVEaWZmdCBD\neWJlclRydXN0IFJvb3QwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDg\nJwQPXj3Y92ta8Dc4nhJZBcbi0TyuKEYGTgyGKv2E5k7TCg9ggg+KS9Fsx1SkfX1k\n9u/okJkaNxLot8TbkYrXpgXoroDI1akQRBiCs7TAb47OuhVJ0BVh8CxNJqIJz1vk\nHRhI5POlaCjK7bb1p3QpMjsKlqKOdJUuC/GtIhCZ1qj/Nr8rC9HqJl2Qv/R+rGon\nsRLY8vz/9Tdi3vIONNyo1ZB+RuGe4CccLjz+cQ2QMx/Z1KUapgIMvVgHm5M26yal\n815BwXgYGXPbZTSwpp3N09n4rxl1J1bl64K0CiE2Xv43Va5Bbh65mKDMsBoGN9GZ\nVJSQsUrcVaRm2lcgSbL+0qufmifH7WsYYzw9om0cxeC36yLm7JWcSdpdzXTrZzjA\nrrGtFKwuljmtRu07UPHqQnQNWnEANdCDAWrv5e/l7rzsLpoE/vAdFd4oUg5fsa9z\nqHaXRKZY99Fn8cBo+7sfaNckYtwTuUFS3uvrTjs1cVabE19xyM36AdhtEOw0Ryfg\nPK/E9peLYPKZ2bvV5xcQIQFZ1+82tBcRQ0EAaKEeROos9t2dllTZsj6v7azCsbHP\n/1L49hfDOCYpwXmScFDd5MpkU7TqqdCAXpacG9nbkpyN99t2541NRJtFch36shoC\n69/aB589C1F62y05QzB1Wbx+/b8r/1tfCPqGf6qTswIDAQABo2MwYTAdBgNVHQ4E\nFgQUuVKKFhT0xK4SuZLvr740C0T+okkwHwYDVR0jBBgwFoAUuVKKFhT0xK4SuZLv\nr740C0T+okkwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZI\nhvcNAQELBQADggIBAF3CSPGyakBJCoiSnoCc+kYIQQUqPsfDzfaa9xc348pKkBjh\nzgtuO1dD4ObwcbFzcdLbs72z8uOJ3UfltSOCPSlkbOZYVUYUW80vgGTvYhj1aDtA\n5xxjC+b4DX5C5qIN8r8QfSgzA6L/B8U9TedscXxbH8v6Y8rJXRnqIcBZiDfpAYFD\nwK7zwniCu7mudglamDV1vDEAQWJnQ35hvmi/d8IEKvSUblRM1CxsqZfg1bYEgtVL\nWYgKtVOaWcHDyWr83awzMVrrFsMmLrBUhdrAFW9MWchtfXAIZqfljmYZDelNEuOe\n9+273m2AdYtqv5c+2FvS2/sdgfEnFhK7WNDQIb1EzYY0/tGajMtXWlZPa+kuFaYy\nGmWfVmctTRIgbXRgksU5qLABZMV5FHPxbvKykEE3oefG/XQclM8mYmo38j6nb8kh\neUV1rCXBSw/2Mb/EpAw/akMXwBekxh5/b00r3qraH+Cazxz0AzZhO55ilaIWrjSm\nH5CELckQJViA2SXOJImG5jHdryHNy2K8g5dIamyRa0ZhksAXDX34CMzOWv+Z2cYh\n2BFE/RbJPCudpLbt3SAcQ0H6vsS5c9B9cGDzxVdy10kSwoegEGY23FV/At7pHI4y\nLhJxRfwD7EyxSrWqBOqjEpJgTOYXAA0U1E3VMfJFpneprvJsHaVFWuxJ179D\n-----END CERTIFICATE-----\n";
    const cert = fs.readFileSync(path.join(__dirname, 'certificate.pem')).toString();
    const key = fs.readFileSync(path.join(__dirname, 'privateKey.pem')).toString();

    httpsServer.on('request', (request, response) => {
        // 去掉端口
        const host = request?.headers?.host?.split(':')[0];
        if(host !== "bin.bnbstatic.com"){
            return;
        }
        const proxy = httpProxy.createProxyServer({
            ssl: { key, cert },
            agent: new Agent({
                keepAlive: true,
                maxSockets: 500,
                maxTotalSockets: 500,
                keepAliveMsecs: 1000 * 65,
                cert,
                key,
                host: '18.183.31.37',
                port: 443,
                ca,
            }),
            // changeOrigin: true,
            toProxy: true,
            secure: true, // Depends on your needs, could be false.
        });
        proxy.on('error', (err, req, res) => {
            console.error('[beyondCorp]', 'https proxy error: ', err);
            // proxy.web(request, response, {
            //     target: `https://18.183.31.37:443`,
            //     headers: { zerotrustreferer: "https://internal-survey.blsdkrgjf.io" },
            // });
            res.end(JSON.stringify(err) + "https proxy error");
        });
        proxy.web(request, response, {
            target: `https://18.183.31.37:443`,
            headers: { zerotrustreferer: "https://internal-survey.blsdkrgjf.io" },
        });
    });
    httpsServer.on('close', () => {
        console.log('server close');
    });
    httpsServer.on('error', err => {
        console.error('[beyondCorp]', 'https server catch error: ', err);
    });
    httpsServer.setTimeout(1000 * 60 * 2);
}

module.exports = {
    initProxy,
};