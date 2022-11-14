#include <Adafruit_TinyUSB.h>
#include <stdint.h>

Adafruit_USBD_CDC cdc;



void setup(){
  Serial.end();
  cdc.begin(0);
}


uint8_t buffer[20000];


void loop(){
  if(cdc.available()){
    cdc.read(buffer, cdc.available());
  }
}