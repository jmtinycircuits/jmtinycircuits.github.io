import { JPEGStreamer } from "./lib/jpegstreamer/jpegstreamer.js";
import { TV_SIZES, TV_TYPES, TV_JPEG_QUALITIES, TV_FIT_TYPES } from "./lib/jpegstreamer/jpegstreamerCommon.js";
import { showOrHideElement, showAlertPopup } from "./lib/utility.js" 

let canvasOutput = document.getElementById("canvasOutput");
let canvasOutputCtx = canvasOutput.getContext("2d");
let btnConnectTV = document.getElementById("btnConnectTV");
let cropSelect = document.getElementById("cropSelect");

let inputContain = document.getElementById("inputContain");
let inputCover = document.getElementById("inputCover");
let inputFill = document.getElementById("inputFill");


// If serial not supported in this browser, show error and stop document from loading anymore
if (!("serial" in navigator)){
    btnConnectTV.disabled = true;
    showOrHideElement("errorAlert", true);
    stop();
}


let jpegStreamer = new JPEGStreamer();
jpegStreamer.onSerialConnect = () => {
    // Handle changing elements on the page
    btnConnectTV.classList.add("btn-warning");
    btnConnectTV.innerText = "Stop";
    btnConnectTV.onclick = () => {jpegStreamer.disconnectSerial()};
    showOrHideElement("divDetectingTVType", true);
}
jpegStreamer.onSerialDisconnect = () => {
    // Handle changing elements on the page
    btnConnectTV.classList.remove("btn-warning");
    btnConnectTV.innerText = "Connect TV";
    btnConnectTV.onclick = () => {jpegStreamer.connectSerial()};
    showOrHideElement("divDetectingTVType", false);
    showOrHideElement("divStreamingInterface", false);
}
jpegStreamer.onTVDetected = (tvString) => {
    showOrHideElement("divDetectingTVType", false).then(async (returned) => {
        showAlertPopup("detectedAlert", "Detected " + tvString + "!");
    });
}
jpegStreamer.onStreamReady = () => {
    showOrHideElement("divStreamingInterface", true);
}
jpegStreamer.onNewCompressedBitmap = (bitmap, width, height) => {
    canvasOutput.width = width;
    canvasOutput.height = height;
    canvasOutputCtx.drawImage(bitmap, 0, 0, width, height);
}


btnConnectTV.onclick = () => {jpegStreamer.connectSerial()};


inputContain.oninput = (event) => {
    jpegStreamer.setScreenFit(TV_FIT_TYPES.CONTAIN);
}
inputCover.oninput = (event) => {
    jpegStreamer.setScreenFit(TV_FIT_TYPES.COVER);
}
inputFill.oninput = (event) => {
    jpegStreamer.setScreenFit(TV_FIT_TYPES.FILL);
}