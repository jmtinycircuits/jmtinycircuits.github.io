#include "JPEGStreamer.h"


JPEGStreamer::JPEGStreamer(JPEGDEC *_jpeg, Adafruit_USBD_CDC *_cdc, uint8_t _tinyTVType){
  jpeg = _jpeg;
  cdc = _cdc;

  tinyTVType = _tinyTVType;
}


void JPEGStreamer::fillBuffers(uint8_t *jpegBuffer0, uint8_t *jpegBuffer1, const uint16_t jpegBufferSize){
  // Check which buffer is locked by this core and fill it. When the
  // locked buffer is full, set it as waiting for the decoding core
  if(jpegBuffer0Semaphore == LOCKED_BY_CORE_0){
    if(incomingCDCHandler(jpegBuffer0, jpegBufferSize, jpegBuffer0ReadCount)){
      jpegBuffer0Semaphore = WAITING_FOR_CORE_1;
    }
  }else if(jpegBuffer1Semaphore == LOCKED_BY_CORE_0){
    if(incomingCDCHandler(jpegBuffer1, jpegBufferSize, jpegBuffer1ReadCount)){
      jpegBuffer1Semaphore = WAITING_FOR_CORE_1;
    }
  }else{
    // Both buffers were not locked by this core, check if they're unlocked and need to be locked by this core.
    if(jpegBuffer0Semaphore == UNLOCKED){
      jpegBuffer0Semaphore = LOCKED_BY_CORE_0;
    }else if(jpegBuffer1Semaphore == UNLOCKED){
      jpegBuffer1Semaphore = LOCKED_BY_CORE_0;
    }
  }
}


void JPEGStreamer::decode(uint8_t *jpegBuffer0, uint8_t *jpegBuffer1, uint16_t *screenBuffer, JPEG_DRAW_CALLBACK *pfnDraw){
  // Like core 0, acquire a lock on a jpeg buffer, use it, then set flag to give other core access
  if(jpegBuffer0Semaphore == LOCKED_BY_CORE_1){
    decode(jpegBuffer0, jpegBuffer0ReadCount, pfnDraw);
    jpegBuffer0Semaphore = UNLOCKED;
  }else if(jpegBuffer1Semaphore == LOCKED_BY_CORE_1){
    decode(jpegBuffer1, jpegBuffer1ReadCount, pfnDraw);
    jpegBuffer1Semaphore = UNLOCKED;
  }else{
    if(jpegBuffer0Semaphore == WAITING_FOR_CORE_1){
      jpegBuffer0Semaphore = LOCKED_BY_CORE_1;
    }else if(jpegBuffer1Semaphore == WAITING_FOR_CORE_1){
      jpegBuffer1Semaphore = LOCKED_BY_CORE_1;
    }
  }
}


void JPEGStreamer::stopBufferFilling(){
  // Need to reset frameSize to 0 to ensure assigned next frame size
  frameSize = 0;
  frameDeliminatorAcquired = false;
}


uint8_t JPEGStreamer::commandCheck(){
  // Check to see if the frame deliminator is found, or if a command should be responded to
  if(commandBuffer[0] == 'F' && commandBuffer[1] == 'R' && commandBuffer[2] == 'A' && commandBuffer[3] == 'M' && commandBuffer[4] == 'E'){
    frameDeliminatorAcquired = true;
    return COMMAND_TYPE::FRAME_DELIMINATOR;
  }else if(commandBuffer[0] == 'T' && commandBuffer[1] == 'Y' && commandBuffer[2] == 'P' && commandBuffer[3] == 'E'){
    if(tinyTVType == TINYTV_TYPE::TINYTV_2){
      cdc->print("TV2");
    }else if(tinyTVType == TINYTV_TYPE::TINYTV_MINI){
      cdc->print("TVMINI");
    }
    return COMMAND_TYPE::TINYTV_TYPE;
  }

  return COMMAND_TYPE::NONE;
}


void JPEGStreamer::commandSearch(){
  while(cdc->available()){
    // Move all bytes from right to left in cmd buffer
    commandBuffer[0] = commandBuffer[1];
    commandBuffer[1] = commandBuffer[2];
    commandBuffer[2] = commandBuffer[3];
    commandBuffer[3] = commandBuffer[4];

    // Store the just read from serial byte in cmd buffer
    commandBuffer[4] = cdc->read();

    // Check this after the bytes have been shifted, otherwise, will keep reading the same buffer
    if(commandCheck() == COMMAND_TYPE::FRAME_DELIMINATOR){
      break;
    }
  }
}


bool JPEGStreamer::fillBuffer(uint8_t *jpegBuffer, const uint16_t jpegBufferSize, uint16_t &jpegBufferReadCount, uint16_t available){
  // Figure out the frame size and go back to deliminator searching if out of bounds
  if(frameSize == 0 && available >= 2){
    frameSize = (((uint16_t)cdc->read()) << 8) | ((uint16_t)cdc->read());

    if(frameSize >= jpegBufferSize){
      stopBufferFilling();
      cdc->println("ERROR: Received frame size is too big, something went wrong, searching for frame deliminator...");
    }
  }

  // If the frame size was determined, get number of bytes to read, check if done filling, then fill if not done
  if(frameSize != 0){
    uint16_t bytesToReadCount = frameSize - jpegBufferReadCount;

    // Check if buffer full, stop and search for commands again if so
    if(bytesToReadCount == 0){
      stopBufferFilling();
      return true;
    }

    // Fill buffer at current index defined by number of bytes read, increase number of read bytes count
    jpegBufferReadCount += cdc->read(jpegBuffer + jpegBufferReadCount, bytesToReadCount);
  }

  // Buffer not filled yet, wait for more bytes
  return false;
}


// Either respond to commands, switch fill states, or timeout live flag
bool JPEGStreamer::incomingCDCHandler(uint8_t *jpegBuffer, const uint16_t jpegBufferSize, uint16_t &jpegBufferReadCount){
  uint16_t available = cdc->available();

  if(available > 0){
    if(frameDeliminatorAcquired){
      return fillBuffer(jpegBuffer, jpegBufferSize, jpegBufferReadCount, available);
    }else{
      // Search for deliminator to get back to filling buffers or respond to commands
      commandSearch();
    }
  }else{

  }

  // No buffer filled, wait for more bytes
  return false;
}


void JPEGStreamer::decode(uint8_t *jpegBuffer, uint16_t &jpegBufferReadCount, JPEG_DRAW_CALLBACK *pfnDraw){
  // Open and decode
  if (!jpeg->openRAM(jpegBuffer, jpegBufferReadCount, pfnDraw)){
    cdc->print("Could not open frame from RAM! Error: ");
    cdc->println(jpeg->getLastError());
    cdc->println("See https://github.com/bitbank2/JPEGDEC/blob/master/src/JPEGDEC.h#L83");
  }
  jpeg->decode(0, 0, 0);

  // Reset now that the frame is decoded
  jpegBufferReadCount = 0;
}