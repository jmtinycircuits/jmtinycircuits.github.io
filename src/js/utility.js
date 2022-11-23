// Wrapper around showing and hiding elements
async function showOrHideElement(elementID, show=true){
    return new Promise((resolve, reject) => {
        let element = document.getElementById(elementID);
    
        if(show){   // Show
            element.classList.remove("invisible", "absolute", "opacity-0");
            element.classList.add("opacity-100");
            resolve();
        }else{      // Hide
            element.classList.remove("opacity-100");
            element.classList.add("invisible", "opacity-0");

            // After standard animation duration used across this page, take out of dom positioning
            setTimeout(() => {
                element.classList.add("absolute");
                resolve();
            }, 300);
        }
    });
}


// Show pop-up saying a TV was detected
async function showAlertPopup(elementID, alertText){
    return new Promise((resolve, reject) => {
        let element = document.getElementById(elementID);
    
        // Show
        document.getElementById(elementID + "Text").innerText = alertText;  // Should have a child with parent name + "Text"
        element.classList.remove("invisible", "opacity-0");
        element.classList.add("opacity-100");

        // Hide after a while
        setTimeout(() => {
            element.classList.remove("opacity-100");
            element.classList.add("invisible", "opacity-0");

            // After standard animation duration used across this page, take out of dom positioning
            setTimeout(() => {
                resolve();
            }, 300);
        }, 2250);
    });
}

export { showOrHideElement, showAlertPopup };