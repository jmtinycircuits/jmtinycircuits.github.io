# TinyCircuits - RP2040 TinyTV Firmware (TinyTV 2 & TinyTV Mini)

Repository containing source code and Arduino libraries for our RP2040 based TinyTVs.

## Arduino IDE Upload parameters
* Board: "Raspberry Pi Pico"
* Flash Size: "2MB (no FS)"
* CPU Speed: "50MHz" (TinyTV Mini) or "200MHz" (TinyTV 2), NOTE: this is overridden in setup
* Optimize: "Optimize Even More (-O3)"
* RTTI: "Disabled"
* Stack protector: "Disabled"
* C++ Exceptions: "Disabled"
* Debug Port: "Disabled"
* Debug Level: "None"
* USB Stack: "Adafruit TinyUSB"
* IP Stack: "IPv4 Only"
* Port: blank on first upload or "COMXXX (Raspberry Pi Pico)" on subsequent uploads

## About 'libs_to_install'
Each library under the 'libs_to_install' directory should be installed in the Arduino libraries folder.

NOTE: The TFT_eSPI library was duplicated for each TV so that the user select headers could be made unique and switched at sketch compile time (easier than the alternative of moving the folders each time). if the TFT_eSPI library ever needs to be **updated**, make sure to modify 'TFT_eSPI.h', 'TFT_eSPI.cpp', 'User_Setup_Select.h', and 'User_Setup.h'.