import { Serial } from "./serial.js";

class JPEGStreamer{
    constructor(){
        // Constants
        this.TINYTV_2_W = 216;
        this.TINYTV_2_H = 135;
        this.TINYTV_MINI_W = 64;
        this.TINYTV_MINI_H = 64;
        this.TINYTV_ROUND_W = 240;
        this.TINYTV_ROUND_H = 240;

        this.TV_TYPES = {
            NONE: "NONE",
            TINYTV_2: "TV2",
            TINYTV_MINI: "TVMINI",
            TINYTV_ROUND: "TVROUND",
        };

        this.TV_JPEG_QUALITIES = {
            TINYTV_2: 0.8,
            TINYTV_MINI: 0.92,
            TINYTV_ROUND: 0.6,
        }

        this.TV_FIT_TYPES = {
            CONTAIN: "CONTAIN",
            COVER: "COVER",
            FILL: "FILL"
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
        this.currentFitType = undefined;
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
        this.streamGenerator = undefined;
        this.streamTransformer = undefined;

        // Canvas/frame scaling
        this.fitFrameX = 0;
        this.fitFrameY = 0;
        this.fitFrameW = this.TINYTV_2_W;  // Just choose TinyTV 2 as a default
        this.fitFrameH = this.TINYTV_2_H;
        this.currentJPEGQuality = undefined;
        this.offscreenCanvas = new OffscreenCanvas(this.fitFrameW, this.fitFrameH);
        this.offscreenCanvasCtx = this.offscreenCanvas.getContext("2d");

        // https://stackoverflow.com/a/6454685
        let workerBlob = new Blob([document.querySelector('#worker').textContent], { type: "text/javascript" })
        this.convertWorker = new Worker(window.URL.createObjectURL(workerBlob));

        // External callbacks triggered internally
        this.onSerialConnect = () => {};
        this.onSerialDisconnect = () => {};
        this.onTVDetected = (tvString) => {};
        this.onStreamReady = () => {};
        this.onNewCompressedBitmap = (bitmap, width, height) => {};    // Use to draw the final frame (that was sent over serial) to a preview canvas
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
        if(this.lastFrameSent){
            this.lastFrameSent = false;
            
            let width = this.offscreenCanvas.width;
            let height = this.offscreenCanvas.height;
            this.#setScreenFit(undefined, videoFrame.codedWidth, videoFrame.codedHeight);

            this.offscreenCanvasCtx.beginPath();
            this.offscreenCanvasCtx.rect(0, 0, width, height);
            this.offscreenCanvasCtx.fillStyle = "black";
            this.offscreenCanvasCtx.fill();

            this.offscreenCanvasCtx.drawImage(videoFrame, this.fitFrameX, this.fitFrameY, this.fitFrameW, this.fitFrameH);

            this.convertWorker.postMessage([this.fitFrameX, this.fitFrameY, this.fitFrameW, this.fitFrameH, this.offscreenCanvas.transferToImageBitmap()]);
            this.lastFrameSent = true;
            // this.convertWorker.postMessage({canvas: this.offscreenCanvas}, [this.offscreenCanvas]);

            // let blob = await this.offscreenCanvas.convertToBlob({type: "image/jpeg", quality: this.currentJPEGQuality});

            // console.log(blob.size);
            // this.lastFrameSent = true;
            // videoFrame.close();
            // return;




            // this.offscreenCanvas.convertToBlob({type: "image/jpeg", quality: this.currentJPEGQuality}).then((blob) => {
            //     console.log(blob.size);
            //     // Handle sending frames
            //     if(this.serial.connected){
            //         blob.arrayBuffer().then(async (buffer) => {
            //             // Write the AVI chunk header bytes and the 4 bytes for the frame length
            //             await this.serial.write(new Uint8Array([0x30, 0x30, 0x64, 0x63,  blob.size & 0x000000ff,
            //                                                                             (blob.size & 0x0000ff00) >> 8,
            //                                                                             (blob.size & 0x00ff0000) >> 16,
            //                                                                             (blob.size & 0xff000000) >> 24]), false);
            //             await this.serial.write(new Uint8Array(buffer), false);
            //             this.lastFrameSent = true;
            //         });
            //     }else{
            //         this.lastFrameSent = true;
            //     }

            //     // Handle drawing scaled and jpeg compressed frames in preview
            //     createImageBitmap(blob, 0, 0, width, height).then((bitmap) => {
            //         this.onNewCompressedBitmap(bitmap, width, height);
            //     });
            // });
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
                this.streamGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
                this.streamTransformer = new TransformStream({
                    transform: this.#processCapturedFrames.bind(this),
                    writableStrategy: {highWaterMark: 1},
                    readableStrategy: {highWaterMark: 1}
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
        if(this.streamVideoTrack != undefined) this.streamVideoTrack.stop();
        this.lastFrameSent = true;
    }


    #onTVDetect(tvString){
        this.onTVDetected(tvString);
        this.#setupStream().then((result) => {
            this.onStreamReady();
        }).catch((reason) => {
            this.disconnectSerial();
        });
    }



    #fitWidth(screenW, screenH, videoW, videoH){
        this.fitFrameW = screenW;
        this.fitFrameH = videoH * (screenW / videoW);
        this.fitFrameX = 0;
        this.fitFrameY = (screenH/2) - (this.fitFrameH/2);
    }

    #fitHeight(screenW, screenH, videoW, videoH){
        this.fitFrameW = videoW * (screenH / videoH);
        this.fitFrameH = screenH;
        this.fitFrameX = (screenW/2) - (this.fitFrameW/2);
        this.fitFrameY = 0;
    }
    

    #fitContain(screenW, screenH, videoW, videoH){
        if(videoW > videoH){
            this.#fitWidth(screenW, screenH, videoW, videoH);
        }else{
            this.#fitHeight(screenW, screenH, videoW, videoH);
        }
    }

    #fitCover(screenW, screenH, videoW, videoH){
        if(videoW < videoH){
            this.#fitWidth(screenW, screenH, videoW, videoH);
        }else{
            this.#fitHeight(screenW, screenH, videoW, videoH);
        }
    }

    #fitFill(screenW, screenH){
        this.fitFrameW = screenW;
        this.fitFrameH = screenH;
        this.fitFrameX = 0;
        this.fitFrameY = 0;
    }

    #setScreenFit(fitType, videoW, videoH){
        if(fitType == undefined && this.currentFitType == undefined){           // Set a default if neither defined
            fitType = this.TV_FIT_TYPES.CONTAIN;
            this.currentFitType = fitType;
        }else if(fitType != undefined && this.currentFitType != undefined){     // Override with passed if both defined
            this.currentFitType = fitType;
        }else if(fitType == undefined && this.currentFitType != undefined){     // Use what's been set before
            fitType = this.currentFitType;
        }

        if(this.detectedTVType == this.TV_TYPES.TINYTV_2){
            if(fitType == undefined || fitType == this.TV_FIT_TYPES.CONTAIN){
                this.#fitContain(this.TINYTV_2_W, this.TINYTV_2_H, videoW, videoH);
            }else if(fitType == this.TV_FIT_TYPES.COVER){
                this.#fitCover(this.TINYTV_2_W, this.TINYTV_2_H, videoW, videoH);
            }else if(fitType == this.TV_FIT_TYPES.FILL){
                this.#fitFill(this.TINYTV_2_W, this.TINYTV_2_H);
            }
        }else if(this.detectedTVType == this.TV_TYPES.TINYTV_MINI){
            if(fitType == undefined || fitType == this.TV_FIT_TYPES.CONTAIN){
                this.#fitContain(this.TINYTV_MINI_W, this.TINYTV_MINI_H, videoW, videoH);
            }else if(fitType == this.TV_FIT_TYPES.COVER){
                this.#fitCover(this.TINYTV_MINI_W, this.TINYTV_MINI_H, videoW, videoH);
            }else if(fitType == this.TV_FIT_TYPES.FILL){
                this.#fitFill(this.TINYTV_MINI_W, this.TINYTV_MINI_H);
            }
        }else if(this.detectedTVType == this.TV_TYPES.TINYTV_ROUND){
            if(fitType == undefined || fitType == this.TV_FIT_TYPES.CONTAIN){
                this.#fitContain(this.TINYTV_ROUND_W, this.TINYTV_ROUND_H, videoW, videoH);
            }else if(fitType == this.TV_FIT_TYPES.COVER){
                this.#fitCover(this.TINYTV_ROUND_W, this.TINYTV_ROUND_H, videoW, videoH);
            }else if(fitType == this.TV_FIT_TYPES.FILL){
                this.#fitFill(this.TINYTV_ROUND_W, this.TINYTV_ROUND_H);
            }
        }
    }


    setScreenFit(fitType){
        if(fitType == this.TV_FIT_TYPES.CONTAIN || fitType == this.TV_FIT_TYPES.COVER || fitType == this.TV_FIT_TYPES.FILL){
            this.currentFitType = fitType;
        }
    }


    // Only data the TVs should send back is the type of TV it is
    #processSerialData(data){
        let decodedData = this.textDecoder.decode(data);

        if(this.detectedTVType == this.TV_TYPES.NONE){
            this.receivedText += decodedData;

            // See if it is any of the TVs, pass a human readable string to the on detect function since it will be displayed
            if(this.receivedText.indexOf(this.TV_TYPES.TINYTV_2) != -1){
                this.detectedTVType = this.TV_TYPES.TINYTV_2;
                this.offscreenCanvas.width = this.TINYTV_2_W;
                this.offscreenCanvas.height = this.TINYTV_2_H;
                this.currentJPEGQuality = this.TV_JPEG_QUALITIES.TINYTV_2;
                this.#onTVDetect("TinyTV 2");
            }else if(this.receivedText.indexOf(this.TV_TYPES.TINYTV_MINI) != -1){
                this.detectedTVType = this.TV_TYPES.TINYTV_MINI;
                this.offscreenCanvas.width = this.TINYTV_MINI_W;
                this.offscreenCanvas.height = this.TINYTV_MINI_H;
                this.currentJPEGQuality = this.TV_JPEG_QUALITIES.TINYTV_MINI;
                this.#onTVDetect("TinyTV Mini");
            }else if(this.receivedText.indexOf(this.TV_TYPES.TINYTV_ROUND) != -1){
                this.detectedTVType = this.TV_TYPES.TINYTV_ROUND;
                this.offscreenCanvas.width = this.TINYTV_ROUND_W;
                this.offscreenCanvas.height = this.TINYTV_ROUND_H;
                this.currentJPEGQuality = this.TV_JPEG_QUALITIES.TINYTV_ROUND;
                this.#onTVDetect("TinyTV Round");
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