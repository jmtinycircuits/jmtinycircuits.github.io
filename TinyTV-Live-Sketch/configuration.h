// Change PLATFORM depending on what you're compiling for
#define TINYTV_2_PLATFORM 0
#define TINYTV_MINI_PLATFORM 1
#define PLATFORM TINYTV_2_PLATFORM


// Screen and drawing area parameters
#if PLATFORM==1
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