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

    let inputArray = [];

    for(const key in checked) {
        if(checked[key].checked) {
            const inputs = checked[key].instance.inputs;
            const dependencies = checked[key].instance.dependents;

            inputs.forEach(id => {
                if(inputArray.indexOf(id) === -1){
                    inputArray.push(id);
                }
            });

            dependencies.forEach(dependency => {
                dependency.inputs.forEach(id => {
                    if(inputArray.indexOf(id) === -1){
                        inputArray.push(id);
                    }
                });
            });
        }
    }

    inputArray.forEach(input => {
        const dom = document.getElementById(input);

        if(dom.type === "number"){
            const value = prompt(dom.placeholder + "\nLeave blank to not change");

            if(value !== ""){
                dom.value = value;
                autofunction.cache.setData(input, value);
            }
        }
    });
};

function setConfig(){
    // CL350
    autofunction.cache.setData("flaplow", 130);
    autofunction.cache.setData("flaphigh", 200);
    autofunction.cache.setData("flapto", 1);
    autofunction.cache.setData("cruisespd", 250);
    autofunction.cache.setData("cruisealt", 250000);

    autofunction.cache.setData("rotate", 120);
    autofunction.cache.setData("climbspd", 200);
    autofunction.cache.setData("climbthrottle", 100);
    autofunction.cache.setData("climbalt", 2000);

    autofunction.cache.setData("flcinput", 500);

    autofunction.cache.setData("updist", 2);
    autofunction.cache.setData("downwidth", 4);
    autofunction.cache.setData("finallength", 6);
    autofunction.cache.setData("turnconst", 300);

    autofunction.cache.setData("altref", 13);
    autofunction.cache.setData("spdref", 130);
    autofunction.cache.setData("flare", 10);
    autofunction.cache.setData("touchdown", 1000);
    autofunction.cache.setData("vparef", 3);

    // SFO 28R
    autofunction.cache.setData("latref", 37.61353302);
    autofunction.cache.setData("longref", -122.35714722);
    autofunction.cache.setData("hdgref", 284);
    autofunction.cache.setData("direction", "r");

    autofunction.cache.setData("utterancerate", 1);
    autofunction.cache.setData("minumuns", 200);
}