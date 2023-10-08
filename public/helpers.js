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
        write("spoilers", 2)
    }
}

function showfpl(id, waypoint, div){
    const input = document.createElement("input");
    const br = document.createElement("br");
    input.type = "number";
    input.id = id;
    div.innerHTML += ` ${waypoint}`;
    div.appendChild(input);
    div.appendChild(br)
}

function speak(text){
    text = text.toString()
    const select = document.getElementById("voices");
    const voices = speechSynthesis.getVoices();
    const voiceIndex = select.selectedIndex;
    const voiceRate = document.getElementById("utterancerate").value;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = voiceRate;
    utterance.voice = voices[voiceIndex];
    speechSynthesis.speak(utterance);
}

speechSynthesis.getVoices();

const toDeg = 180 / Math.PI;
const toRad = Math.PI / 180;