#ifndef JPEG_STREAMER_H
#define JPEG_STREAMER_H

#include <JPEGDEC.h>
#include <Adafruit_TinyUSB.h>


// When 'core0FillBuffers' and 'core1Decode' are called on separate cores,
// incoming serial data gets stored in buffers and then decoded. Decoded
// buffers are written to a screen buffer in 'core1Decode' which can
// immediately be pushed to the screen.
class JPEGStreamer{
  public:
    JPEGStreamer(JPEGDEC *_jpeg, Adafruit_USBD_CDC *_cdc,       // Store references to often reused external objects
                uint8_t *_jpegBuffer0, uint8_t *_jpegBuffer1);

    void core0FillBuffers();                                    // Alternate between filling buffers
    void core1Decode(uint16_t &screenBuffer);                   // Decode data stored in either buffer then write to screen buffer
  
    // Enum values used for locking access between core 
    // for jpeg buffers 'jpegBuffer0' and 'jpegBuffer1'
    enum JPEG_BUFFER_SEMAPHORE {
        UNLOCKED,
        LOCKED_BY_CORE_0,
        LOCKED_BY_CORE_1,
        WAITING_FOR_CORE_1
    };


  private:
    // Fill either 'jpegBuffer0' or 'jpegBuffer1' 
    // using the corresponding index and return
    // true when full.
    bool fillJpegBufferFromCDC(uint8_t *jpegBuf, uint16_t &jpegBufIndex);    // (used by 'core 0')

    // Callback needed by JPEGDec library for correctly
    // placing decoded pixels into screen buffer
    int drawCallback(JPEGDRAW* block);                      // (used by 'core 1')

    // Open the passed jpeg buffer and decode into
    // 'screenBuffer' passed through 'core1Decode(...)'
    void decode(uint8_t *jpegBuf, uint16_t &jpegBufIndex);  // (used by 'core 1')

    // Flags to control access to JPEG 
    // buffers during filling and decoding
    enum JPEG_BUFFER_SEMAPHORE jpegBuf0Semaphore = JPEG_BUFFER_SEMAPHORE::UNLOCKED; // (read and written to by 'core 0' and 'core 1')
    enum JPEG_BUFFER_SEMAPHORE jpegBuf1Semaphore = JPEG_BUFFER_SEMAPHORE::UNLOCKED; // (read and written to by 'core 0' and 'core 1')

    // External reference to JPEG 
    // decoding library for turning
    // JPEG data into pixels for screen
    JPEGDEC *jpeg;                          // (used by 'core 1')

    // External reference to CDC Serial library
    // for taking incoming data and storing in
    // jpeg buffers, as well as any error
    // printing
    Adafruit_USBD_CDC *cdc;                 // (used by 'core 0')

    // References to external buffers 
    // repurposed for storing incoming 
    // serial JPEG data
    uint8_t *jpegBuffer0;                   // (read and written to by 'core 0' and 'core 1')
    uint8_t *jpegBuffer1;                   // (read and written to by 'core 0' and 'core 1')

    // Indices used for filling 
    // 'jpegBuffer0' and 'jpegBuffer1'
    uint16_t jpegBuffer0Index = 0;          // (read and written to by 'core 0' and 'core 1')
    uint16_t jpegBuffer1Index = 0;          // (read and written to by 'core 0' and 'core 1')

    // Used for storing incoming data
    // for checking for commands 
    // (e.g. 'TYPE') or deliminator
    // (e.g. 'FRAME')
    uint8_t commandBuffer[5];               // (read and written to by 'core 0')

    // The incoming frame size as
    // received after deliminator
    uint16_t incomingFrameSize = 0;         // (read and written to by 'core 0')

    // Flag set true when 'FRAME' found
    // in incoming serial and it's time
    // to fill buffers. False means to
    // look for commands or deliminator
    bool frameDeliminatorAcquired = false;  // (read and written to by 'core 0')
};

#endif