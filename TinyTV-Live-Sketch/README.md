# TinyCircuits - RP2040 TinyTV Firmware (TinyTV 2 & TinyTV Mini)

Repository containing source code and Arduino libraries for our RP2040 based TinyTVs.

## About 'libs_to_install'
Each library under the 'libs_to_install' directory should be installed in the Arduino libraries folder.

NOTE: The TFT_eSPI library was duplicated for each TV so that the user select headers could be made unique and switched at sketch compile time (easier than the alternative of moving the folders each time). if the TFT_eSPI library ever needs to be **updated**, make sure to modify 'TFT_eSPI.h', 'TFT_eSPI.cpp', 'User_Setup_Select.h', and 'User_Setup.h'.