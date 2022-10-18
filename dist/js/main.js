import { Serial } from "./serial.js";


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

let spanJPEGQuality = document.getElementById("spanJPEGQuality");

let offscreenCanvasOutput = new OffscreenCanvas(216, 135);
let offscreenCtx = offscreenCanvasOutput.getContext("2d");

let canvasOutput = document.getElementById("canvasOutput");
let ctx = canvasOutput.getContext("2d");

let detectedTV = false;


const targetFrameLength = 8000;
const targetFrameLengthMargin = 500;
const targetFrameLengthMin = targetFrameLength-targetFrameLengthMargin;
const targetFrameLengthMax = targetFrameLength+targetFrameLengthMargin;
let jpegQuality = 0.6;
let jpegQualityStep = 0.05;


// Check if WebSerial is supported in this browser
if (!("serial" in navigator)){
    // The Web Serial API is not supported! Disable connect button and show error alert

    btnConnectTV.disabled = true;
    showOrHideElement("errorAlert", true)
}else{
    let timeout = undefined;;
    let askType = () => {
        timeout = setTimeout(() => {
            serial.write("TYPE", true);
            askType();
        }, 100);
    }

    let collectedData = "";



    let t0 = 0;
    let sentCount = 0;
    let ct0 = 0;

    let processFrame = (now, metadata) => {
        
        ct0 = performance.now();
        let dt = (performance.now() - t0) / 1000;
        let fps = 1.0 / dt;

        if(fps <= parseInt(24)){
            t0 = performance.now();

            // Draw frame to canvas and scale
            offscreenCtx.drawImage(videoCapture, 0, 0, canvasOutput.width, canvasOutput.height);

            let frameLength = 0;

            let recursiveAdjust = () => {
                offscreenCanvasOutput.convertToBlob({type: "image/jpeg", quality: jpegQuality}).then((blob) => {
                    frameLength = blob.size;

                    if(frameLength < targetFrameLengthMin && jpegQuality + jpegQualityStep <= 1.0){
                        jpegQuality += jpegQualityStep;
                        recursiveAdjust();
                    }else if(frameLength > targetFrameLengthMax && jpegQuality - jpegQualityStep >= 0.0){
                        jpegQuality -= jpegQualityStep;
                        recursiveAdjust();
                    }else{
                        spanJPEGQuality.innerText = "JPEG Quality: " + (100.0 * jpegQuality).toFixed(0) + "%";

                        // Handle sending frames
                        if(serial.connected){
                            blob.arrayBuffer().then((buffer) => {
                                serial.write(new Uint8Array(buffer), false);
                                serial.write("FRAME", true);
                            });
                        }
        
                        // Handle drawing scaled and jpeg compressed frames in preview
                        createImageBitmap(blob, 0, 0, canvasOutput.width, canvasOutput.height).then((bitmap) => {
                            ctx.drawImage(bitmap, 0, 0, canvasOutput.width, canvasOutput.height);
                        });
                    }
                });
            }
            recursiveAdjust();
        }

        videoCapture.requestVideoFrameCallback(processFrame);
    }



    let onDetection = async (type) => {
        detectedTV = true;

        clearTimeout(timeout);
        collectedData = "";
        showOrHideElement("divDetectingTVType", false).then(async (returned) => {
            showAlertPopup("detectedAlert", "Detected " + type + "!");

            let captureStream = null;

            const displayMediaOptions = {
                video: {
                    cursor: "always"
                },
                audio: false
            };

            try {
                captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

                showOrHideElement("divStreamingInterface", true);

                videoCapture.srcObject = captureStream;
                videoCapture.requestVideoFrameCallback(processFrame);
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

        
        showOrHideElement("divDetectingTVType", true);

        // Wait a tiny bit so that the user can see the text and stuff just doesn't go flying past
        setTimeout(() => {
            askType();
        }, 400);
    }
    serial.onDisconnect = () => {
        // Handle switching button
        btnConnectTV.classList.remove("btn-warning");
        btnConnectTV.innerText = "Connect TV";
        btnConnectTV.onclick = serial.connect.bind(serial);

        detectedTV = false;

        showOrHideElement("divDetectingTVType", false);
        showOrHideElement("divStreamingInterface", false);
    }
    serial.onData = (data) => {
        if(detectedTV == false){
            collectedData += decoder.decode(data);
            if(collectedData.indexOf("TV2") != -1){
                onDetection("TinyTV 2");
            }else if(collectedData.indexOf("TVMini") != -1){
                onDetection("TinyTV Mini");
            }
        }
    }

    btnConnectTV.onclick = serial.connect.bind(serial);
}