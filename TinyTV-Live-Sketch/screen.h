#ifndef SCREEN_H
#define SCREEN_H

#include <TFT_eSPI.h>
#include <stdint.h>
#include "pico/stdlib.h"


class Screen{
    public:
        Screen();

        // Pass two frequencies the screen will be updated under (e.g. 48 or 250)
        void init(uint8_t x, uint8_t y, uint8_t width, uint8_t height, uint8_t mode0MHz, uint8_t mode1MHz);

        // Try to update screen using a mode frequency from init(...). Returns true if found an object for current core frequency, false otherwise
        bool update(uint16_t *screenBuffer, uint16_t size);
    private:
        void initScreen(uint8_t x, uint8_t y, uint8_t width, uint8_t height, TFT_eSPI *tft);

        // Two objects initialzed at different frequencies
        TFT_eSPI tft0;
        TFT_eSPI tft1;

        uint32_t mode0Hz;
        uint32_t mode1Hz;
};


#endif