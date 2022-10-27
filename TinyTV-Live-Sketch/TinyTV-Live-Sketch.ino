// COMPILE NOTE: change platform in configuration.h to switch between TinyTV 2 and Mini
// Make sure to set 'CFG_TUD_CDC' to 2 in C:\Users\TinyCircuits\AppData\Local\Arduino15\packages\rp2040\hardware\rp2040\2.6.0\libraries\Adafruit_TinyUSB_Arduino\src\arduino\ports\rp2040\tusb_config_rp2040.h

#include <JPEGDEC.h>
#include <Adafruit_TinyUSB.h>
#include "pico/stdlib.h"

#include "screenEffects.h"
#include "JPEGStreamer.h"
#include "configuration.h"
#include "screen.h"


Adafruit_USBD_CDC cdc;
JPEGDEC jpeg;


ScreenEffects effects(PLATFORM);
JPEGStreamer streamer(&jpeg, &cdc, PLATFORM);
Screen screen;


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
  Serial.end();
  cdc.begin(0);

  screen.init(250, 48);

  // Initialize JPEGDEC
  jpeg.setPixelType(RGB565_LITTLE_ENDIAN);
  jpeg.setMaxOutputSize(2048);

  pinMode(9, OUTPUT);
  #if PLATFORM==1
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
    set_sys_clock_khz(250000, false);
    streamer.decode(videoBuffer0, videoBuffer1, screenBuffer, draw);
    effects.cropCorners(screenBuffer, VIDEO_W, VIDEO_H);
  }else{
    set_sys_clock_khz(48000, false);

    // Not live, do normal video playing stuff
    for(int i=0; i<VIDEO_W*VIDEO_H; i++){
      screenBuffer[i] = TFT_BLUE;
    }
  }

  // Display
  screen.update(screenBuffer, SCREEN_BUFFER_SIZE);
}