// Change PLATFORM depending on what you're compiling for
#define TINYTV_2_PLATFORM 0
#define TINYTV_MINI_PLATFORM 1
#define TINYTV_ROUND_PLATFORM 2
#define PLATFORM TINYTV_ROUND_PLATFORM

// Screen and drawing area parameters
#if PLATFORM==TINYTV_MINI_PLATFORM
  #include <TFT_eSPI_tinytvmini.h>
  #define VIDEO_X 0
  #define VIDEO_Y 0
  #define VIDEO_W 64
  #define VIDEO_H 64
#elif PLATFORM==TINYTV_2_PLATFORM
  #include <TFT_eSPI_tinytv2.h>
  #define VIDEO_X 24
  #define VIDEO_Y 0
  #define VIDEO_W 216
  #define VIDEO_H 135
#else
  #include <TFT_eSPI_tinytvround.h>
  #define VIDEO_X 0
  #define VIDEO_Y 0
  #define VIDEO_W 240
  #define VIDEO_H 240
#endif

#define SCREEN_BUFFER_SIZE VIDEO_W*VIDEO_H