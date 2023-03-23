function toIntByteChunk(number){
    if(number < 0){
        number += 2 ** 32;
    }

    let hex = [];
    while(true){
        hex.push(number % 256);
        number = parseInt(number / 256);

        if(number < 1){
            for(let i = hex.length; i < 4; i++){
                hex.push(0);
            }

            break;
        }
    }

    return hex;
}

function fromIntByteChunk(chunk){
    let value = 0;

    for(let i = 0, length = chunk.length; i < length; i++){
        value += chunk[i] * (256 ** i);
    }

    let bitSize = 2 ** (chunk.length * 8);
    if(value >= bitSize / 2){
        value -= bitSize;
    }

    return value;
}

function fromStringByteChunk(chunk){
    let string = "";
    chunk.forEach(code => {
        string += String.fromCharCode(code);
    });

    return string;
}