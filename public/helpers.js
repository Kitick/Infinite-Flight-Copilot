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
                autofunction.cache.save(input, value);
            }
        }
    });
};

function loadSavedConfig(){
    const localStorageDefaultProperties = ["length", "clear", "getItem", "key", "removeItem", "setItem"];
    const configSelect = document.getElementById("configselect");
    configSelect.length = 0;
    const configs = autofunction.localstorage.loadAll();
    for(const key in configs){
        if(localStorageDefaultProperties.indexOf(key) === -1){
            const option = new Option(key, key);
            configSelect.appendChild(option);
        }
    }
}

function loadLocalStorage(key){
    const data = JSON.parse(autofunction.localstorage.load(key));
    for(const key in data){
        autofunction.cache.save(key, data[key]);
    }
}

function saveLocalStorage(){
    let name = prompt("Please say the name of the config");
    while(name === "") name = prompt("Please say a valid name");
    if(name !== null){
        const inputs = autofunction.cache.loadAll();
        let values = {};
        for(const key in inputs){
            if(inputs[key] !== null){
                values[key] = inputs[key];
            }
        }

        autofunction.localstorage.save(name, JSON.stringify(values));

        loadSavedConfig();
    }
}

function clearLocalStorage(key){
    const option = prompt("Write 1 to delete all configs or 2 to delete the selected config");
    if(option === "1"){
        autofunction.localstorage.clearAll();
    } 
    else if(option === "2"){
        autofunction.localstorage.clear(key);
    }

    loadSavedConfig();
}

function setConfig(){
    // CL350
    autofunction.cache.save("flaplow", 130);
    autofunction.cache.save("flaphigh", 200);
    autofunction.cache.save("flapto", 1);
    autofunction.cache.save("cruisespd", 250);
    autofunction.cache.save("cruisealt", 250000);

    autofunction.cache.save("rotate", 120);
    autofunction.cache.save("climbspd", 200);
    autofunction.cache.save("climbthrottle", 100);
    autofunction.cache.save("climbalt", 2000);

    autofunction.cache.save("flcinput", 500);

    autofunction.cache.save("updist", 2);
    autofunction.cache.save("downwidth", 4);
    autofunction.cache.save("finallength", 6);
    autofunction.cache.save("turnconst", 300);

    autofunction.cache.save("altref", 13);
    autofunction.cache.save("spdref", 130);
    autofunction.cache.save("flare", 10);
    autofunction.cache.save("touchdown", 1000);
    autofunction.cache.save("vparef", 3);

    // SFO 28R
    autofunction.cache.save("latref", 37.61353302);
    autofunction.cache.save("longref", -122.35714722);
    autofunction.cache.save("hdgref", 284);
    autofunction.cache.save("direction", "r");

    autofunction.cache.save("utterancerate", 1);
    autofunction.cache.save("minumuns", 200);
}