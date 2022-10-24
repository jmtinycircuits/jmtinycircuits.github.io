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
    if(fillJpegBufferFromCDC(jpegBuffer0, jpegBufferSize, jpegBuffer0Index)){
      jpegBuffer0Semaphore = WAITING_FOR_CORE_1;
    }
  }else if(jpegBuffer1Semaphore == LOCKED_BY_CORE_0){
    if(fillJpegBufferFromCDC(jpegBuffer1, jpegBufferSize, jpegBuffer1Index)){
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
    decode(jpegBuffer0, jpegBuffer0Index, pfnDraw);
    jpegBuffer0Semaphore = UNLOCKED;
  }else if(jpegBuffer1Semaphore == LOCKED_BY_CORE_1){
    decode(jpegBuffer1, jpegBuffer1Index, pfnDraw);
    jpegBuffer1Semaphore = UNLOCKED;
  }else{
    if(jpegBuffer0Semaphore == WAITING_FOR_CORE_1){
      jpegBuffer0Semaphore = LOCKED_BY_CORE_1;
    }else if(jpegBuffer1Semaphore == WAITING_FOR_CORE_1){
      jpegBuffer1Semaphore = LOCKED_BY_CORE_1;
    }
  }
}



bool JPEGStreamer::fillJpegBufferFromCDC(uint8_t *jpegBuffer, const uint16_t jpegBufferSize, uint16_t &jpegBufferIndex){
  uint16_t available = cdc->available();
  if(available > 0){
    if(frameDeliminatorAcquired){
      // Figure out the frame size and go back to deliminator searching if out of bounds
      if(frameSize == 0 && available >= 2){
        frameSize = (((uint16_t)cdc->read()) << 8) | ((uint16_t)cdc->read());

        if(frameSize >= jpegBufferSize){
          frameSize = 0;
          frameDeliminatorAcquired = false;
        }
      }

      // If the frame size was determined, get number of bytes to read, check if done filling, then fill if not done
      if(frameSize != 0){
        uint16_t bytesToReadCount = frameSize - (jpegBufferIndex + 1);

        if(bytesToReadCount == 0){
          frameSize = 0;
          frameDeliminatorAcquired = false;
          return true;
        }

        // Read serial bytes into jpeg buffer starting at 'jpegBufferIndex', and increment 'jpegBufferIndex' by number of bytes read
        jpegBufferIndex += cdc->read(jpegBuffer + jpegBufferIndex, bytesToReadCount);
      }
    }else{
      // Search for deliminator
      while(cdc->available()){
        // Move all bytes from right to left in deliminator buffer
        commandBuffer[0] = commandBuffer[1];
        commandBuffer[1] = commandBuffer[2];
        commandBuffer[2] = commandBuffer[3];
        commandBuffer[3] = commandBuffer[4];

        // Store the just read from serial byte in deliminator buffer
        commandBuffer[4] = cdc->read();

        // Check to see if the frame deliminator is found, or if a command should be responded to
        if(commandBuffer[0] == 'F' && commandBuffer[1] == 'R' && commandBuffer[2] == 'A' && commandBuffer[3] == 'M' && commandBuffer[4] == 'E'){
          frameDeliminatorAcquired = true;
          break;
        }else if(commandBuffer[0] == 'T' && commandBuffer[1] == 'Y' && commandBuffer[2] == 'P' && commandBuffer[3] == 'E'){
          if(tinyTVType == TINYTV_TYPE::TINYTV_2){
            cdc->print("TV2");
          }else if(tinyTVType == TINYTV_TYPE::TINYTV_MINI){
            cdc->print("TVMINI");
          }
        }
      }
    }
  }

  // No buffer filled, return false for now and wait for more serial data to finish filling this buffer
  return false;
}


void JPEGStreamer::decode(uint8_t *jpegBuffer, uint16_t &jpegBufferIndex, JPEG_DRAW_CALLBACK *pfnDraw){
  // Open and decode
  if (!jpeg->openRAM(jpegBuffer, jpegBufferIndex-5, pfnDraw)){
    cdc->print("Could not open frame from RAM! Error (https://github.com/bitbank2/JPEGDEC/blob/master/src/JPEGDEC.h#L83): ");
    cdc->println(jpeg->getLastError());
  }
  jpeg->decode(0, 0, 0);

  // Reset now that the frame is decoded
  jpegBufferIndex = 0;
}