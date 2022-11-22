import { Serial } from "./serial.js";


// Wrapper around showing and hiding elements
async function showOrHideElement(elementID, show=true){
    return new Promise((resolve, reject) => {
        let element = document.getElementById(elementID);
    
        if(show){   // Show
            element.classList.remove("invisible", "absolute", "opacity-0");
            element.classList.add("opacity-100");
            resolve();
        }else{      // Hide
            element.classList.remove("opacity-100");
            element.classList.add("invisible", "opacity-0");

            // After standard animation duration used across this page, take out of dom positioning
            setTimeout(() => {
                element.classList.add("absolute");
                resolve();
            }, 300);
        }
    });
}


// Show pop-up saying a TV was detected
async function showAlertPopup(elementID, alertText){
    return new Promise((resolve, reject) => {
        let element = document.getElementById(elementID);
    
        // Show
        document.getElementById(elementID + "Text").innerText = alertText;  // Should have a child with parent name + "Text"
        element.classList.remove("invisible", "opacity-0");
        element.classList.add("opacity-100");

        // Hide after a while
        setTimeout(() => {
            element.classList.remove("opacity-100");
            element.classList.add("invisible", "opacity-0");

            // After standard animation duration used across this page, take out of dom positioning
            setTimeout(() => {
                resolve();
            }, 300);
        }, 2250);
    });
}



let decoder = new TextDecoder();

let btnConnectTV = document.getElementById("btnConnectTV");
let videoCapture = document.getElementById("videoCapture");

let spanFrameLength = document.getElementById("spanFrameLength");
let spanTrySendFPS = document.getElementById("spanTrySendFPS");
let spanSendFPS = document.getElementById("spanSendFPS");
let spanCaptureFPS = document.getElementById("spanCaptureFPS");

let cropSelect = document.getElementById("cropSelect");

let offscreenCanvasOutput = new OffscreenCanvas(216, 135);
let offscreenCtx = offscreenCanvasOutput.getContext("2d");

let canvasOutput = document.getElementById("canvasOutput");
let ctx = canvasOutput.getContext("2d");

let detectedTV = false;


// Check if WebSerial is supported in this browser
if (!("serial" in navigator)){
    // The Web Serial API is not supported! Disable connect button and show error alert

    btnConnectTV.disabled = true;
    showOrHideElement("errorAlert", true)
}else{
    let drawVideoX = 0;
    let drawVideoY = 0;
    let drawVideoW = 216;
    let drawVideoH = 135;

    let fitVideo = (value) => {
        if(value.indexOf("Contain") != -1){
            console.log("Contain", videoCapture.videoWidth, videoCapture.videoHeight);
            if(videoCapture.videoWidth > videoCapture.videoHeight){
                drawVideoW = 216;
                drawVideoH = videoCapture.videoHeight * (216 / videoCapture.videoWidth);
                drawVideoX = 0;
                drawVideoY = (135/2) - (drawVideoH/2);
            }else{
                drawVideoH = 135;
                drawVideoW = videoCapture.videoWidth * (135 / videoCapture.videoHeight);
                drawVideoX = (216/2) - (drawVideoW/2);
                drawVideoY = 0;
            }
        }else if(value.indexOf("Cover") != -1){
            console.log("Cover", videoCapture.videoWidth, videoCapture.videoHeight);
            if(videoCapture.videoWidth < videoCapture.videoHeight){
                drawVideoW = 216;
                drawVideoH = videoCapture.videoHeight * (216 / videoCapture.videoWidth);
                drawVideoX = 0;
                drawVideoY = (135/2) - (drawVideoH/2);
            }else{
                drawVideoH = 135;
                drawVideoW = videoCapture.videoWidth * (135 / videoCapture.videoHeight);
                drawVideoX = (216/2) - (drawVideoW/2);
                drawVideoY = 0;
            }
        }else if(value.indexOf("Fill") != -1){
            console.log("Fill", videoCapture.videoWidth, videoCapture.videoHeight);
            drawVideoW = 216;
            drawVideoH = 135;
            drawVideoX = 0;
            drawVideoY = 0;
        }
    }

    cropSelect.oninput = (event) => {
        fitVideo(cropSelect.value);
    }

    let timeout = undefined;;
    let askType = () => {
        if(detectedTV == false){
            timeout = setTimeout(() => {
                serial.write("TYPE", true);
                askType();
            }, 100);
        }
    }

    let collectedData = "";



    let try_send_t0 = 0;
    let send_t0 = 0;
    let capture_t0 = 0;

    let jpegQuality = 0.8;

    // Very important to not write frames while other frames are being written! One frame at a time (otherwise get could nto open error 4 in firmware)
    let wroteFrame = true;

    let processFrame = (now, metadata) => {
        videoCapture.requestVideoFrameCallback(processFrame);

        let try_send_dt = (performance.now() - try_send_t0) / 1000;
        let capture_dt = (performance.now() - capture_t0) / 1000;
        spanGrabFPS.innerText = "Capture FPS: " + (1/capture_dt).toFixed(0);
        capture_t0 = performance.now();

        if(try_send_dt >= (1/parseInt(24))){
            spanTrySendFPS.innerText = "Try Send FPS: " + (1/try_send_dt).toFixed(0);
            try_send_t0 = performance.now();

            let frameLength = 0;

            if(wroteFrame == true){
                offscreenCtx.beginPath();
                offscreenCtx.rect(0, 0, 240, 135);
                offscreenCtx.fillStyle = "black";
                offscreenCtx.fill();

                // Draw frame to canvas and scale
                offscreenCtx.drawImage(videoCapture, drawVideoX, drawVideoY, drawVideoW, drawVideoH);

                wroteFrame = false;
                offscreenCanvasOutput.convertToBlob({type: "image/jpeg", quality: jpegQuality}).then((blob) => {
                    frameLength = blob.size;

                    spanFrameLength.innerText = "Frame length: " + frameLength;

                    // Handle sending frames. If no serial connected, set the frame as written (gets rid of bug where you can only start streaming once)
                    if(serial.connected){
                        blob.arrayBuffer().then(async (buffer) => {
                            await serial.write(new Uint8Array([(frameLength >> 8) & 0b11111111, frameLength & 0b11111111]), false);
                            await serial.write(new Uint8Array(buffer), false);
                            wroteFrame = true;

                            spanSendFPS.innerText = "Send FPS: " + (1/((performance.now() - send_t0)/1000)).toFixed(0);
                            send_t0 = performance.now();
                        });
                    }else{
                        wroteFrame = true;
                    }

                    // Handle drawing scaled and jpeg compressed frames in preview
                    createImageBitmap(blob, 0, 0, canvasOutput.width, canvasOutput.height).then((bitmap) => {
                        ctx.drawImage(bitmap, 0, 0, canvasOutput.width, canvasOutput.height);
                    });
                });
            }
        }
    }
    // Only call this once outside of process function (otherwise will get overlapping calls)
    videoCapture.requestVideoFrameCallback(processFrame);


    let onDetection = async (type) => {
        detectedTV = true;

        clearTimeout(timeout);
        collectedData = "";
        showOrHideElement("divDetectingTVType", false).then(async (returned) => {
            showAlertPopup("detectedAlert", "Detected " + type + "!");

            let captureStream = null;

            // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/frameRate
            // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
            const displayMediaOptions = {
                video: {
                    cursor: "always",
                    frameRate: 60
                },
                audio: false
            };

            try {
                captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
                showOrHideElement("divStreamingInterface", true);
                videoCapture.srcObject = captureStream;
            } catch (err) {
                showOrHideElement("divStreamingInterface", false);
                serial.disconnect();
                console.error(`Error: ${err}`);
            }
        });
    }



    // WebSerial was supported, setup the rest of the page functionally
    let serial = new Serial([{usbVendorId: 11914, usbProductId: 5}, {usbVendorId:11914, usbProductId: 10}]);
    serial.onConnect = () => {
        // Handle switching button
        btnConnectTV.classList.add("btn-warning");
        btnConnectTV.innerText = "Disconnect TV and Stop";
        btnConnectTV.onclick = serial.disconnect.bind(serial);

        collectedData = "";
        
        showOrHideElement("divDetectingTVType", true);

        // Wait a tiny bit so that the user can see the text and stuff just doesn't go flying past
        setTimeout(() => {
            askType();
        }, 250);
    }
    serial.onDisconnect = () => {
        // Handle switching button
        btnConnectTV.classList.remove("btn-warning");
        btnConnectTV.innerText = "Connect TV";
        btnConnectTV.onclick = serial.connect.bind(serial);

        detectedTV = false;
        wroteFrame = true;

        // Stop stream capture
        let tracks = videoCapture.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
        videoCapture.srcObject = null;

        showOrHideElement("divDetectingTVType", false);
        showOrHideElement("divStreamingInterface", false);
    }
    serial.onData = (data) => {
        console.log(decoder.decode(data));
        if(detectedTV == false){
            collectedData += decoder.decode(data);
            if(collectedData.indexOf("TV2") != -1){
                onDetection("TinyTV 2");
                canvasOutput.width = offscreenCanvasOutput.width = 216;
                canvasOutput.height = offscreenCanvasOutput.height = 135;
                jpegQuality = 0.8;
            }else if(collectedData.indexOf("TVMINI") != -1){
                onDetection("TinyTV Mini");
                canvasOutput.width = offscreenCanvasOutput.width = 64;
                canvasOutput.height = offscreenCanvasOutput.height = 64;
                jpegQuality = 0.92;
            }
        }
    }

    btnConnectTV.onclick = serial.connect.bind(serial);
}