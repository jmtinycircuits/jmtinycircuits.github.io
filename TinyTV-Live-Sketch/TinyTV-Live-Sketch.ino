#include <JPEGDEC.h>
#include <Adafruit_TinyUSB.h>
#include "pico/stdlib.h"

#include "screenEffects.h"
#include "JPEGStreamer.h"

// Set to 0 for TinyTV 2 and 1 for TinyTV Mini
#define TINYTV_MINI_PLATFORM 1


// Screen and drawing area parameters
#if TINYTV_MINI_PLATFORM==1
  #include <TFT_eSPI_tinytvmini.h>
  #define VIDEO_X 0
  #define VIDEO_Y 0
  #define VIDEO_W 64
  #define VIDEO_H 64
#else
  #include <TFT_eSPI_tinytv2.h>
  #define VIDEO_X 24
  #define VIDEO_Y 0
  #define VIDEO_W 216
  #define VIDEO_H 135
#endif


Adafruit_USBD_CDC cdc;
TFT_eSPI tft;
JPEGDEC jpeg;


ScreenEffects effects(TINYTV_MINI_PLATFORM);
JPEGStreamer streamer(&jpeg, &cdc, TINYTV_MINI_PLATFORM);


uint16_t screenBuffer[VIDEO_W * VIDEO_H];
uint8_t videoBuffer0[20000];
uint8_t videoBuffer1[20000];


// Update the bytes in the screen buffer when decoding jpeg frame
int draw(JPEGDRAW* block){
  // Check that the block is within bounds of screen, otherwise, don't draw it
  if(block->x < VIDEO_W && block->y < VIDEO_H){
    for (int bx = 0; bx < block->iWidth; bx++){
      for (int by = 0; by < block->iHeight; by++){
        int x = block->x + bx;
        int y = block->y + by;

        // Check that the pixel within the block is within screen bounds and then draw
        if(x < VIDEO_W && y < VIDEO_H){
          int blockPixelIndex = by * block->iWidth + bx;
          int bufferIndex = y * VIDEO_W + x;
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

  // Initialize TFT at max frequency
  // while(set_sys_clock_khz(250000, false) == false){};
  tft.begin();
  tft.setRotation(1);
  tft.fillScreen(0);
  tft.setAddrWindow(VIDEO_X, VIDEO_Y, VIDEO_W, VIDEO_H);
  tft.pushColor(TFT_BLACK, VIDEO_W * VIDEO_H);
  tft.setSwapBytes(true);
  tft.initDMA();
  tft.startWrite();
  // while(set_sys_clock_khz(48000, false) == false){};

  // Initialize JPEGDEC
  jpeg.setPixelType(RGB565_LITTLE_ENDIAN);
  jpeg.setMaxOutputSize(2048);

  pinMode(9, OUTPUT);

  #if TINYTV_MINI_PLATFORM==1
    digitalWrite(9, HIGH);
  #else
    digitalWrite(9, LOW);
  #endif
}

void setup1(){}


void loop(){
  streamer.fillBuffers(videoBuffer0, videoBuffer1, sizeof(videoBuffer0)/sizeof(videoBuffer0[0]));
}


void loop1(){
  if(streamer.live){
    // while(set_sys_clock_khz(250000, false) == false){};
    streamer.decode(videoBuffer0, videoBuffer1, screenBuffer, draw);
    effects.cropCorners(screenBuffer, VIDEO_W, VIDEO_H);
  }else{
    // while(set_sys_clock_khz(48000, false) == false){};

    // Not live, do normal video playing stuff
    for(int i=0; i<VIDEO_W*VIDEO_H; i++){
      screenBuffer[i] = TFT_BLUE;
    }
  }

  // Display
  tft.dmaWait();
  tft.pushPixelsDMA(screenBuffer, VIDEO_W * VIDEO_H);
}