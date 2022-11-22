#include <SPI.h>
#include <SdFat.h>
#include "Adafruit_TinyUSB.h"
#include <stdint.h>

#define SD_CS 17
#define SD_MISO 16
#define SD_MOSI 19
#define SD_SCK 18
const SdSpiConfig SD_CONFIG(SD_CS, DEDICATED_SPI, min(F_CPU / 2, 50000000), &SPI);

SdFat32 sd;

Adafruit_USBD_MSC usb_msc;
Adafruit_USBD_CDC cdc;


bool initializeSDcard(){
  SPI.setTX(SD_MOSI);
  SPI.setRX(SD_MISO);
  SPI.setSCK(SD_SCK);
  SPI.setCS(SD_CS);
  SPI.begin(true);
  return sd.begin(SD_CONFIG);
}


void setup(){
  usb_msc.setID("TinyCircuits", "RP2040TV", "1.0");
  usb_msc.setReadWriteCallback(msc_read_cb, msc_write_cb, msc_flush_cb);
  usb_msc.setUnitReady(false);
  usb_msc.begin();

  delay(300);

  Serial.end();
  cdc.begin(0);

  delay(5000);

  while(!initializeSDcard()){
    cdc.println("Waiting for SD card!");
  }

  usb_msc.setCapacity(sd.card()->sectorCount(), 512);
  usb_msc.setUnitReady(true);

  cdc.println("Ready!");
}


void loop(){
  // cdc.print(done);
}

// Callback invoked when received READ10 command.
// Copy disk's data to buffer (up to bufsize) and
// return number of copied bytes (must be multiple of block size)
int32_t msc_read_cb (uint32_t lba, void* buffer, uint32_t bufsize){
  cdc.println("Being read from!");
  return sd.card()->readSectors(lba, (uint8_t*) buffer, (bufsize >> 9)) ? bufsize : -1;
}

uint32_t t0 = 0;

// Callback invoked when received WRITE10 command.
// Process data in buffer to disk's storage and 
// return number of written bytes (must be multiple of block size)
int32_t msc_write_cb (uint32_t lba, uint8_t* buffer, uint32_t bufsize){
  cdc.println("Being written to!");
  cdc.println(millis() - t0);
  t0 = millis();
  // cdc.println(bufsize);
  // return bufsize;
  return (sd.card()->writeSectors(lba, buffer, (bufsize >> 9)) == true) ? bufsize : -1;
}

// Callback invoked when WRITE10 command is completed (status received and accepted by host).
// used to flush any pending cache.
void msc_flush_cb (void){
  // sd.card()->syncBlocks();
  sd.card()->syncDevice();
  sd.cacheClear();

  cdc.println("Flushed!");
}