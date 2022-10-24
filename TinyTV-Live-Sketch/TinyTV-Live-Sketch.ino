#include <TFT_eSPI.h>
#include <JPEGDEC.h>
#include <Adafruit_TinyUSB.h>
#include "JPEGStreamer.h"


// Screen and drawing area parameters
#define X 24
#define Y 0
#define WIDTH 216
#define HEIGHT 135

// Crop parameter
#define CORNER_CROP_RADIUS 25


Adafruit_USBD_CDC cdc;
TFT_eSPI tft = TFT_eSPI();
JPEGDEC jpeg;
JPEGStreamer streamer(&jpeg, &cdc);

uint16_t screenBuffer[WIDTH * HEIGHT];
uint8_t cropRadiusLimits[CORNER_CROP_RADIUS*2];

uint8_t videoBuffer0[15000];
uint8_t videoBuffer1[15000];


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




void setup(){
  Serial.end();
  cdc.begin(0);

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

void setup1(){}


void loop(){
  streamer.fillBuffers(videoBuffer0, videoBuffer1, sizeof(videoBuffer0)/sizeof(videoBuffer0[0]));
}


void loop1(){
  streamer.decode(videoBuffer0, videoBuffer1, screenBuffer, draw);

  // Crop
  cropCorners();

  // Display
  tft.dmaWait();
  tft.pushPixelsDMA(screenBuffer, WIDTH * HEIGHT);
}