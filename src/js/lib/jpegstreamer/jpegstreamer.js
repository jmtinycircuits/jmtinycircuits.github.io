import { TV_SIZES, TV_TYPES, TV_JPEG_QUALITIES, TV_FIT_TYPES } from "./jpegstreamerCommon.js";

class JPEGStreamer{
    constructor(){
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
        this.detectedTVType = TV_TYPES.NONE;
        this.currentFitType = undefined;
        this.lastFrameSent = true;

        // Serial
        this.vendorID = 11914;
        this.productID = 10;

        // this.serial = new Serial([{usbVendorId: 11914, usbProductId: 5}, {usbVendorId:11914, usbProductId: 10}]);
        // this.serial.onConnect = () => {this.#onSerialConnect()};
        // this.serial.onDisconnect = () => {this.#onSerialDisconnect()};
        // this.serial.onData = (data) => {this.#processSerialData(data)};

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
        this.fitFrameW = TV_SIZES.TINYTV_2_W;  // Just choose TinyTV 2 as a default
        this.fitFrameH = TV_SIZES.TINYTV_2_H;
        this.offscreenCanvas = new OffscreenCanvas(this.fitFrameW, this.fitFrameH);
        this.offscreenCanvasCtx = this.offscreenCanvas.getContext("2d");

        // const workerScript = 
        // "self.vendorID = " + this.vendorID + ";" +
        // "self.productID = " + this.productID + ";" +
        // `
        // self.offscreenCanvas = new OffscreenCanvas(216, 135);
        // self.offscreenCanvasCtx = this.offscreenCanvas.getContext("2d");
        // self.port = undefined;
        
        // self.onmessage = async (message) => {
        //     if(message.data.messageType == "connect"){
        //         (await navigator.serial.getPorts()).forEach(async (port, index, ports) => {
        //             const info = port.getInfo();
        //             if(info.usbProductId == self.productID && info.usbVendorId == self.vendorID){
        //                 self.port = port;
        //                 await self.port.open({ baudRate: 2000000, bufferSize: 2048 });
        //                 return;
        //             }
        //         });
        //     }
        // };
        // `
        

        // let workerBlob = new Blob([workerScript], { type: "text/javascript" });
        // this.convertWorker = new Worker(window.URL.createObjectURL(workerBlob));
        this.convertWorker = new Worker("/src/js/lib/jpegstreamer/jpegstreamerWorker.js", {
            type: 'module'
        });
        this.convertWorker.onmessage = async (message) => {
            if(message.data.messageType == "lastframesent"){
                this.lastFrameSent = true;
            }else if(message.data.messageType == "connected"){
                this.#onSerialConnect();
            }else if(message.data.messageType == "disconnected"){
                this.#onSerialDisconnect();
            }else if(message.data.messageType == "tvtype"){
                if(message.data.messageData == TV_TYPES.TINYTV_2){
                    this.detectedTVType = TV_TYPES.TINYTV_2;
                    this.offscreenCanvas.width = TV_SIZES.TINYTV_2_W;
                    this.offscreenCanvas.height = TV_SIZES.TINYTV_2_H;
                    this.#onTVDetect("TinyTV 2");
                }else if(message.data.messageData == TV_TYPES.TINYTV_MINI){
                    this.detectedTVType = TV_TYPES.TINYTV_MINI;
                    this.offscreenCanvas.width = TV_SIZES.TINYTV_MINI_W;
                    this.offscreenCanvas.height = TV_SIZES.TINYTV_MINI_H;
                    this.#onTVDetect("TinyTV Mini");
                }
            }
        };

        // External callbacks triggered internally
        this.onSerialConnect = () => {};
        this.onSerialDisconnect = () => {};
        this.onTVDetected = (tvString) => {};
        this.onStreamReady = () => {};
        this.onNewCompressedBitmap = (bitmap, width, height) => {};    // Use to draw the final frame (that was sent over serial) to a preview canvas
    }


    #onSerialConnect(){
        this.onSerialConnect();
    }


    #onSerialDisconnect(){
        // Disconnected, reset since don't know what the next TV might be
        this.detectedTVType = TV_TYPES.NONE;
        this.onSerialDisconnect();
        this.#teardownStream();
    }


    async #processCapturedFrames(videoFrame, controller){
        if(this.lastFrameSent){
            this.lastFrameSent = false;
            
            let width = this.offscreenCanvas.width;
            let height = this.offscreenCanvas.height;
            this.#setScreenFit(undefined, videoFrame.codedWidth, videoFrame.codedHeight);

            // Fill offscreen canvas with black
            this.offscreenCanvasCtx.beginPath();
            this.offscreenCanvasCtx.rect(0, 0, width, height);
            this.offscreenCanvasCtx.fillStyle = "black";
            this.offscreenCanvasCtx.fill();

            // Scale stream source to TV size
            this.offscreenCanvasCtx.drawImage(videoFrame, this.fitFrameX, this.fitFrameY, this.fitFrameW, this.fitFrameH);

            // Send frame dimensions and data to worker to be made
            // into a jpeg and written to the device through serial
            this.convertWorker.postMessage({messageType: "frame", messageData: [this.offscreenCanvas.transferToImageBitmap()]});
            // this.convertWorker.postMessage([this.fitFrameW, this.fitFrameH, this.offscreenCanvas.transferToImageBitmap()]);

            // this.convertWorker.postMessage([this.fitFrameX, this.fitFrameY, this.fitFrameW, this.fitFrameH, this.offscreenCanvas.transferToImageBitmap()]);
            // this.lastFrameSent = true;
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

        // Call the stream setup after a small delay to give the user time to process
        setTimeout(() => {
            this.#setupStream().then((result) => {
                this.onStreamReady();
            }).catch((reason) => {
                this.disconnectSerial();
            });
        }, 250);
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
            fitType = TV_FIT_TYPES.CONTAIN;
            this.currentFitType = fitType;
        }else if(fitType != undefined && this.currentFitType != undefined){     // Override with passed if both defined
            this.currentFitType = fitType;
        }else if(fitType == undefined && this.currentFitType != undefined){     // Use what's been set before
            fitType = this.currentFitType;
        }

        if(this.detectedTVType == TV_TYPES.TINYTV_2){
            if(fitType == undefined || fitType == TV_FIT_TYPES.CONTAIN){
                this.#fitContain(TV_SIZES.TINYTV_2_W, TV_SIZES.TINYTV_2_H, videoW, videoH);
            }else if(fitType == TV_FIT_TYPES.COVER){
                this.#fitCover(TV_SIZES.TINYTV_2_W, TV_SIZES.TINYTV_2_H, videoW, videoH);
            }else if(fitType == TV_FIT_TYPES.FILL){
                this.#fitFill(TV_SIZES.TINYTV_2_W, TV_SIZES.TINYTV_2_H);
            }
        }else if(this.detectedTVType == TV_TYPES.TINYTV_MINI){
            if(fitType == undefined || fitType == TV_FIT_TYPES.CONTAIN){
                this.#fitContain(TV_SIZES.TINYTV_MINI_W, TV_SIZES.TINYTV_MINI_H, videoW, videoH);
            }else if(fitType == TV_FIT_TYPES.COVER){
                this.#fitCover(TV_SIZES.TINYTV_MINI_W, TV_SIZES.TINYTV_MINI_H, videoW, videoH);
            }else if(fitType == TV_FIT_TYPES.FILL){
                this.#fitFill(TV_SIZES.TINYTV_MINI_W, TV_SIZES.TINYTV_MINI_H);
            }
        }
    }


    setScreenFit(fitType){
        if(fitType == TV_FIT_TYPES.CONTAIN || fitType == TV_FIT_TYPES.COVER || fitType == TV_FIT_TYPES.FILL){
            this.currentFitType = fitType;
        }
    }


    async connectSerial(){
        // Make sure the main thread had the user pair a TinyTV
        // serial port and it is plugged in for the worker
        let portFound = false;

        (await navigator.serial.getPorts()).forEach((port, index, ports) => {
            const info = port.getInfo();
            if(info.usbProductId == this.productID && info.usbVendorId == this.vendorID){
                portFound = true;
                return;
            }
        });
        
        // No device, make the user pair one for the worker to auto connect to
        if(!portFound){
            try{
                await navigator.serial.requestPort({filters: [{usbVendorId:this.vendorID, usbProductId:this.productID}]});
                portFound = true;
            }catch(err){
                portFound = false;
                console.warn(err);
            }
        }

        if(portFound){
            this.convertWorker.postMessage({messageType:'connect', messageData:[]});
        }
    }


    disconnectSerial(){
        this.convertWorker.postMessage({messageType:'disconnect', messageData:[]});
    }
}

export { JPEGStreamer }