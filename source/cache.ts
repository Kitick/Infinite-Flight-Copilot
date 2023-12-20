class StateCache {
    #data = new Map<string, {dom:HTMLInputElement, value:dataValue}>();

    constructor(){}

    #parse(dom:HTMLInputElement):void {
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

    #error(dom:HTMLInputElement):void {
        dom.classList.add("error");
        setTimeout(() => {dom.classList.remove("error");}, 2000);
    }

    addArray(ids:string[]):void {
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

    add(...ids:string[]):void {this.addArray(ids);}

    loadArray(ids:string[]):dataMap {
        let returnMap:dataMap = new Map();

        ids.forEach(id => {
            let refrence = this.#data.get(id);
            if(refrence !== undefined){returnMap.set(id, refrence.value);}
        });

        return returnMap;
    }

    load(...ids:string[]):dataMap {return this.loadArray(ids);}

    loadAll():dataMap {
        let returnMap:dataMap = new Map();

        this.#data.forEach((refrence, key) => {
            returnMap.set(key, refrence.value);
        });

        return returnMap;
    }

    save(id:string, value:dataValue):void {
        const refrence = this.#data.get(id);
        if(refrence === undefined){return;}

        refrence.value = value;
        const dom = refrence.dom;

        if(value === null){value = "";}

        if(dom.type === "checkbox" && typeof value === "boolean"){dom.checked = value;}
        else{dom.value = value.toString();}
    }

    isValid(id:string, doError = false):boolean {
        const refrence = this.#data.get(id);
        if(refrence === undefined){return false;}

        const valid = refrence.value !== null;

        if(!valid && doError){this.#error(refrence.dom);}

        return valid;
    }

    isValidArray(ids:string[], doError = false):boolean {
        let valid = true;
        ids.forEach(id => {
            valid = this.isValid(id, doError) && valid;
        });

        return valid;
    }
}