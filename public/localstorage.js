class localstorage {
    constructor() {}

    loadAll(){
        let returnObject = {}

        for(const key in localStorage){
            returnObject[key] = localStorage.getItem(key);
        }

        return returnObject;
    }

    load(key){
        return localStorage.getItem(key);
    }

    save(key, value){
        localStorage.setItem(key, value);
    }

    clearAll(){
        localStorage.clear();
    }

    clear(key){
        localStorage.removeItem(key);
    }
}