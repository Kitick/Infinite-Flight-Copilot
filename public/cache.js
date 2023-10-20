class Cache { // DOMCache
    #data = {};

    constructor(){}

    #save(dom, doError = false){
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

        this.#data[dom.id] = {dom:dom, value:value};
    }

    #error(dom){
        dom.classList.add("error");
        setTimeout(() => {dom.classList.remove("error");}, 2000);
    }

    addDataArray(ids){
        ids.forEach(id => {
            if(this.#data[id] === undefined){
                const dom = document.getElementById(id);
    
                dom.addEventListener("change", event => {
                    this.#save(event.target, true);
                });
    
                this.#save(dom, false);
            }
        });
    }

    addData(...ids){this.addDataArray(ids);}

    getDataArray(ids){
        let returnObject = {};

        ids.forEach(id => {
            returnObject[id] = this.#data[id].value;
        });

        return returnObject;
    }

    getData(...ids){return this.getDataArray(ids);}

    getAllData(){
        let returnObject = {};

        for(const key in this.#data){
            returnObject[key] = this.#data[key].value;
        }
        
        return returnObject;
    }

    setData(id, value){
        const item = this.#data[id];
        item.value = value;

        if(item.dom.type === "checkbox"){
            item.dom.checked = value;
        }
        else{
            item.dom.value = value;
        }
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