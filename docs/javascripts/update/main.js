import { Serial } from "../serial.js";
import { TV_TYPES } from "/javascripts/streaming/jpegstreamerCommon.js";
import { BasicPicoboot } from "./basicpicoboot.js";







// Only perform the streaming logic if actually on the streaming page that has all the elements
if(window.location.pathname.indexOf("Update") != -1){
    let show = (element, showChildren=true) => {
        if(typeof(element) == "string") element = document.getElementById(element);

        element.classList.remove("invisible");

        // Don't want to show children, infinite loop otherwise
        if(element.parentElement) show(element.parentElement, false);

        if(showChildren){
            for(let icx=0; icx<element.children.length; icx++){
                show(element.children[icx]);
            }
        }
    }
    
    let hide = (element) => {
        if(typeof(element) == "string") element = document.getElementById(element);

        element.classList.add("invisible");

        for(let icx=0; icx<element.children.length; icx++){
            hide(element.children[icx]);
        }
    }
    
    let disable = (elementID) => {
        document.getElementById(elementID).disabled = true;
    }

    let play = (elementID) => {
        document.getElementById(elementID).currentTime = 0;
        document.getElementById(elementID).play();
    }

    let pause = (elementID) => {
        document.getElementById(elementID).pause();
    }
    
    let setClickCallback = (elementID, callback) => {
        document.getElementById(elementID).onclick = callback;
    }
    
    let setInnerText = (elementID, text) => {
        document.getElementById(elementID).innerText = text;
    }
    
    let hideAll = () => {
        let sectionChildren = document.getElementById("updateSection").children;
    
        // Start at index 1 to skip description header
        for(let icx=1; icx<sectionChildren.length; icx++){
            hide(sectionChildren[icx]);
        }
    }


    // When insertUrlParameter(), removeUrlParameter(), or page back button are pressed, re-render the page
    window.onpopstate = () => {
        refresh();
    }
    
    
    // https://stackoverflow.com/questions/10970078/modifying-a-query-string-without-reloading-the-page
    let insertUrlParameter = (key, value) => {
        if (history.pushState) {
            let searchParams = new URLSearchParams(window.location.search);
            searchParams.set(key, value);
            let newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + searchParams.toString();
            window.history.pushState({path: newurl}, '', newurl);
            refresh();
        }
    }
    
    // Remove the specific key
    let removeUrlParameter = (key) => {
        const url = window.location.href;
        var r = new URL(url);
        r.searchParams.delete(key);
        const newUrl = r.href;
        window.history.pushState({ path: newUrl }, '', newUrl);
        refresh();
    }

    // Get value of specific key
    let getUrlParameter = (key) => {
        let searchParams = new URLSearchParams(window.location.search);
        return searchParams.get(key);
    }


    if(!("serial" in navigator)){
        disable("connectButton");
        show("browserSupportError");
        hide("description");
    }

    let serial = new Serial([{usbVendorId:11914, usbProductId:10}, {usbVendorId:0x03EB, usbProductId: 0x8008}, {usbVendorId:0x03EB, usbProductId: 0x8009}], false);



    async function upload(firmwareName){
        // chrome://device-log/?refresh=1
        const decoder = new TextDecoder();

        let collectedData = "";
        serial.onData = (data) => {
            collectedData += decoder.decode(data);
            console.log(decoder.decode(data));
        }

        let checkCollectedDataFor = async (text) => {
            return new Promise((resolve, reject) => {
                let check = () => {
                    setTimeout(() => {
                        if(collectedData.indexOf(text) == -1){
                            check();
                            console.warn("looking for " + text);
                        }else{
                            collectedData = "";
                            resolve(true);
                        }
                    }, 10);
                }
                check();
            });
        }

        let wait = async (ms) => {
            return new Promise((resolve, reject) => {
                let count = 0;
                let wait1ms = () => {
                    setTimeout(() => {
                        if(count < ms){
                            count++;
                            wait1ms();
                        }else{
                            resolve();
                        }
                    }, 1);
                }
                wait1ms();
            });
        }

        const programFlashStart = 0x2000;
        const uploadPacketSize = 4096;
        const sramBufferAddress = 0x20005000;   // Taken from Arduino IDE output with verbose option enabled
        

        const binData = new Uint8Array(await (await fetch(firmwareName)).arrayBuffer());
        const packetCount = Math.ceil(binData.byteLength/uploadPacketSize);

        serial.onDisconnect = () => {
            removeUrlParameter("screen");
        }
        serial.onConnect = async () => {
            console.warn("...");

            show("progressBar");
            document.getElementById("progressBarBar").style.width = "0%";

            // Erase flash after bootloader
            await serial.write("X" + programFlashStart.toString(16) + "#", true);
            await wait(1);
            await checkCollectedDataFor("X\n\r");

            for(let ipx=0; ipx<packetCount; ipx++){
                let packet = binData.slice((ipx*uploadPacketSize), (ipx*uploadPacketSize)+uploadPacketSize)

                // https://github.com/shumatech/BOSSA/blob/master/src/Samba.cpp#L511
                const cmd0 = "S" + sramBufferAddress.toString(16) + "," + packet.byteLength.toString(16).padStart(4, '0') + "#";
                console.log(cmd0);
                await serial.write(cmd0, true);
                await wait(1);

                // https://github.com/shumatech/BOSSA/blob/master/src/Samba.cpp#L528
                await serial.write(packet, false);
                await wait(1);

                // https://github.com/shumatech/BOSSA/blob/master/src/Samba.cpp#L619
                const cmd1 = "Y" + sramBufferAddress.toString(16) + ",0#";
                console.log(cmd1);
                await serial.write(cmd1, true);
                await wait(1);
                await checkCollectedDataFor("Y\n\r");

                // https://github.com/shumatech/BOSSA/blob/master/src/Samba.cpp#L629
                const cmd2 = "Y" + (programFlashStart + (ipx*uploadPacketSize)).toString(16) + "," + packet.byteLength.toString(16).padStart(4, '0') + "#";
                console.log(cmd2);
                await serial.write(cmd2, true);
                await wait(1);
                await checkCollectedDataFor("Y\n\r");
                await wait(1);

                console.log("");

                document.getElementById("progressBarBar").style.width = ((ipx/packetCount) * 100) + "%";
            }

            // CPU reset https://github.com/shumatech/BOSSA/blob/3532de82efd28fadbabc2b258d84dddf14298107/src/Device.cpp#L652
            await serial.write("WE000ED0C,05FA0004#", true);
        }

        await serial.connect();
    }



    // Makes all elements invisible and then shows element for screen in query string (called by insertUrlParameter)
    let refresh = () => {
        const screen = getUrlParameter("screen");

        // Only hide all elements if in a screen other than main update landing screen
        hideAll();

        if(screen == undefined){
            setClickCallback("connectButton", serial.connect.bind(serial, 1200, 128));

            serial.onConnect = () => {
                serial.onDisconnect = () => {
                    insertUrlParameter("screen", "diy_update");
                }
                serial.disconnect();
            }

            setInnerText("description", "Update software on TinyTV 2, Mini, or DIY Kit.\nConnect TV to put into update mode.");
            setInnerText("connectButton", "Connect TV");
            show("description");
            show("connectButton");

            // If serial connected, disconnect it on this page
            if(serial.connected){
                serial.disconnect();
            }
        }else if(screen == "diy_update"){
            setInnerText("description", "Ready to update\nChoose the TV again to update");
            setInnerText("connectButton", "Connect To Update");
            show("description");
            show("connectButton");

            setClickCallback("connectButton", () => {
                upload("/firmware/d-0.bin");
            });
        }
    }

    // Call this in case link with query string is visited
    refresh();
}