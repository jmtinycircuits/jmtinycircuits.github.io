#ifndef SCREEN_H
#define SCREEN_H

#include "configuration.h"
#include "pico/stdlib.h"


class Screen{
  public:
    Screen(){}

    void init(uint32_t MHz0, uint32_t MHz1);

    // Update the screen under either of the two frequencies passed in the constructor.
    // Returns false if the current frequency is not one of the constructor values
    bool update(uint16_t *screenBuffer, uint16_t size);

  private:
    // The passed frequencies from the constructor converted to hertz
    uint32_t Hz0 = 0;
    uint32_t Hz1 = 0;

    TFT_eSPI tft0;
    TFT_eSPI tft1;
};

#endif