import { Serial } from "./serial.js";


let payload = new Uint8Array(1 * 1000);
let inputPayloadSize = document.getElementById("inputPayloadSize");
inputPayloadSize.oninput = (event) => {
    let val = parseInt(inputPayloadSize.value);
    if(val >= 1){
        payload = new Uint8Array(val * 1000);
        console.log("Payload size (kB):", val);
    }
}


let serial = new Serial([{usbVendorId: 11914, usbProductId: 5}, {usbVendorId:11914, usbProductId: 10}]);
serial.onConnect = () => {
    btnConnect.innerText = "Disconnect";
}
serial.onDisconnect = () => {
    btnConnect.innerText = "Connect";
}
serial.onData = (data) => {
    console.log(decoder.decode(data));
}


let btnConnect = document.getElementById("btnConnect");
btnConnect.onclick = (event) => {
    if(serial.connected){
        serial.disconnect();
        btnConnect.innerText = "Connect";
    }else{
        serial.connect();
        btnConnect.innerText = "Disconnect";
    }
}


// Only add setZeroTimeout to the window object, and hide everything
// else in a closure.
// https://dbaron.org/log/20100309-faster-timeouts
(function () {
    let timeouts = [];
    let messageName = "zero-timeout-message";
    function setZeroTimeout(fn) {
        timeouts.push(fn);
        window.postMessage(messageName, "*");
    }
    function handleMessage(event) {
        if (event.source == window && event.data == messageName) {
            event.stopPropagation();
            if (timeouts.length > 0) {
                var fn = timeouts.shift();
                fn();
            }
        }
    }
    window.addEventListener("message", handleMessage, true);
    window.setZeroTimeout = setZeroTimeout;
})();


let test = async () => {
    
    if(serial.connected){
        let t0 = performance.now();
        // await serial.write(payload, false);
        await serial.writer.write(payload);
        console.log((performance.now() - t0).toFixed(1), "ms");
    }

    window.setZeroTimeout(test);
}


window.setZeroTimeout(test);




let btnPickScreen = document.getElementById("btnPickScreen");
let inputWidth = document.getElementById("inputWidth");
let inputHeight = document.getElementById("inputHeight");
let inputJpegQuality = document.getElementById("inputJpegQuality");

let canvasOutput = document.getElementById("canvasOutput");
let ctx = canvasOutput.getContext("2d");

let offscreenCanvasOutput = new OffscreenCanvas(320, 240);
let offscreenCtx = offscreenCanvasOutput.getContext("2d");

let jpegQuality = 0.8;

inputWidth.oninput = (event) => {
    canvasOutput.width = parseInt(inputWidth.value);
    offscreenCanvasOutput.width = parseInt(inputWidth.value);
    console.warn(inputWidth.value);
}
inputHeight.oninput = (event) => {
    canvasOutput.height = parseInt(inputHeight.value);
    offscreenCanvasOutput.height = parseInt(inputHeight.value);
    console.warn(inputWidth.value);
}
inputJpegQuality.oninput = (event) => {
    jpegQuality = parseFloat(inputJpegQuality.value);
    console.warn(inputJpegQuality.value);
}


btnPickScreen.onclick = async (event) => {
    const displayMediaOptions = {
        video: {
            cursor: "always",
            frameRate: 60
        },
        audio: false
    };

    try {
        videoCapture.srcObject = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    } catch (err) {
        console.error(`Error: ${err}`);
    }
}


let processFrame = (now, metadata) => {
    videoCapture.requestVideoFrameCallback(processFrame);

    // Draw frame to canvas and scale
    offscreenCtx.drawImage(videoCapture, 0, 0, canvasOutput.width, canvasOutput.height);

    offscreenCanvasOutput.convertToBlob({type: "image/jpeg", quality: jpegQuality}).then((blob) => {
        console.log(blob.size);

        createImageBitmap(blob, 0, 0, canvasOutput.width, canvasOutput.height).then((bitmap) => {
            ctx.drawImage(bitmap, 0, 0, canvasOutput.width, canvasOutput.height);
        });
    });
}
// Only call this once outside of process function (otherwise will get overlapping calls)
videoCapture.requestVideoFrameCallback(processFrame);