import { Serial } from "./serial.js";

class JPEGStreamer{
    constructor(){
        // Constants
        this.TINYTV_2_W = 216;
        this.TINYTV_2_H = 135;
        this.TINYTV_MINI_W = 64;
        this.TINYTV_MINI_H = 64;

        this.TV_TYPES = {
            NONE: "NONE",
            TINYTV_2: "TV2",
            TINYTV_MINI: "TVMINI"
        };

        this.TV_JPEG_QUALITIES = {
            TINYTV_2: 0.8,
            TINYTV_MINI: 0.92
        }

        // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/frameRate
        // https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints
        const DISPLAY_MEDIA_OPTIONS = {
            video: {
                cursor: "always",
                frameRate: 60
            },
            audio: false
        };

        this.textDecoder = new TextDecoder();

        // General dynamic flags
        this.detectedTVType = this.TV_TYPES.NONE;
        this.lastFrameSent = true;

        // Serial
        this.serial = new Serial([{usbVendorId: 11914, usbProductId: 5}, {usbVendorId:11914, usbProductId: 10}]);
        this.serial.onConnect = () => {this.#onSerialConnect()};
        this.serial.onDisconnect = () => {this.#onSerialDisconnect()};
        this.serial.onData = (data) => {this.#processSerialData(data)};
        this.receivedText = "";

        // Frame capture
        // (https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor#examples)
        this.streamCapture = undefined;
        this.streamVideoTrack = undefined;
        this.streamProcessor = undefined;
        this.streamGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
        this.streamTransformer = undefined;

        // Canvas/frame scaling
        this.drawFrameX = 0;
        this.drawFrameY = 0;
        this.drawFrameW = this.TINYTV_2_W;  // Just choose TinyTV 2 as a default
        this.drawFrameH = this.TINYTV_2_H;
        this.offscreenCanvas = new OffscreenCanvas(this.drawFrameW, this.drawFrameH);
        this.offscreenCanvasCtx = this.offscreenCanvas.getContext("2d");

        // External callbacks triggered internally
        this.onSerialConnect = () => {};
        this.onSerialDisconnect = () => {};
        this.onTVDetected = (tvString) => {};
        this.onStreamReady = () => {};
        this.onNewCompressedBitmap = (bitmap) => {};    // Use to draw the final frame (that was sent over serial) to a preview canvas
    }


    #requestTVType(){
        // Every 100ms ask anything connected for its type (firmware should respond with a string)
        let timeout = undefined;
        let requestTVType = () => {
            if(this.detectedTVType == this.TV_TYPES.NONE && this.serial.connected){
                timeout = setTimeout(() => {
                    this.serial.write("TYPE", true);
                    requestTVType();
                }, 100);
            }
        }
        requestTVType();
    }


    #onSerialConnect(){
        // Reset so requesting TV type starts with a blank string
        this.receivedText = "";

        this.onSerialConnect();

        // Provide an initial delay to keep the UI transition looking smooth
        setTimeout(() => {this.#requestTVType()}, 250);
    }


    #onSerialDisconnect(){
        // Disconnected, reset since don't know what the next TV might be
        this.detectedTVType = this.TV_TYPES.NONE;
        this.onSerialDisconnect();
        this.#teardownStream();
    }


    async #processCapturedFrames(videoFrame, controller){
        console.log("Sending frames");

        if(this.lastFrameSent){
            this.lastFrameSent = false;
            
            this.offscreenCanvasCtx.drawImage(videoFrame, this.drawFrameX, this.drawFrameY, this.drawFrameW, this.drawFrameH);
            this.offscreenCanvas.convertToBlob({type: "image/jpeg", quality: 0.8}).then((blob) => {

                // Handle sending frames
                if(this.serial.connected){
                    blob.arrayBuffer().then(async (buffer) => {
                        await this.serial.write(new Uint8Array([(blob.size >> 8) & 0b11111111, blob.size & 0b11111111]), false);
                        await this.serial.write(new Uint8Array(buffer), false);
                        this.lastFrameSent = true;
                    });
                }

                // // Handle drawing scaled and jpeg compressed frames in preview
                // createImageBitmap(blob, 0, 0, canvasOutput.width, canvasOutput.height).then((bitmap) => {
                //     ctx.drawImage(bitmap, 0, 0, canvasOutput.width, canvasOutput.height);
                // });
            });
        }

        videoFrame.close();
    }


    async #setupStream(){
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getDisplayMedia(this.DISPLAY_MEDIA_OPTIONS)
            .then((stream) => {
                this.streamCapture = stream;
                this.streamVideoTrack = this.streamCapture.getVideoTracks()[0];
    
                this.streamProcessor = new MediaStreamTrackProcessor({ track: this.streamVideoTrack });
                this.streamTransformer = new TransformStream({
                    transform: this.#processCapturedFrames.bind(this)
                });
    
                this.streamProcessor.readable.pipeThrough(this.streamTransformer).pipeTo(this.streamGenerator.writable);

                resolve();
            })
            .catch((reason) => {
                reject(reason);
            });
        });
    }


    #teardownStream(){
        this.streamVideoTrack.stop();
    }


    #onTVDetect(tvString){
        this.onTVDetected(tvString);
        this.#setupStream().then((result) => {
            this.onStreamReady();
        });
    }


    // Only data the TVs should send back is the type of TV it is
    #processSerialData(data){
        let decodedData = this.textDecoder.decode(data);

        if(this.detectedTVType == this.TV_TYPES.NONE){
            this.receivedText += decodedData;

            // See if it is any of the TVs, pass a human readable string to the on detect function since it will be displayed
            if(this.receivedText.indexOf(this.TV_TYPES.TINYTV_2) != -1){
                this.detectedTVType = this.TV_TYPES.TINYTV_2;
                this.#onTVDetect("TinyTV 2");
            }else if(this.receivedText.indexOf(this.TV_TYPES.TINYTV_MINI) != -1){
                this.detectedTVType = this.TV_TYPES.TINYTV_MINI;
                this.#onTVDetect("TinyTV Mini");
            }
        }
    }


    connectSerial(){
        this.serial.connect();
    }


    disconnectSerial(){
        this.serial.disconnect();
    }
}

export { JPEGStreamer }