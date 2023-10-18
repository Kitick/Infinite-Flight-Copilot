function cyclical(value, range = 360){
    value = ((value % range) + range) % range;
    return value;
}

function dms(deg, min = 0, sec = 0){
    return Math.sign(deg) * (Math.abs(deg) + (min / 60) + (sec / 3600));
}

function calcLLfromHD(lat, long, hdg, dist, magvar = 0){
    dist /= 60;

    hdg = -hdg + 90 - magvar;
    hdg *= toRad;

    const lat2 = dist * Math.sin(hdg) + lat;
    const long2 = (dist * Math.cos(hdg)) / Math.cos(toRad * (lat + lat2) * 0.5) + long;

    return [lat2, long2];
}

function calcLLdistance(lat1, long1, lat2, long2){
    const deltaY = 60 * (lat2 - lat1);
    const deltaX = 60 * (long2 - long1) * Math.cos((lat1 + lat2) * 0.5 * toRad);
    const distance = (deltaX ** 2 + deltaY ** 2) ** 0.5;

    return distance;
}

function controlThrottle(throttle, spd, spdDifference){
    write("spdon", false);
    if(throttle > 0){
        write("throttle", -80);
    } else{
        write("throttle", -100);
    }
    write("spd", spd);
    write("spoilers", 1)
    if(spdDifference){
        write("spdon", true);
        write("spoilers", 2);
    }
}

function showfpl(id, waypoint, div){
    const input = document.createElement("input");
    const br = document.createElement("br");
    input.type = "number";
    input.id = id;
    div.innerHTML += " " + waypoint;
    div.appendChild(input);
    div.appendChild(br);
}

function speak(text){
    text = text.toString()
    const select = document.getElementById("voices");
    const voices = speechSynthesis.getVoices();
    const voiceIndex = select.selectedIndex;
    let voiceRate = document.getElementById("utterancerate").value;
    if(voiceRate === ""){
        voiceRate = 1;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceRate;
    utterance.voice = voices[voiceIndex];
    speechSynthesis.speak(utterance);
}

speechSynthesis.getVoices();

const toDeg = 180 / Math.PI;
const toRad = Math.PI / 180;

function setAll(className){
    const state = className === "off" ? true : false;

    autogear.active = state;
    autospoilers.active = state;
    autotrim.active = state;
    autoflaps.active = state;
    autolights.active = state;
    autobrakes.active = state;
    autospeed.active = state;

    document.getElementById("all").className = state ? "active" : "off";
}

function config() {
    const checked = {
        autoflaps: {
            instance: autoflaps,
            checked: document.getElementById("configflaps").checked
        },
        autospeed: {
            instance: autospeed,
            checked: document.getElementById("configspeed").checked
        },
        autotakeoff: {
            instance: autotakeoff,
            checked: document.getElementById("configtakeoff").checked
        },
        flypattern: {
            instance: flypattern,
            checked: document.getElementById("configpattern").checked
        },
        autoland: {
            instance: autoland,
            checked: document.getElementById("configland").checked
        } 
    }

    const inputs = [];

    for(const key in checked) {
        if(checked[key].checked === true) {
            const dependenciesInputsArray = [];
            const dependencies = checked[key].instance.dependents;
            dependencies.forEach(dependency => {
                dependenciesInputsArray.push(dependency.inputs);
            });
            inputs.push(checked[key].instance.inputs, dependenciesInputsArray);
        }
    }

    const dependenciesInputs = {};

    inputs.forEach(func => {
        if(Array.isArray(func)){
            func.forEach(object => {
                for(const input in object){
                    dependenciesInputs[input] = undefined;
                }
            });
        }
    })

    const concatenatedInputs = { ...inputs[0], ...dependenciesInputs };

    for(const input in concatenatedInputs){
        const inputElement = document.getElementById(input);
        const placeholder = inputElement.getAttribute("placeholder")
        if(inputElement !== null && inputElement.type !== "checkbox" && inputElement.tagName === "INPUT" && placeholder !== null){
            const value = window.prompt(inputElement.getAttribute("placeholder"));
            inputElement.value = value;
        }
    }
};

function setConfig(){
    // CL350
    document.getElementById("flaplow").value = 130;
    document.getElementById("flaphigh").value = 200;
    document.getElementById("flapto").value = 1;
    document.getElementById("cruisespd").value = 250;
    document.getElementById("cruisealt").value = 250000;

    document.getElementById("rotate").value = 120;
    document.getElementById("climbspd").value = 200;
    document.getElementById("climbthrottle").value = 100;
    document.getElementById("climbalt").value = 1500;

    document.getElementById("flcinput").value = 500;

    document.getElementById("updist").value = 2;
    document.getElementById("downwidth").value = 4;
    document.getElementById("finallength").value = 6;
    document.getElementById("turnconst").value = 300;

    document.getElementById("altref").value = 13;
    document.getElementById("spdref").value = 130;
    document.getElementById("flare").value = 10;
    document.getElementById("touchdown").value = 1000;
    document.getElementById("vparef").value = 3;

    // SFO 28R
    document.getElementById("latref").value = 37.61353302;
    document.getElementById("longref").value = -122.35714722;
    document.getElementById("hdgref").value = 284;
    document.getElementById("direction").value = "r";
    document.getElementById("leg").value = "f";

    document.getElementById("utterancerate").value = 1;
    document.getElementById("minumuns").value = 200;
}