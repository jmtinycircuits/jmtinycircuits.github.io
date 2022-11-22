import { Serial } from "./serial.js";

class JPEGStreamer{
    constructor(){
        this.serial = new Serial();
    }
}

export { JPEGStreamer }