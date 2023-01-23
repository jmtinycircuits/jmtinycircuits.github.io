var express = require('express');
var path = require('path');
var https = require('https');
var fs = require('fs');

// This line is from the Node.js HTTPS documentation.
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

// Create a service (the app object is just a callback).
var app = express();

app.use('/', express.static(__dirname));

// Create an HTTPS service identical to the HTTP service.
https.createServer(options, app).listen(443);


app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/src/html/index.html'));
});

app.get('/update', function (req, res) {
    res.sendFile(path.join(__dirname, '/src/html/update.html'));
});

app.get('/choose', function (req, res) {
    res.sendFile(path.join(__dirname, '/src/html/choose.html'));
});

app.get('/stream', function (req, res) {
    res.sendFile(path.join(__dirname, '/src/html/stream.html'));
});