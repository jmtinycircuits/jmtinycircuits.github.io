import { Serial } from "../serial.js";
import { TV_SIZES, TV_TYPES, TV_JPEG_QUALITIES, TV_FIT_TYPES } from "./jpegstreamerCommon.js";

self.detectedTVType = TV_TYPES.NONE
self.currentJPEGQuality = 0;

self.offscreenCanvas = new OffscreenCanvas(216, 135);
self.offscreenCanvasCtx = self.offscreenCanvas.getContext("2d");


self.serial = new Serial([{usbVendorId:11914, usbProductId:10}]);
self.serial.onConnect = () => {
    self.postMessage({messageType: "connected", messageData: []});

    const decoder = new TextDecoder();
    let received = "";

    self.serial.onData = (data) => {
        if(self.detectedTVType == TV_TYPES.NONE){
            received += decoder.decode(data);

            // See if it is any of the TVs, pass a human readable string to the on detect function since it will be displayed
            if(received.indexOf(TV_TYPES.TINYTV_2) != -1){
                self.detectedTVType = TV_TYPES.TINYTV_2;
                self.offscreenCanvas.width = TV_SIZES.TINYTV_2_W;
                self.offscreenCanvas.height = TV_SIZES.TINYTV_2_H;
                self.currentJPEGQuality = TV_JPEG_QUALITIES.TINYTV_2;
                self.postMessage({messageType: "tvtype", messageData: [TV_TYPES.TINYTV_2]});
            }else if(received.indexOf(TV_TYPES.TINYTV_MINI) != -1){
                self.detectedTVType = TV_TYPES.TINYTV_MINI;
                self.offscreenCanvas.width = TV_SIZES.TINYTV_MINI_W;
                self.offscreenCanvas.height = TV_SIZES.TINYTV_MINI_H;
                self.currentJPEGQuality = TV_JPEG_QUALITIES.TINYTV_MINI;
                self.postMessage({messageType: "tvtype", messageData: [TV_TYPES.TINYTV_MINI]});
            }
        }
    }

    let requestTVType = () => {
        if(self.detectedTVType == TV_TYPES.NONE && self.serial.connected){
            setTimeout(() => {
                self.serial.write("TYPE", true);
                requestTVType();
            }, 250);
        }
    }
    requestTVType();
}
self.serial.onDisconnect = () => {
    self.detectedTVType = TV_TYPES.NONE;
    self.postMessage({messageType: "disconnected", messageData: []});
}



self.onmessage = async (message) => {
    if(message.data.messageType == "frame"){
        self.offscreenCanvasCtx.drawImage(message.data.messageData[0], 0, 0);

        self.offscreenCanvas.convertToBlob({type: "image/jpeg", quality: self.currentJPEGQuality}).then((blob) => {
            // Handle sending frames
            if(self.serial.connected){
                blob.arrayBuffer().then(async (buffer) => {
                    // Write the AVI chunk header bytes and the 4 bytes for the frame length
                    await self.serial.write(new Uint8Array([0x30, 0x30, 0x64, 0x63,  blob.size & 0x000000ff,
                                                                                    (blob.size & 0x0000ff00) >> 8,
                                                                                    (blob.size & 0x00ff0000) >> 16,
                                                                                    (blob.size & 0xff000000) >> 24]), false);
                    await self.serial.write(new Uint8Array(buffer), false);
                    self.postMessage({messageType: "lastframesent", messageData: []});
                });
            }else{
                self.postMessage({messageType: "lastframesent", messageData: []});
            }

            // // Handle drawing scaled and jpeg compressed frames in preview
            // createImageBitmap(blob, 0, 0, width, height).then((bitmap) => {
            //     this.onNewCompressedBitmap(bitmap, width, height);
            // });
        });
    }else if(message.data.messageType == "connect"){
        self.serial.connect();
    }else if(message.data.messageType == "disconnect"){
        self.serial.disconnect();
    }
};
