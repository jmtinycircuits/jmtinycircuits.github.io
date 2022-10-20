#include <TFT_eSPI.h>
#include <JPEGDEC.h>
#include <Adafruit_TinyUSB.h>
#include "JPEGStreamer.h"


// Screen and drawing area parameters
#define X 24
#define Y 0
#define WIDTH 216
#define HEIGHT 135


#define STREAM_BUFFER_SIZE 20000

// Crop parameter
#define CORNER_CROP_RADIUS 25


// ##### CORE 0 GLOBALS #####
// F R A M E (read/write by core 0)
uint8_t frameDelim[5];
Adafruit_USBD_CDC cdc;

// Where in either buffer we are putting bytes from serial (read/write core 0)
uint16_t jpegBuf0Index = 0;
uint16_t jpegBuf1Index = 0;

// Flag to track if on track to store incoming data
bool frameDeliminatorAcquired = false;

// The incoming frame size as received after deliminator
uint16_t frameSize = 0;


// ##### CORE 1 GLOBALS #####
// (used by core 1)
TFT_eSPI tft = TFT_eSPI();
JPEGDEC jpeg;

// Frame buf that will be sent to the screen (read/write core 1)
uint16_t screenBuffer[WIDTH * HEIGHT];

// (read/write by core 1)
uint8_t cropRadiusLimits[CORNER_CROP_RADIUS*2];



// ##### CORE 0 and 1 GLOBALS #####
// Incoming jpeg frame data with max 0.65 quality (write core 0, read core 1)
uint8_t jpegBuf0[STREAM_BUFFER_SIZE];
uint8_t jpegBuf1[STREAM_BUFFER_SIZE];

enum JPEG_BUF_SEMAPHORE {
  UNLOCKED,
  LOCKED_BY_CORE_0,
  LOCKED_BY_CORE_1,
  WAITING_FOR_CORE_1
};

// (read/write core 0 and 1)
// Ensure logic will not allow cores to write to same at flag at same time. Likely OK
// for one core to write and one to read at a time. For example, If jpegBuf0Semaphore
// is set to LOCKED_BY_CORE_0, then core 1 should never try to write to that flag unless
// it is set to LOCKED_BY_CORE_1 (which means core 0 should not try tot write to the flag,
// only read it and maybe it misses it on one loop but will get it the next)
enum JPEG_BUF_SEMAPHORE jpegBuf0Semaphore = UNLOCKED;
enum JPEG_BUF_SEMAPHORE jpegBuf1Semaphore = UNLOCKED;


// ***** CORE 0, incoming serial handler *****
void setup(){
  // Turn this one off since it doesn't provide nice API for buffered streaming
  Serial.end();

  // Use this instead (pass 0 since doesn't matter for USBSerial/Virtual)
  cdc.begin(0);
}


// Returns true when done filling passed buffer with valid jpeg data (buffer index is used and reset externally)
bool fillJpegBufferFromSerial(uint8_t *jpegBuf, uint16_t &jpegBufIndex){
  uint16_t available = cdc.available();
  if(available > 0){

    // If deliminator just found, next two bytes should be for size of frame followed by the actual jpeg bytes
    // If deliminator set as not found, search for it byte by byte and then set 'frameDeliminatorAcquired'
    if(frameDeliminatorAcquired){

      // Figure out the frame size and check that it is in bounds
      if(frameSize == 0 && available >= 2){
        frameSize = (((uint16_t)cdc.read()) << 8) | ((uint16_t)cdc.read());

        // If the frame size is larger than the buffer, something went wrong and should
        // go back to looking for deliminator a byte at a time (get back on track)
        if(frameSize >= STREAM_BUFFER_SIZE){
          frameSize = 0;
          frameDeliminatorAcquired = false;
        }
      }

      // If the frame size was determined, fill buffer with incoming data and eventually return true to signify filled
      if(frameSize != 0){
        uint16_t bytesToReadCount = frameSize-(jpegBufIndex+1);

        // Check if jpeg buffer is full, if so, go back to deliminator searching
        // (should be quick if on track), and return that buffer is full
        if(bytesToReadCount == 0){
          frameSize = 0;
          frameDeliminatorAcquired = false;
          return true;
        }

        // Read serial bytes into jpeg buffer starting at 'jpegBufIndex',
        // also increment 'jpegBufIndex' by number of bytes read
        jpegBufIndex += cdc.read(jpegBuf + jpegBufIndex, bytesToReadCount);
      }

    }else{
      // No deliminator, need to get back on track for collecting data in right order
      while(cdc.available()){
        // Move all bytes from right to left in deliminator buffer
        frameDelim[0] = frameDelim[1];
        frameDelim[1] = frameDelim[2];
        frameDelim[2] = frameDelim[3];
        frameDelim[3] = frameDelim[4];

        // Store the just read from serial byte in deliminator buffer
        frameDelim[4] = cdc.read();

        // Check to see if the frame deliminator is found, or if a command should be responded to
        if(frameDelim[0] == 'F' && frameDelim[1] == 'R' && frameDelim[2] == 'A' && frameDelim[3] == 'M' && frameDelim[4] == 'E'){
          frameDeliminatorAcquired = true;
          break;
        }else if(frameDelim[0] == 'T' && frameDelim[1] == 'Y' && frameDelim[2] == 'P' && frameDelim[3] == 'E'){
          cdc.print("TV2");
        }
      }
    }
  }

  // No buffer filled, return false for now and wait for 
  // more serial data to finish filling this buffer
  return false;
}


void loop(){
  // Check which buffer is locked by this core and fill it. When the
  // locked buffer is full, set it as waiting for the decoding core
  if(jpegBuf0Semaphore == LOCKED_BY_CORE_0){
    if(fillJpegBufferFromSerial(jpegBuf0, jpegBuf0Index)){
      jpegBuf0Semaphore = WAITING_FOR_CORE_1;
    }
  }else if(jpegBuf1Semaphore == LOCKED_BY_CORE_0){
    if(fillJpegBufferFromSerial(jpegBuf1, jpegBuf1Index)){
      jpegBuf1Semaphore = WAITING_FOR_CORE_1;
    }
  }else{
    // Both buffers were not locked by this core, check if they're unlocked and need to be locked by this core.
    if(jpegBuf0Semaphore == UNLOCKED){
      jpegBuf0Semaphore = LOCKED_BY_CORE_0;
    }else if(jpegBuf1Semaphore == UNLOCKED){
      jpegBuf1Semaphore = LOCKED_BY_CORE_0;
    }
  }
}





// ***** CORE 1, decoding jpeg frames and pushing pixels to screen *****
void setup1(){
  // Initialize TFT
  tft.begin();
  tft.setRotation(1);
  tft.fillScreen(0);
  tft.setAddrWindow(X, Y, WIDTH, HEIGHT);
  tft.pushColor(TFT_BLACK, WIDTH * HEIGHT);
  tft.setSwapBytes(true);
  tft.initDMA();
  tft.startWrite();

  // Initialize JPEGDEC
  jpeg.setPixelType(RGB565_LITTLE_ENDIAN);
  jpeg.setMaxOutputSize(2048);

  // Calculate limits used for cropping corners of output frames (could be done in a nicer way, whatever)
  for(int y=0; y<CORNER_CROP_RADIUS; y++){
    int x=0;
    while(x < WIDTH){
      if(sqrt(pow(x - CORNER_CROP_RADIUS, 2) + pow(y - CORNER_CROP_RADIUS, 2)) <= CORNER_CROP_RADIUS){
        cropRadiusLimits[y] = x;
        break;
      }
      x++;
    }
  }
}


// Update the bytes in the screen buffer when decoding jpeg frame
int draw(JPEGDRAW* block){

  // Check that the block is within bounds of screen, otherwise, don't draw it
  if(block->x < WIDTH && block->y < HEIGHT){
    for (int bx = 0; bx < block->iWidth; bx++){
      for (int by = 0; by < block->iHeight; by++){
        int x = block->x + bx;
        int y = block->y + by;

        // Check that the pixel within the block is within screen bounds and then draw
        if(x < WIDTH && y < HEIGHT){
          int blockPixelIndex = by * block->iWidth + bx;
          int bufferIndex = y * WIDTH + x;
          screenBuffer[bufferIndex] = ((uint16_t*)block->pPixels)[blockPixelIndex];
        }
      }
    }
  }

  return 1;
}


// (used by core 2)
void cropCorners(){
  for(int y=0; y<CORNER_CROP_RADIUS; y++){
    for(int x=0; x<cropRadiusLimits[y]; x++){
      int topLeftBufferIndex = y * WIDTH + x;
      int topRightBufferIndex = y * WIDTH + ((WIDTH-1) - x);

      int bottomLeftBufferIndex = ((HEIGHT-1) - y) * WIDTH + x;
      int bottomRightBufferIndex = ((HEIGHT-1) - y) * WIDTH + ((WIDTH-1) - x);

      screenBuffer[topLeftBufferIndex] = 0;
      screenBuffer[topRightBufferIndex] = 0;
      screenBuffer[bottomLeftBufferIndex] = 0;
      screenBuffer[bottomRightBufferIndex] = 0;
    }
  }
}


void decodeAndUpdateScreen(uint8_t *jpegBuf, uint16_t &jpegBufIndex){
  // Decode
  if (!jpeg.openRAM(jpegBuf, jpegBufIndex-5, draw)){
    cdc.println("Could not open frame from RAM!");
  }
  jpeg.decode(0, 0, 0);

  // Crop
  cropCorners();

  // Display
  tft.dmaWait();
  tft.pushPixelsDMA(screenBuffer, WIDTH * HEIGHT);

  // Reset now that the frame is decoded
  jpegBufIndex = 0;
}


void loop1(){
  // Like core 0, acquire a lock on a jpeg buffer, use it, then set flag to give other core access
  if(jpegBuf0Semaphore == LOCKED_BY_CORE_1){
    decodeAndUpdateScreen(jpegBuf0, jpegBuf0Index);
    jpegBuf0Semaphore = UNLOCKED;
  }else if(jpegBuf1Semaphore == LOCKED_BY_CORE_1){
    decodeAndUpdateScreen(jpegBuf1, jpegBuf1Index);
    jpegBuf1Semaphore = UNLOCKED;
  }else{
    if(jpegBuf0Semaphore == WAITING_FOR_CORE_1){
      jpegBuf0Semaphore = LOCKED_BY_CORE_1;
    }else if(jpegBuf1Semaphore == WAITING_FOR_CORE_1){
      jpegBuf1Semaphore = LOCKED_BY_CORE_1;
    }
  }
}