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


uint8_t JPEGStreamer::commandCheck(uint8_t *jpegBuffer){
// "FF D8 FF E0" is the start of a jpeg image
  if(jpegBuffer[2] == 0xFF && jpegBuffer[3] == 0xD8 && jpegBuffer[4] == 0xFF && jpegBuffer[5] == 0xE0){
    frameDeliminatorAcquired = true;
    return COMMAND_TYPE::FRAME_DELIMINATOR;
    
  }else if(jpegBuffer[2] == 'T' && jpegBuffer[3] == 'Y' && jpegBuffer[4] == 'P' && jpegBuffer[5] == 'E'){
    if(tinyTVType == TINYTV_TYPE::TINYTV_2){
      cdc->print("TV2");
    }else if(tinyTVType == TINYTV_TYPE::TINYTV_MINI){
      cdc->print("TVMINI");
    }
    return COMMAND_TYPE::TINYTV_TYPE;
  }

  return COMMAND_TYPE::NONE;
}


void JPEGStreamer::commandSearch(uint8_t *jpegBuffer){
  while(cdc->available()){
    // Move all bytes from right to left in buffer
    jpegBuffer[0] = jpegBuffer[1];
    jpegBuffer[1] = jpegBuffer[2];
    jpegBuffer[2] = jpegBuffer[3];
    jpegBuffer[3] = jpegBuffer[4];
    jpegBuffer[4] = jpegBuffer[5];
    jpegBuffer[5] = cdc->read();

    if(commandCheck(jpegBuffer) == COMMAND_TYPE::FRAME_DELIMINATOR){
      break;
    }
  }
}


bool JPEGStreamer::fillBuffer(uint8_t *jpegBuffer, const uint16_t jpegBufferSize, uint16_t &jpegBufferReadCount){
  // Figure out the frame size and go back to deliminator searching if out of bounds
  if(frameSize == 0){
    frameSize = (((uint16_t)jpegBuffer[0]) << 8) | ((uint16_t)jpegBuffer[1]);

    if(frameSize >= jpegBufferSize){
      stopBufferFilling();
      cdc->println("ERROR: Received frame size is too big, something went wrong, searching for frame deliminator...");
    }
  }else{
    // If the frame size was determined, get number of bytes to read, check if done filling, then fill if not done
    uint16_t bytesToReadCount = frameSize - (jpegBufferReadCount+1);

    if(bytesToReadCount == 0){
      stopBufferFilling();
      return true;
    }

    // Just in case, check if this read will take us out of bounds, if so, restart (shouldn't happen except for future changes forgetting about this)
    if(jpegBufferReadCount+bytesToReadCount < frameSize){
      jpegBufferReadCount += cdc->read((jpegBuffer+2) + jpegBufferReadCount, bytesToReadCount);
    }else{
      // Not going to get reset by decode so do it here so it doesn't get stuck out of bounds forever
      // (reset to 4 since deliminator searcher will find the first 4 jpeg bytes)
      jpegBufferReadCount = 4;

      stopBufferFilling();
      cdc->println("ERROR: Tried to place jpeg data out of bounds...");
    }
  }

  // Buffer not filled yet, wait for more bytes
  return false;
}


// Either respond to commands, switch fill states plus fill buffers, or timeout live flag
bool JPEGStreamer::incomingCDCHandler(uint8_t *jpegBuffer, const uint16_t jpegBufferSize, uint16_t &jpegBufferReadCount){
  uint16_t available = cdc->available();

  if(available > 0){
    liveTimeoutStart = millis();

    if(frameDeliminatorAcquired){
      live = true;
      return fillBuffer(jpegBuffer, jpegBufferSize, jpegBufferReadCount);
    }else{
      // Search for deliminator to get back to filling buffers or respond to commands
      commandSearch(jpegBuffer);
    }
  }else if(millis() - liveTimeoutStart >= liveTimeoutLimitms){
    // A timeout is a time to reset states of both jpeg buffers, reset everything
    stopBufferFilling();
    live = false;

    // Wait for decoding to finish and then reset incoming jpeg data read counts (otherwise may start at something other than zero next time)
    while(jpegBuffer0Semaphore != JPEG_BUFFER_SEMAPHORE::UNLOCKED && jpegBuffer1Semaphore != JPEG_BUFFER_SEMAPHORE::UNLOCKED){}
    // (reset to 4 since deliminator searcher will find the first 4 jpeg bytes)
    jpegBuffer0ReadCount = 4;
    jpegBuffer1ReadCount = 4;
  }

  // No buffer filled, wait for more bytes
  return false;
}


void JPEGStreamer::decode(uint8_t *jpegBuffer, uint16_t &jpegBufferReadCount, JPEG_DRAW_CALLBACK *pfnDraw){
  // Open and decode (start 2 bytes from start since those are the frame size bytes)
  if (!jpeg->openRAM(jpegBuffer+2, jpegBufferReadCount, pfnDraw)){
    cdc->print("Could not open frame from RAM! Error: ");
    cdc->println(jpeg->getLastError());
    cdc->println("See https://github.com/bitbank2/JPEGDEC/blob/master/src/JPEGDEC.h#L83");
  }
  jpeg->decode(0, 0, 0);

  uint32_t dt = millis() - t0;
  if(dt > 0){
    cdc->print((uint16_t)(1.0f / ((millis() - t0)/1000.0f)));
    cdc->println(" FPS");
    t0 = millis();
  }

  // Reset now that the frame is decoded (reset to 4 since deliminator searcher will find the first 4 jpeg bytes)
  jpegBufferReadCount = 4;
}
