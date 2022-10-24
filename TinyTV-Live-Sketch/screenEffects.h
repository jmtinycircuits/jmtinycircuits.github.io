#ifndef SCREEN_EFFECTS_H
#define SCREEN_EFFECTS_H

#include <stdint.h>
#include <stdlib.h>
#include <cmath>


class RoundCornerEffect{
  public:
    RoundCornerEffect(uint8_t tinyTVType);
    void cropCorners(uint16_t *screenBuffer, uint8_t width, uint8_t height);

  private:
    void calculateLimits();

    // Array of x radius limits allocated and calculated on class initialization
    uint8_t *cropRadiusLimits;

    // Radius in pixels
    const uint8_t tinyTV2CropRadius = 25;
    const uint8_t tinyTVMiniCropRadius = 8;
    uint8_t cropRadius = 0;
};


// Apply various screen effects to screen buffer like static or round corner cropping
class ScreenEffects : public RoundCornerEffect{
  public:
    ScreenEffects(uint8_t tinyTVType);

    enum TINYTV_TYPE{
      TINYTV_2,
      TINYTV_MINI
    };

  private:
};


#endif