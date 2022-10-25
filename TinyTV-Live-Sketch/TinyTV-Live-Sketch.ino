#include <TFT_eSPI.h>
#include <JPEGDEC.h>
#include <Adafruit_TinyUSB.h>
#include "pico/stdlib.h"

#include "screenEffects.h"
#include "JPEGStreamer.h"


// Screen and drawing area parameters
#define X 24
#define Y 0
#define WIDTH 216
#define HEIGHT 135

Adafruit_USBD_CDC cdc;
TFT_eSPI tft;
JPEGDEC jpeg;

ScreenEffects effects(ScreenEffects::TINYTV_TYPE::TINYTV_2);
JPEGStreamer streamer(&jpeg, &cdc, JPEGStreamer::TINYTV_TYPE::TINYTV_2);

uint16_t screenBuffer[WIDTH * HEIGHT];

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

  // while(set_sys_clock_khz(250000, false) == false){};
}

void setup1(){}


void loop(){
  streamer.fillBuffers(videoBuffer0, videoBuffer1, sizeof(videoBuffer0)/sizeof(videoBuffer0[0]));
}


void loop1(){
  if(streamer.live){
    streamer.decode(videoBuffer0, videoBuffer1, screenBuffer, draw);
  }else{
    // Not live, do normal video playing stuff
    for(int i=0; i<WIDTH*HEIGHT; i++){
      screenBuffer[i] = TFT_CYAN;
    }
  }

  effects.cropCorners(screenBuffer, WIDTH, HEIGHT);

  // Display
  tft.dmaWait();
  tft.pushPixelsDMA(screenBuffer, WIDTH * HEIGHT);
}