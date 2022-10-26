#include "screen.h"


Screen::Screen(){

}


void Screen::init(uint8_t x, uint8_t y, uint8_t width, uint8_t height, uint8_t mode0MHz, uint8_t mode1MHz){
    mode0Hz = mode0MHz * 1e+6;
    mode1Hz = mode1MHz * 1e+6;

    while(set_sys_clock_khz(mode0Hz / 1000, false) == false){};
    initScreen(x, y, width, height, &tft0);

    while(set_sys_clock_khz(mode1Hz / 1000, false) == false){};
    initScreen(x, y, width, height, &tft1);
}


bool Screen::update(uint16_t *screenBuffer, uint16_t size){
    // Use rp2040 sdk function to find current core frequency
    // https://raspberrypi.github.io/pico-sdk-doxygen/group__hardware__clocks.html#gae78816cc6112538a12adcc604be4b344
    uint32_t clkFreq = clock_get_hz(clk_sys);

    if(clkFreq == mode0Hz){

    }else if(clkFreq == mode1Hz){

    }

    return false;
}


void Screen::initScreen(uint8_t x, uint8_t y, uint8_t width, uint8_t height, TFT_eSPI *tft){
  tft->begin();
  tft->setRotation(1);
  tft->setAddrWindow(x, y, width, height);
  tft->setSwapBytes(true);
  delay(100);
}