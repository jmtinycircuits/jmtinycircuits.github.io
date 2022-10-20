#include "JPEGStreamer.h"

JPEGStreamer::JPEGStreamer(JPEGDEC *_jpeg, Adafruit_USBD_CDC *_cdc, uint8_t *_jpegBuffer0, uint8_t *_jpegBuffer1){
    jpeg = _jpeg;
    cdc = _cdc;

    jpegBuffer0 = _jpegBuffer0;
    jpegBuffer1 = _jpegBuffer1;
}