class Cache { // DOMCache
    #data = {};
    #ids = [];
    // Could possibly use Map

    constructor(){}

    #parse(dom, doError = false){
        let value = parseFloat(dom.value);

        if(dom.type === "number" && isNaN(value)){
            value = null;
            if(doError){this.#error(dom);}
        }
        else{
            switch(dom.type){
                case "checkbox": value = dom.checked; break;
                case "select-one": value = dom.value; break;
            }
        }

        this.#data[dom.id].value = value;
    }

    #error(dom){
        dom.classList.add("error");
        setTimeout(() => {dom.classList.remove("error");}, 2000);
    }

    addArray(ids){
        ids.forEach(id => {
            if(this.#data[id] === undefined){
                const dom = document.getElementById(id);

                dom.addEventListener("change", event => {
                    this.#parse(event.target, true);
                });

                this.#data[dom.id] = {dom:dom, value:null};
                this.#ids.push(dom.id);

                this.#parse(dom, false);
            }
        });
    }

    add(...ids){this.addArray(ids);}

    loadArray(ids){
        let returnObject = {};

        ids.forEach(id => {
            returnObject[id] = this.#data[id].value;
        });

        return returnObject;
    }

    load(...ids){return this.loadArray(ids);}

    loadAll(){
        return this.loadArray(this.#ids);
    }

    save(id, value){
        const item = this.#data[id];
        item.value = value;

        if(item.dom.type === "checkbox"){item.dom.checked = value;}
        else{item.dom.value = value;}
    }

    isValid(id, doError = false){
        const item = this.#data[id];
        const valid = item.value !== null;

        if(!valid && doError){this.#error(item.dom);}

        return valid;
    }

    isValidArray(ids, doError = false){
        let valid = true;
        ids.forEach(id => {
            valid = this.isValid(id, doError) && valid;
        });

        return valid;
    }
}