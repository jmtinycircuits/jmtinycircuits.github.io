const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});

let value = params.tvtype;

if(value == "diy"){
    document.getElementById("stream").parentElement.removeChild(document.getElementById("stream"));
}