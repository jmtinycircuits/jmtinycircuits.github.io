#include "screen.h"


void Screen::init(uint32_t MHz0, uint32_t MHz1){
  Hz0 = MHz0 * 1000000;
  Hz1 = MHz1 * 1000000;

  set_sys_clock_khz(Hz0/1000, false);
  delay(100);
  tft0.begin();
  tft0.setRotation(1);
  tft0.fillScreen(0);
  tft0.setAddrWindow(VIDEO_X, VIDEO_Y, VIDEO_W, VIDEO_H);
  tft0.pushColor(TFT_BLACK, VIDEO_W * VIDEO_H);
  tft0.setSwapBytes(true);
  tft0.initDMA();
  tft0.startWrite();
  delay(100);

  set_sys_clock_khz(Hz1/1000, false);
  delay(100);
  tft0.deInitDMA();
  tft1.begin();
  tft1.setRotation(1);
  tft1.fillScreen(0);
  tft1.setAddrWindow(VIDEO_X, VIDEO_Y, VIDEO_W, VIDEO_H);
  tft1.pushColor(TFT_BLACK, VIDEO_W * VIDEO_H);
  tft1.setSwapBytes(true);
  tft1.initDMA();
  tft1.startWrite();
  delay(100);
}


bool Screen::update(uint16_t *screenBuffer, uint16_t size){
  uint32_t clkHz = clock_get_hz(clk_sys);

  // Do not need to call dmaWait(), already done by push pixels function
  if(clkHz == Hz0){
    tft1.deInitDMA();
    tft0.initDMA();
    tft0.pushPixelsDMA(screenBuffer, size);
    return true;
  }else if(clkHz == Hz1){
    tft0.deInitDMA();
    tft1.initDMA();
    tft1.pushPixelsDMA(screenBuffer, size);
    return true;
  }

  return false;
}