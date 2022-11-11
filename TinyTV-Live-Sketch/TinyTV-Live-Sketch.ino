// COMPILE NOTE: change platform in configuration.h to switch between TinyTV 2 and Mini
// Make sure to set 'CFG_TUD_CDC' to 2 in C:\Users\TinyCircuits\AppData\Local\Arduino15\packages\rp2040\hardware\rp2040\2.6.0\libraries\Adafruit_TinyUSB_Arduino\src\arduino\ports\rp2040\tusb_config_rp2040.h

#include <JPEGDEC.h>
#include <Adafruit_TinyUSB.h>
#include "pico/stdlib.h"

#include "screenEffects.h"
#include "JPEGStreamer.h"
#include "configuration.h"


Adafruit_USBD_CDC cdc;
TFT_eSPI tft;
JPEGDEC jpeg;


ScreenEffects effects(PLATFORM);
JPEGStreamer streamer(&jpeg, &cdc, PLATFORM);


uint16_t screenBuffer[SCREEN_BUFFER_SIZE];
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
  // Set system core frequency depending on platform
  #if PLATFORM==TINYTV_MINI_PLATFORM
    #pragma message ( "Arduino frequency overridden, set to 50MHz for TinyTV Mini" )
    set_sys_clock_khz(50000, false);
  #else
    #pragma message ( "Arduino frequency overridden, set to 200MHz for TinyTV 2" )
    set_sys_clock_khz(200000, false);
  #endif

  Serial.end();
  cdc.begin(0);

  tft.begin();
  tft.setRotation(1);
  tft.fillScreen(0);  // Fill entire screen to black to overwrite all potentially unmodified pixels
  tft.setAddrWindow(VIDEO_X, VIDEO_Y, VIDEO_W, VIDEO_H);
  tft.setSwapBytes(true);
  tft.initDMA();
  tft.startWrite();

  jpeg.setPixelType(RGB565_LITTLE_ENDIAN);
  jpeg.setMaxOutputSize(2048);

  pinMode(9, OUTPUT);
  #if PLATFORM==TINYTV_MINI_PLATFORM
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
    streamer.decode(videoBuffer0, videoBuffer1, screenBuffer, draw);
    effects.cropCorners(screenBuffer, VIDEO_W, VIDEO_H);
  }else{
    // Not live, do normal video playing stuff
    for(int i=0; i<SCREEN_BUFFER_SIZE; i++){
      screenBuffer[i] = TFT_BLUE;
    }
  }

  // Display
  tft.pushPixelsDMA(screenBuffer, VIDEO_W * VIDEO_H);
}