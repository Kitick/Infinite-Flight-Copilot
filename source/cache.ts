class StateCache {
    #data = new Map<string, {dom:HTMLInputElement, value:dataValue}>();

    constructor(){}

    #parse(dom:HTMLInputElement){
        let value:dataValue;

        switch(dom.type){
            case "number": value = parseFloat(dom.value); break;
            case "checkbox": value = dom.checked; break;
            case "select-one": value = dom.value; break;
            default: value = null;
        }

        if(dom.type === "number" && typeof value === "number" && isNaN(value)){value = null;}

        let refrence = this.#data.get(dom.id);
        if(refrence !== undefined){refrence.value = value};
    }

    #error(dom:HTMLInputElement){
        dom.classList.add("error");
        setTimeout(() => {dom.classList.remove("error");}, 2000);
    }

    addArray(ids:string[]){
        ids.forEach(id => {
            if(this.#data.get(id) === undefined){
                const element = document.getElementById(id);

                if(element !== null && element.tagName === "INPUT"){
                    const dom = element as HTMLInputElement;

                    dom.addEventListener("change", () => {
                        this.#parse(dom);
                    });

                    this.#data.set(dom.id, {dom:dom, value:null});
                    this.#parse(dom);
                }
            }
        });
    }

    add(...ids:string[]){this.addArray(ids);}

    loadArray(ids:string[]):Map<string, dataValue> {
        let returnMap = new Map<string, dataValue>();

        ids.forEach(id => {
            let refrence = this.#data.get(id);
            if(refrence !== undefined){returnMap.set(id, refrence.value);}
        });

        return returnMap;
    }

    load(...ids:string[]){return this.loadArray(ids);}

    loadAll(){
        let returnMap = new Map<string, dataValue>();

        this.#data.forEach((refrence, key) => {
            returnMap.set(key, refrence.value);
        });

        return returnMap;
    }

    save(id:string, value:dataValue){
        const refrence = this.#data.get(id);
        if(refrence === undefined){return;}

        refrence.value = value;
        const dom = refrence.dom;

        if(dom.type === "checkbox" && typeof value === "boolean"){dom.checked = value;}
        else if(typeof value === "string"){dom.value = value;}
    }

    isValid(id:string, doError = false):boolean {
        const refrence = this.#data.get(id);
        if(refrence === undefined){return false;}

        const valid = refrence.value !== null;

        if(!valid && doError){this.#error(refrence.dom);}

        return valid;
    }

    isValidArray(ids:string[], doError = false){
        let valid = true;
        ids.forEach(id => {
            valid = this.isValid(id, doError) && valid;
        });

        return valid;
    }
}