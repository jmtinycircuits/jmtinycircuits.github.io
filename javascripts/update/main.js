import { Serial } from "../serial.js";
import { TV_TYPES } from "/javascripts/streaming/jpegstreamerCommon.js";


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


    // When insertUrlParam(), removeUrlParameter(), or page back button are pressed, re-render the page
    window.onpopstate = () => {
        refresh();
    }
    
    
    // https://stackoverflow.com/questions/10970078/modifying-a-query-string-without-reloading-the-page
    let insertUrlParam = (key, value) => {
        if (history.pushState) {
            let searchParams = new URLSearchParams(window.location.search);
            searchParams.set(key, value);
            let newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + searchParams.toString();
            window.history.pushState({path: newurl}, '', newurl);
            refresh();
        }
    }
    
    // to remove the specific key
    let removeUrlParameter = (paramKey) => {
        const url = window.location.href;
        console.log("url", url);
        var r = new URL(url);
        r.searchParams.delete(paramKey);
        const newUrl = r.href;
        console.log("r.href", newUrl);
        window.history.pushState({ path: newUrl }, '', newUrl);
        refresh();
    }



    // Makes all elements invisible and then shows element for screen in query string (called by insertUrlParam)
    let refresh = () => {
        const screen = window.location.search.substring(window.location.search.indexOf("=")+1);

        // Only hide all elements if in a screen other than main update landing screen
        hideAll();

        if(screen == ""){
            setInnerText("description", "Update software on TinyTV 2, Mini, or DIY Kit");
            setInnerText("connectButton", "Connect TV");
            show("description");
            show("connectButton");
        }else if(screen == "manual_update"){
            setInnerText("infoOutput", "Manually choose your TV");
            show("manualChoice");
            show("infoOutput");
            show("cancelManualUpdate");

            setClickCallback("choseMini", () => {
                insertUrlParam("screen", "tvmini_step_1");
            });
            setClickCallback("chose2", () => {
                insertUrlParam("screen", "tv2_step_1");
            });
            setClickCallback("choseDIY", () => {
                insertUrlParam("screen", "tvdiy_step_1");
            });
            setClickCallback("cancelManualUpdate", () => {
                removeUrlParameter("screen");
            });
        }else if(screen == "tvmini_step_1"){

        }else if(screen == "tv2_step_1"){
            setInnerText("description", "Step 1: Turn the TV off by holding the power button for 5 seconds. The screen will remain off\n(it does not matter if the TV is already on or off)");
            show("description");
            show("backButton");
            show("nextButton");
            show("tv2Step1VideoContainer");
            play("tv2Step1Video");
            show("cancelManualUpdate");

            setClickCallback("nextButton", () => {
                insertUrlParam("screen", "tv2_step_2");
            });
            setClickCallback("backButton", () => {
                insertUrlParam("screen", "manual_update");
            });
            setClickCallback("cancelManualUpdate", () => {
                removeUrlParameter("screen");
            });
        }else if(screen == "tv2_step_2"){
            setInnerText("description", "Step 2: Plug the TV into a computer using a USB-C cord");
            show("description");
            show("backButton");
            show("nextButton");
            show("tv2Step2VideoContainer");
            play("tv2Step2Video");
            show("cancelManualUpdate");

            setClickCallback("nextButton", () => {
                insertUrlParam("screen", "tv2_step_3");
            });
            setClickCallback("backButton", () => {
                insertUrlParam("screen", "tv2_step_1");
            });
            setClickCallback("cancelManualUpdate", () => {
                removeUrlParameter("screen");
            });
        }else if(screen == "tv2_step_3"){
            setInnerText("description", "Step 3: Turn the TV on in update mode by pressing and holding\nthe reset button with a pen and clicking the power button once");
            show("description");
            show("backButton");
            show("nextButton");
            show("tv2Step3VideoContainer");
            play("tv2Step3Video");
            show("cancelManualUpdate");

            setClickCallback("nextButton", () => {
                insertUrlParam("screen", "update");
            });
            setClickCallback("backButton", () => {
                insertUrlParam("screen", "tv2_step_2");
            });
            setClickCallback("cancelManualUpdate", () => {
                removeUrlParameter("screen");
            });
        }else if(screen == "tvdiy_step_1"){
            
        }else if(screen == "update"){
            show("cancelManualUpdate");
            setClickCallback("cancelManualUpdate", () => {
                removeUrlParameter("screen");
            });
        }
    }

    // Call this in case link with query string is visited
    refresh();


    // If user picks manual update, change query string and render that page
    setClickCallback("manualUpdateButton", () => {
        insertUrlParam("screen", "manual_update");
    })


    if (!("serial" in navigator)){
        disable("connectButton");
        show("browserSupportError");
        hide("description");
    }

    let serial = new Serial([{usbVendorId:11914, usbProductId:10}]);
    let detectedTVType = TV_TYPES.NONE;


    let onTVTypeDetected = () => {
        show("infoOutput");
        if(detectedTVType == TV_TYPES.TINYTV_2){
            console.error("TINY TV 2");
        }else if(detectedTVType == TV_TYPES.TINYTV_MINI){
            console.error("TINY TV MINI");
        }else if(detectedTVType == TV_TYPES.TINYTV_DIY){
            console.error("TINY TV DIY");
        }
    }

    let failedToConnectOrDetect = (str) => {
        detectedTVType = TV_TYPES.NONE
        serial.disconnect(false);

        setClickCallback("connectButton", serial.connect.bind(serial));
        setInnerText("description", str);
        setInnerText("connectButton", "Try Again");

        hide("infoOutput");
        show("description");
        show("manualUpdateButton");
    }


    serial.onConnect = () => {
        setClickCallback("connectButton", serial.disconnect.bind(serial));
        setInnerText("connectButton", "Disconnect");

        show("infoOutput");
        hide("description");
        hide("manualUpdateButton");

        const decoder = new TextDecoder();
        let received = "";

        serial.onData = (data) => {
            if(detectedTVType == TV_TYPES.NONE){
                received += decoder.decode(data);

                // See if it is any of the TVs, pass a human readable string to the on detect function since it will be displayed
                if(received.indexOf(TV_TYPES.TINYTV_2) != -1){
                    detectedTVType = TV_TYPES.TINYTV_2;
                    onTVTypeDetected();
                }else if(received.indexOf(TV_TYPES.TINYTV_MINI) != -1){
                    detectedTVType = TV_TYPES.TINYTV_MINI;
                    onTVTypeDetected();
                }
            }
        }

        let attempts = 0; 
        let requestTVType = () => {
            if(detectedTVType == TV_TYPES.NONE && serial.connected){
                setTimeout(() => {
                    serial.write("TYPE", true);

                    attempts++;

                    // 5 seconds
                    if(attempts >= 20){
                        failedToConnectOrDetect("Detection failed. Would you like to try again or try manually updating?");
                    }else{
                        requestTVType();
                    }
                }, 250);
            }
        }
        requestTVType();
    }
    serial.onConnectionCanceled = () => {
        failedToConnectOrDetect("Connection canceled. Would you like to try again or try manually updating?");
    }
    serial.onDisconnect = () => {
        setClickCallback("connectButton", serial.connect.bind(serial));
        setInnerText("description", "Update software on TinyTV 2, Mini, or DIY Kit");
        setInnerText("connectButton", "Connect TV");

        hide("infoOutput")
        show("description");

        detectedTVType = TV_TYPES.NONE;
    }

    setClickCallback("connectButton", serial.connect.bind(serial));
}