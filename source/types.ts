type stateValue = string | number | boolean;
type dataValue = string | number | boolean | null;
type funcCode = (data:{states:Map<string, dataValue>, inputs:Map<string, dataValue>}) => void;